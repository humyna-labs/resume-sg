/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// resume-sg#52 (brief v8 section 1, fact-check 4): strong sources, coverage only by strong sources, numbers checked
// only against a strong source, cross-language titles and degrees listed to compare, and the exact texts.
// Contract used here (the issue leaves the shape of a finding open, so these tests fix it):
//  - a source that is a substring of the original but not strong gives the SAME `kind: "source"` and `where` as the
//    red source finding of #8, with level "amber" (never red, never passing);
//  - a number in a bullet whose source is not strong is `{ level: "red", kind: "number", where: <bullet path>,
//    value: <the number as written> }`, one per number, even when the number occurs elsewhere in the original;
//  - a cross-language run gives one `{ level: "amber", kind: "translated" }` finding per experience title and per
//    education degree, `where` = `experience[i].title` / `education[i].degree`, `value` = the title or degree as
//    written in the output. Companies and schools get none (name-mask #49 owns them). Same-language runs give none.
// Synthetic data only.
import { describe, expect, it } from "vitest";
import { factCheck } from "../../src/ai/factCheck.ts";
import type { Finding, TailorOutput } from "../../src/ai/types.ts";
import en from "../../src/i18n/en.ts";
import zh from "../../src/i18n/zh.ts";
import { case1Original, case1Output, case2Original, case2Output, emptySourced } from "../fixtures/fact-check-cases.ts";
import { case1ZhOutput, case2EnOutput } from "../fixtures/fact-check-2-cases.ts";
import { case2NaturalEnOutput } from "../fixtures/fact-check-3-cases.ts";
import { leafValues } from "./dict-helpers.ts";

const of = (f: Finding[], kind: string, level?: Finding["level"]) =>
  f.filter((x) => (x.kind as string) === kind && (level === undefined || x.level === level));
const where = (f: Finding[]) => f.map((x) => x.where);
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- a small faithful resume
const HEAD = "Platform Engineer — Harbor Pay";
const DATES = "Mar 2021 – Present";
const B1 = "Cut nightly batch time from 40 minutes to 12 minutes.";
const B2 = "Mentored 5 engineers on the platform team.";
const EDU = "B.Sc. Computing — Example University — 2010 – 2014";
const CERT = "AWS Certified Solutions Architect – Associate (2022)";
const VOL = "Volunteer reading buddy for primary school pupils in 2019";
const ORIG_LINES = ["Alex Example", "alex.example@example.com · +65 9000 0000", "Experience", HEAD, DATES, `- ${B1}`, `- ${B2}`, "Education", EDU, "Certificates", CERT, VOL];
const ORIG = ORIG_LINES.join("\n");

function faithful(): TailorOutput {
  const r = emptySourced();
  r.basics = { name: "Alex Example", headline: "", email: "alex.example@example.com", phone: "+65 9000 0000", location: "", links: [] };
  r.experience = [
    {
      id: "e1", company: "Harbor Pay", title: "Platform Engineer", location: "", start: "Mar 2021", end: "Present",
      source: [HEAD, DATES, `- ${B1}`, `- ${B2}`].join("\n"),
      bullets: [
        { text: B1, source: `- ${B1}` },
        { text: B2, source: `- ${B2}` },
      ],
    },
  ];
  r.education = [{ id: "d1", school: "Example University", degree: "B.Sc. Computing", start: "2010", end: "2014", details: [], source: EDU }];
  r.certificates = [{ text: CERT, source: CERT }];
  r.extras = [{ id: "x1", heading: "Other", items: [{ text: VOL, source: VOL }] }];
  return { resume: r, changes: [], notIncluded: [] };
}

describe("the baseline of this file is faithful (guards the next tests)", () => {
  it("no finding at all in the same language", () => {
    expect(factCheck(ORIG, faithful(), { outputLang: "en" })).toEqual([]);
  });
});

// ---------------------------------------------------------------- criterion 1: strong sources
/** A line of exactly n characters with no digits: "alpha beta gamma delta alpha ...". */
const lineOf = (n: number): string => "alpha beta gamma delta ".repeat(Math.ceil(n / 23) + 1).slice(0, n).trimEnd();
const LINE100 = lineOf(100);

/** One bullet, one certificate, one extras item and one notIncluded entry that all use `source` on a 100-character line. */
function withSource(source: string, slot: "bullet" | "certificate" | "extras" | "notIncluded"): Finding[] {
  const original = ["Platform Engineer — Harbor Pay", `- ${LINE100}`].join("\n");
  const r = emptySourced();
  r.experience = [
    {
      id: "e1", company: "Harbor Pay", title: "Platform Engineer", location: "", start: "", end: "",
      source: "Platform Engineer — Harbor Pay", bullets: slot === "bullet" ? [{ text: "Did the work.", source }] : [],
    },
  ];
  if (slot === "certificate") r.certificates = [{ text: "Cert", source }];
  if (slot === "extras") r.extras = [{ id: "x1", heading: "Other", items: [{ text: "Item", source }] }];
  return factCheck(original, { resume: r, changes: [], notIncluded: slot === "notIncluded" ? [{ source }] : [] });
}
const PATH = { bullet: "experience[0].bullets[0]", certificate: "certificates[0]", extras: "extras[0].items[0]", notIncluded: "notIncluded[0]" } as const;

describe("criterion 1: a bullet, certificate, extras or notIncluded source is strong at 60% of one line", () => {
  for (const slot of ["bullet", "certificate", "extras", "notIncluded"] as const) {
    it(`${slot}: a one-letter source is amber "source too short", not red and not passing`, () => {
      const f = of(withSource("e", slot), "source");
      expect(f.map((x) => [x.level, x.where])).toEqual([["amber", PATH[slot]]]);
    });
    it(`${slot}: a source covering exactly 60% of its line passes`, () => {
      expect(of(withSource(LINE100.slice(0, 60), slot), "source")).toEqual([]);
    });
    it(`${slot}: a source covering 59% of its line is amber`, () => {
      expect(of(withSource(LINE100.slice(0, 59), slot), "source").map((x) => [x.level, x.where])).toEqual([["amber", PATH[slot]]]);
    });
    it(`${slot}: the whole line passes, with or without its bullet marker`, () => {
      expect(of(withSource(LINE100, slot), "source")).toEqual([]);
      expect(of(withSource(`- ${LINE100}`, slot), "source")).toEqual([]);
    });
    it(`${slot}: a source that covers two whole lines is not inside one line: amber, not red`, () => {
      const original = ["Platform Engineer — Harbor Pay", B1, B2].join("\n"); // plain lines: the two-line source is a substring
      const r = emptySourced();
      const two = `${B1} ${B2}`;
      r.experience = [{ id: "e1", company: "Harbor Pay", title: "Platform Engineer", location: "", start: "", end: "", source: "Platform Engineer — Harbor Pay", bullets: slot === "bullet" ? [{ text: "Did the work.", source: two }] : [] }];
      if (slot === "certificate") r.certificates = [{ text: "Cert", source: two }];
      if (slot === "extras") r.extras = [{ id: "x1", heading: "Other", items: [{ text: "Item", source: two }] }];
      const f = of(factCheck(original, { resume: r, changes: [], notIncluded: slot === "notIncluded" ? [{ source: two }] : [] }), "source");
      expect(f.map((x) => [x.level, x.where])).toEqual([["amber", PATH[slot]]]);
    });
  }

  it("a source that is not in the original at all is still red (unchanged from #8)", () => {
    const f = of(withSource("Cut nightly batch time from 99 minutes", "bullet"), "source");
    expect(f.map((x) => [x.level, x.where])).toEqual([["red", PATH.bullet]]);
  });
});

describe("criterion 1: an entry source is a run of consecutive lines that includes the company or title line", () => {
  const ENTRY_ORIG = ["Alex Example", "Platform Engineer — Harbor Pay", DATES, `- ${B1}`, `- ${B2}`].join("\n");
  const entryWith = (source: string, original = ENTRY_ORIG) => {
    const r = emptySourced();
    r.experience = [{ id: "e1", company: "Harbor Pay", title: "Platform Engineer", location: "", start: "Mar 2021", end: "Present", source, bullets: [] }];
    return of(factCheck(original, { resume: r, changes: [], notIncluded: [] }), "source");
  };

  it("the title line, the date line and every bullet of a long entry pass", () => {
    expect(entryWith(["Platform Engineer — Harbor Pay", DATES, `- ${B1}`, `- ${B2}`].join("\n"))).toEqual([]);
  });
  it("the title line and the date line pass", () => {
    expect(entryWith(["Platform Engineer — Harbor Pay", DATES].join("\n"))).toEqual([]);
  });
  it("a run that skips a line in between is amber (title, bullet 1 without the date line)", () => {
    const f = entryWith(["Platform Engineer — Harbor Pay", `- ${B1}`].join("\n"));
    expect(f.map((x) => [x.level, x.where])).toEqual([["amber", "experience[0]"]]);
  });
  it("a run that skips the last line of the middle is amber (title and the second bullet)", () => {
    const f = entryWith(["Platform Engineer — Harbor Pay", `- ${B2}`].join("\n"));
    expect(f.map((x) => [x.level, x.where])).toEqual([["amber", "experience[0]"]]);
  });
  it("a run that does not include the company or title line is amber", () => {
    const f = entryWith([DATES, `- ${B1}`, `- ${B2}`].join("\n"));
    expect(f.map((x) => [x.level, x.where])).toEqual([["amber", "experience[0]"]]);
  });

  it("the length rule: 11 characters is amber, 12 characters passes", () => {
    const run = (line: string) => {
      const r = emptySourced();
      r.experience = [{ id: "e1", company: "Acme Co", title: "QA", location: "", start: "", end: "", source: line, bullets: [] }];
      return of(factCheck(`${line}\nSomething else`, { resume: r, changes: [], notIncluded: [] }), "source");
    };
    expect(run("QA, Acme Co").map((x) => x.level)).toEqual(["amber"]); // 11
    expect(run("QA, Acme Co.")).toEqual([]); // 12
  });
  it("mostly CJK: 6 characters passes, 5 is amber", () => {
    const run = (line: string, company: string, title: string) => {
      const r = emptySourced();
      r.experience = [{ id: "e1", company, title, location: "", start: "", end: "", source: line, bullets: [] }];
      return of(factCheck(`${line}\n另一行内容`, { resume: r, changes: [], notIncluded: [] }), "source");
    };
    expect(run("运营助理北岸", "北岸", "运营助理")).toEqual([]); // 6
    expect(run("运营助理岸", "岸", "运营助理").map((x) => x.level)).toEqual(["amber"]); // 5
  });

  it("a project source passes when it includes the project name and is amber when it only has a bullet", () => {
    const original = ["Atlas Router — personal project", "- Built the routing core in Rust."].join("\n");
    const run = (source: string) => {
      const r = emptySourced();
      r.projects = [{ id: "p1", name: "Atlas Router", role: "", org: "", start: "", end: "", tech: [], source, bullets: [] }];
      return of(factCheck(original, { resume: r, changes: [], notIncluded: [] }), "source");
    };
    expect(run(original)).toEqual([]);
    expect(run("- Built the routing core in Rust.").map((x) => [x.level, x.where])).toEqual([["amber", "projects[0]"]]);
  });
  it("an education source passes when it includes the school or the degree line and is amber when it does not", () => {
    const original = ["B.Sc. Computing — Example University", "2010 – 2014, first class honours, dean's list"].join("\n");
    const run = (source: string) => {
      const r = emptySourced();
      r.education = [{ id: "d1", school: "Example University", degree: "B.Sc. Computing", start: "2010", end: "2014", details: [], source }];
      return of(factCheck(original, { resume: r, changes: [], notIncluded: [] }), "source");
    };
    expect(run(original)).toEqual([]);
    expect(run("2010 – 2014, first class honours, dean's list").map((x) => [x.level, x.where])).toEqual([["amber", "education[0]"]]);
  });
});

// ---------------------------------------------------------------- criterion 2: coverage
describe("criterion 2: an original line is covered only by a strong source that covers 60% of it or holds the whole line", () => {
  const cover = (source: string, slot: "certificate" | "notIncluded" = "certificate") => {
    const original = `${LINE100}\nSecond task line`;
    const r = emptySourced();
    if (slot === "certificate") r.certificates = [{ text: "Cert", source }];
    return factCheck(original, { resume: r, changes: [], notIncluded: slot === "notIncluded" ? [{ source }] : [] });
  };
  const uncovered = (f: Finding[]) => of(f, "coverage").map((x) => x.value);

  it("a 60% source covers its line", () => {
    expect(uncovered(cover(LINE100.slice(0, 60)))).toEqual(["Second task line"]);
  });
  it("a 59% source covers nothing: its line is amber coverage, and the source is amber too", () => {
    const f = cover(LINE100.slice(0, 59));
    expect(uncovered(f)).toEqual([LINE100, "Second task line"]);
    expect(of(f, "source", "amber")).toHaveLength(1);
  });
  it("a one-letter source covers nothing (certificate and notIncluded)", () => {
    for (const slot of ["certificate", "notIncluded"] as const) expect(uncovered(cover("a", slot))).toEqual([LINE100, "Second task line"]);
  });
  it("a strong entry source that covers less than 60% of a long line does not cover that line", () => {
    const long = "Platform Engineer — Harbor Pay — Singapore, hybrid, reporting to the head of payments engineering";
    const r = emptySourced();
    r.experience = [{ id: "e1", company: "Harbor Pay", title: "Platform Engineer", location: "", start: "", end: "", source: "Platform Engineer — Harbor Pay", bullets: [] }];
    const f = factCheck(long, { resume: r, changes: [], notIncluded: [] });
    expect(of(f, "source")).toEqual([]);
    expect(uncovered(f)).toEqual([long]);
  });
  it("an entry source that holds a whole line covers it, even a short line", () => {
    const original = "Platform Engineer — Harbor Pay\nHybrid";
    const r = emptySourced();
    r.experience = [{ id: "e1", company: "Harbor Pay", title: "Platform Engineer", location: "", start: "", end: "", source: original, bullets: [] }];
    expect(of(factCheck(original, { resume: r, changes: [], notIncluded: [] }), "coverage")).toEqual([]);
  });
});

// ---------------------------------------------------------------- criterion 3: numbers
describe("criterion 3: numbers are checked against a strong source only", () => {
  const run = (text: string, source: string, original = ORIG) => {
    const out = faithful();
    out.resume.experience[0]!.bullets = [{ text, source }];
    return of(factCheck(original, out), "number");
  };

  it("a strong source: the numbers of the line pass", () => {
    expect(run(B1, `- ${B1}`)).toEqual([]);
  });
  it("a weak source: each number of the bullet is red, one finding per number", () => {
    const f = run(B1, "Cut nightly batch time");
    expect(f.map((x) => [x.level, x.where, x.value]).sort()).toEqual([
      ["red", "experience[0].bullets[0]", "12"],
      ["red", "experience[0].bullets[0]", "40"],
    ]);
  });
  it("a weak source: a number that occurs elsewhere in the original is red too, not amber", () => {
    const f = run("Mentored 5 engineers.", "Mentored");
    expect(f.map((x) => [x.level, x.value])).toEqual([["red", "5"]]);
  });
  it("a bullet whose source is the whole original makes its numbers red", () => {
    const f = run("Mentored 5 engineers.", ORIG);
    expect(f.map((x) => [x.level, x.value])).toEqual([["red", "5"]]);
  });
  it("a bullet without numbers gives no number finding with any source", () => {
    expect(run("Led the platform team.", "Led")).toEqual([]);
  });
  it("a source that is not in the original has no strength either: its numbers are red", () => {
    const f = run("Cut batch time to 99 minutes.", "Cut batch time to 99 minutes.");
    expect(f.map((x) => [x.level, x.value])).toEqual([["red", "99"]]);
  });
  it("the summary keeps the #8 rule: any number of the original passes", () => {
    const out = faithful();
    out.resume.summary = "Engineer who mentored 5 people.";
    expect(of(factCheck(ORIG, out), "number")).toEqual([]);
  });
});

// ---------------------------------------------------------------- criterion 4: the two exploits
describe("criterion 4: the two exploits give findings", () => {
  it("(a) an empty resume with notIncluded sources 'e' and 'i' gives findings: two amber sources and the uncovered lines", () => {
    const out: TailorOutput = { resume: emptySourced(), changes: [], notIncluded: [{ source: "e" }, { source: "i" }] };
    const f = factCheck(ORIG, out);
    expect(f.length).toBeGreaterThan(0);
    expect(of(f, "source", "amber").map((x) => x.where).sort()).toEqual(["notIncluded[0]", "notIncluded[1]"]);
    expect(of(f, "coverage", "amber").length).toBeGreaterThanOrEqual(8);
  });
  it("(a) the same in a cross-language run and in Chinese", () => {
    const out: TailorOutput = { resume: emptySourced(), changes: [], notIncluded: [{ source: "e" }, { source: "i" }] };
    expect(factCheck(ORIG, out, { outputLang: "zh" }).length).toBeGreaterThan(0);
    expect(factCheck(case2Original, { ...out, notIncluded: [{ source: "的" }, { source: "和" }] }).length).toBeGreaterThan(0);
  });
  it("(b) a bullet whose source is the whole original, with a number that appears elsewhere, gives a red number", () => {
    const out = faithful();
    out.resume.experience[0]!.bullets = [{ text: "Led 12 projects in 2019.", source: ORIG }];
    const f = factCheck(ORIG, out);
    expect(of(f, "number", "red").map((x) => x.value).sort()).toEqual(["12"]);
    expect(of(f, "source", "amber").map((x) => x.where)).toContain("experience[0].bullets[0]");
  });
});

// ---------------------------------------------------------------- criterion 5: cross-language titles and degrees
describe("criterion 5: cross-language runs list every experience title and education degree as amber 'translated'", () => {
  const sig = (f: Finding[]) => f.map((x) => `${x.level}:${x.where}:${x.value}`).sort();

  it("en original, zh output: one amber per experience title and per degree; none for company or school", () => {
    const f = factCheck(case1Original, case1ZhOutput(), { outputLang: "zh" });
    expect(sig(of(f, "translated"))).toEqual(
      [
        "amber:experience[0].title:首席后端工程师",
        "amber:experience[1].title:高级软件工程师",
        "amber:experience[2].title:软件工程师",
        "amber:education[0].degree:计算机科学工学学士",
      ].sort(),
    );
    expect(where(of(f, "translated")).some((w) => /company|school/.test(w))).toBe(false);
  });
  it("zh original, en output: one amber per experience title and per degree", () => {
    const f = factCheck(case2Original, case2NaturalEnOutput(), { outputLang: "en" });
    expect(sig(of(f, "translated"))).toEqual(
      [
        "amber:experience[0].title:Senior User Operations",
        "amber:experience[1].title:Operations Assistant",
        "amber:education[0].degree:Bachelor of Management, Marketing",
      ].sort(),
    );
    expect(of(f, "translated").every((x) => x.level === "amber")).toBe(true);
  });
  it("zh original, en output with the titles kept in Chinese still lists them", () => {
    const f = factCheck(case2Original, case2EnOutput(), { outputLang: "en" });
    expect(of(f, "translated").map((x) => x.where).sort()).toEqual(["education[0].degree", "experience[0].title", "experience[1].title"]);
  });
  it("faithful cross-language runs still have no red finding", () => {
    expect(factCheck(case1Original, case1ZhOutput(), { outputLang: "zh" }).filter((x) => x.level === "red")).toEqual([]);
    expect(factCheck(case2Original, case2NaturalEnOutput(), { outputLang: "en" }).filter((x) => x.level === "red")).toEqual([]);
  });
  it("a same-language run gives no translated finding, with or without outputLang", () => {
    expect(of(factCheck(case1Original, case1Output(), { outputLang: "en" }), "translated")).toEqual([]);
    expect(of(factCheck(case1Original, case1Output()), "translated")).toEqual([]);
    expect(of(factCheck(case2Original, case2Output(), { outputLang: "zh" }), "translated")).toEqual([]);
  });
  it("the faithful same-language cases still give no finding at all", () => {
    expect(factCheck(case1Original, case1Output(), { outputLang: "en" })).toEqual([]);
    expect(factCheck(case2Original, case2Output(), { outputLang: "zh" })).toEqual([]);
  });
  it("the finding ids are unique", () => {
    const f = factCheck(case1Original, case1ZhOutput(), { outputLang: "zh" });
    expect(new Set(f.map((x) => x.id)).size).toBe(f.length);
  });
});

// ---------------------------------------------------------------- criterion 6: texts
describe("criterion 6: the exact texts", () => {
  const D = { en, zh } as const;
  const T = {
    en: {
      "home.badge": "Dates and numbers checked by code",
      "home.note": "Dates, numbers and the source of every line are checked against your original. Anything that cannot be matched is highlighted, and export waits until the red items are dealt with.",
      "home.reason.3.body": "The AI only rephrases, reorders, merges and translates. Code then checks dates, numbers and where every line came from; when the output is in another language, you compare titles and names yourself.",
      "flow.green": "All dates, numbers and sources were found in your original",
      "flow.greenCross": "All dates and numbers were found in your original. Titles, degrees and names are in another language, so compare them with the original.",
    },
    zh: {
      "home.badge": "日期和数字由代码核对",
      "home.note": "日期、数字和每一句的出处都会和原简历核对，对不上的会标出来；红色项处理完之前不能导出。",
      "home.reason.3.body": "AI 只改写、调整顺序、合并和翻译。之后由代码核对日期、数字和每一句的出处；输出换了语言时，职位和名称需要你对照原文确认。",
      "flow.green": "日期、数字和出处都能在原简历里找到",
      "flow.greenCross": "日期和数字都能在原简历里找到。职位、学历和名称换了语言，请对照原文看一遍。",
    },
  } as const;
  for (const lang of ["en", "zh"] as const)
    for (const [key, text] of Object.entries(T[lang]))
      it(`${lang} ${key}`, () => {
        expect(norm((D[lang] as unknown as Record<string, string>)[key] ?? "")).toBe(norm(text));
      });

  it("faq.7.a keeps its first sentence and has the new rest, in both languages", () => {
    const e = norm((en as unknown as Record<string, string>)["faq.7.a"] ?? "");
    const z = norm((zh as unknown as Record<string, string>)["faq.7.a"] ?? "");
    expect(e).toBe(
      norm(
        "We instruct the AI to only rephrase, reorder, merge and translate what you wrote, and never to add employers, titles, dates, degrees, certificates, numbers or skills. After generation, the app checks dates, numbers, contact details and the source of every line against your original, and lists anything it cannot match. It does not judge how a sentence is worded, and when the output is in another language it asks you to compare titles, degrees and names yourself.",
      ),
    );
    expect(z).toBe(
      norm(
        "我们要求 AI 只改写、调整顺序、合并和翻译你写过的内容，不能新增公司、职位、日期、学历、证书、数字或技能。生成之后，程序会把日期、数字、联系方式和每一句的出处与原简历核对，对不上的都会列出来。它不评判句子的写法；输出换了语言时，会请你自己对照原文核对职位、学历和名称。",
      ),
    );
  });
  it("the old over-claiming texts are gone from both dictionaries", () => {
    for (const d of [en, zh]) {
      const all = leafValues(d).map(norm).join("\n");
      expect(all).not.toContain("Employers, dates and numbers checked");
      expect(all).not.toContain("Employers, titles, dates, degrees and other numbers were all found in your original");
      expect(all).not.toContain("公司、日期、数字已逐项核对");
      expect(all).not.toContain("公司、职位、日期、学历和其他数字都能在原简历里找到");
    }
  });
});
