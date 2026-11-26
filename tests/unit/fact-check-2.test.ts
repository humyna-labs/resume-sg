/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// resume-sg#36 (amends brief v5.2 section 4): cross-language output, basics, items, coverage.
// Contract: detectLang(text), factCheck(original, out, opts?: { outputLang }). Synthetic data only.
import { describe, expect, it } from "vitest";
import { detectLang, factCheck } from "../../src/ai/factCheck.ts";
import type { Finding, TailorOutput } from "../../src/ai/types.ts";
import {
  case1Original,
  case1Output,
  case2Original,
  case2Output,
  clone,
  deepFreeze,
  emptySourced,
} from "../fixtures/fact-check-cases.ts";
import { case1ZhOutput, case2EnOutput } from "../fixtures/fact-check-2-cases.ts";

const red = (f: Finding[]) => f.filter((x) => x.level === "red");
const amber = (f: Finding[]) => f.filter((x) => x.level === "amber");
const kind = (f: Finding[], k: string) => f.filter((x) => (x.kind as string) === k);
const values = (f: Finding[]) => f.map((x) => x.value).sort();

// ---------------------------------------------------------------- criterion 1
describe("criterion 1: detectLang", () => {
  const mix = (han: number, latin: number) => "中".repeat(han) + " 123 ,.! " + "a".repeat(latin);

  it("a Chinese resume with English brand names (Java, Kafka, AWS) is zh", () => {
    expect(detectLang("熟悉 Java、Kafka 和 AWS，负责后端开发与系统设计，优化服务性能，参与线上故障排查")).toBe("zh");
    expect(detectLang(case2Original)).toBe("zh");
  });
  it("an English resume with a Chinese name is en", () => {
    expect(detectLang(case1Original.replace("Jamie Lin", "林杰米"))).toBe("en");
    expect(detectLang(case1Original)).toBe("en");
  });
  it("threshold: 30% Han of the letters is zh, 29% is en (digits, spaces and punctuation do not count)", () => {
    expect(detectLang(mix(30, 70))).toBe("zh");
    expect(detectLang(mix(29, 71))).toBe("en");
    expect(detectLang(mix(31, 69))).toBe("zh");
  });
  it("empty text is en", () => {
    expect(detectLang("")).toBe("en");
  });
});

// ---------------------------------------------------------------- criterion 2
describe("criterion 2: same language equals no opts", () => {
  it("factCheck without opts equals factCheck with the original's own language", () => {
    for (const [o, out] of [
      [case1Original, case1Output()],
      [case2Original, case2Output()],
      [case1Original, case1ZhOutput()],
    ] as const) {
      expect(factCheck(o, out)).toEqual(factCheck(o, out, { outputLang: detectLang(o) }));
    }
  });
  it("the unmutated #8 cases still give no red finding in the same language", () => {
    expect(red(factCheck(case1Original, case1Output()))).toEqual([]);
    expect(red(factCheck(case2Original, case2Output()))).toEqual([]);
  });
});

// ---------------------------------------------------------------- criterion 3
const crossOriginal = [
  "Engineer, Acme, 2020 - 2021",
  "- Built the billing API used by 3 teams.",
  "Project Atlas, Java 2020",
  "BSc Maths, Bayview College, 2016 - 2020",
  "Azure Fundamentals 2021",
  "Reading buddy volunteer 2019",
].join("\n");

function crossOut(): TailorOutput {
  const r = emptySourced();
  r.experience = [
    {
      id: "e1", company: "Acme", title: "工程师", location: "", start: "2020", end: "2021",
      source: "Engineer, Acme, 2020 - 2021",
      bullets: [{ text: "构建计费 API，服务 3 个团队。", source: "Built the billing API used by 3 teams." }],
    },
  ];
  r.projects = [
    { id: "p1", name: "Atlas 项目", role: "", org: "", start: "2020", end: "", tech: [], source: "Project Atlas, Java 2020", bullets: [] },
  ];
  r.education = [
    {
      id: "d1", school: "Bayview 学院", degree: "数学学士", start: "2016", end: "2020", details: [],
      source: "BSc Maths, Bayview College, 2016 - 2020",
    },
  ];
  r.certificates = [{ text: "Azure Fundamentals 认证 2021", source: "Azure Fundamentals 2021" }];
  r.extras = [{ id: "x1", heading: "志愿者", items: [{ text: "读书伙伴志愿者 2019", source: "Reading buddy volunteer 2019" }] }];
  return { resume: r, changes: [], notIncluded: [] };
}

describe("criterion 3: cross-language entry fields", () => {
  const cross = { outputLang: "zh" } as const;

  it("a faithful cross-language entry gives no red finding", () => {
    expect(red(factCheck(crossOriginal, crossOut(), cross))).toEqual([]);
  });
  it("the same output is red in the same language (substring rules of #8)", () => {
    const f = factCheck(crossOriginal, crossOut(), { outputLang: "en" });
    expect(kind(red(f), "unsourced").length).toBeGreaterThan(0);
  });
  it("Latin tokens match case-insensitively", () => {
    const out = crossOut();
    out.resume.experience[0]!.company = "acme 公司";
    expect(red(factCheck(crossOriginal, out, cross))).toEqual([]);
  });
  it("single-letter Latin tokens are ignored", () => {
    const out = crossOut();
    out.resume.experience[0]!.title = "X 工程师";
    expect(red(factCheck(crossOriginal, out, cross))).toEqual([]);
  });

  const fields: [string, (o: TailorOutput) => void][] = [
    ["company", (o) => (o.resume.experience[0]!.company = "Zenith")],
    ["title", (o) => (o.resume.experience[0]!.title = "Zenith 工程师")],
    ["project name", (o) => (o.resume.projects[0]!.name = "Zenith 项目")],
    ["school", (o) => (o.resume.education[0]!.school = "Zenith 学院")],
    ["degree", (o) => (o.resume.education[0]!.degree = "Zenith 学士")],
    ["certificate", (o) => (o.resume.certificates[0]!.text = "Zenith 认证 2021")],
    ["extras text", (o) => (o.resume.extras[0]!.items[0]!.text = "Zenith 志愿者 2019")],
  ];
  it.each(fields)("%s: a Latin token not in the original is red unsourced with the token as value", (_n, mutate) => {
    const out = crossOut();
    mutate(out);
    const f = factCheck(crossOriginal, out, cross);
    expect(red(f).map((x) => [x.kind, x.value])).toEqual([["unsourced", "Zenith"]]);
  });

  it("the entry source must still pass (a)", () => {
    const out = crossOut();
    out.resume.experience[0]!.source = "Engineer, Acme, 2019 - 2021";
    expect(kind(red(factCheck(crossOriginal, out, cross)), "source").length).toBe(1);
  });
  it("numbers and dates are checked as in #8", () => {
    const out = crossOut();
    out.resume.experience[0]!.end = "2022";
    out.resume.experience[0]!.bullets[0]!.text = "构建计费 API，服务 7 个团队。";
    const f = red(factCheck(crossOriginal, out, cross));
    expect(kind(f, "date").map((x) => x.value)).toEqual(["2022"]);
    expect(kind(f, "number").map((x) => x.value)).toEqual(["7"]);
  });
});

// ---------------------------------------------------------------- criterion 4
const basicsOriginal = "Alex Tan | alex.tan@example.com | https://example.com/alextan\n+65 9000 0000\n";
function basicsOut(patch: Partial<ReturnType<typeof emptySourced>["basics"]> = {}): TailorOutput {
  const r = emptySourced();
  r.basics = {
    name: "Alex Tan", headline: "", email: "alex.tan@example.com", phone: "+65 9000 0000",
    location: "", links: ["https://example.com/alextan"], ...patch,
  };
  return { resume: r, changes: [], notIncluded: [] };
}

describe("criterion 4: basics", () => {
  it("faithful basics give no red finding", () => {
    expect(red(factCheck(basicsOriginal, basicsOut()))).toEqual([]);
  });
  it("an email not in the original is red basics", () => {
    const f = red(factCheck(basicsOriginal, basicsOut({ email: "alex.tan1@example.com" })));
    expect(f.map((x) => [x.kind, x.value])).toEqual([["basics", "alex.tan1@example.com"]]);
  });
  it("a link not in the original is red basics", () => {
    const f = red(factCheck(basicsOriginal, basicsOut({ links: ["https://example.com/alextan", "https://example.com/other"] })));
    expect(f.map((x) => [x.kind, x.value])).toEqual([["basics", "https://example.com/other"]]);
  });
  it("email matching is whitespace-normalised", () => {
    const o = "Alex Tan\nalex.tan@example.com   \n+65 9000 0000";
    expect(red(factCheck(o, basicsOut({ links: [] })))).toEqual([]);
  });
  it("phone is compared by digits only, both ways", () => {
    expect(red(factCheck(basicsOriginal, basicsOut({ phone: "+6590000000" })))).toEqual([]);
    expect(red(factCheck("Alex Tan alex.tan@example.com\n+6590000000\n", basicsOut({ links: [] })))).toEqual([]);
  });
  it("a phone with a changed digit is red basics", () => {
    const f = red(factCheck(basicsOriginal, basicsOut({ phone: "+65 9000 0001" })));
    expect(f.map((x) => x.kind)).toEqual(["basics"]);
  });
  it("same language: a name not in the original is red basics", () => {
    const f = red(factCheck(basicsOriginal, basicsOut({ name: "Alexander Tan" })));
    expect(f.map((x) => [x.kind, x.value])).toEqual([["basics", "Alexander Tan"]]);
  });
  it("cross language: a name not found is amber basics with the check-the-name text, never red", () => {
    const f = factCheck(basicsOriginal, basicsOut({ name: "陈亚历" }), { outputLang: "zh" });
    expect(red(f)).toEqual([]);
    const a = kind(amber(f), "basics");
    expect(a).toHaveLength(1);
    expect(JSON.stringify(a[0])).toContain("请核对姓名拼写 / Check the name spelling");
  });
  it("cross language: a name found in the original gives no basics finding", () => {
    const f = factCheck(basicsOriginal, basicsOut(), { outputLang: "zh" });
    expect(kind(f, "basics")).toEqual([]);
  });
  it("cross language (zh original, en output): a Latin name not found is amber", () => {
    const o = "王小雨\nxiaoyu.wang@example.com\n+65 9000 0001";
    const f = factCheck(o, basicsOut({ name: "Wang Xiaoyu", email: "xiaoyu.wang@example.com", phone: "+65 9000 0001", links: [] }), {
      outputLang: "en",
    });
    expect(red(f)).toEqual([]);
    expect(kind(amber(f), "basics")).toHaveLength(1);
  });
  it("cross language: email, link and phone are still red when wrong", () => {
    const f = factCheck(basicsOriginal, basicsOut({ email: "a@b.com", phone: "+65 1", links: ["x.com/y"] }), { outputLang: "zh" });
    expect(kind(red(f), "basics")).toHaveLength(3);
  });
});

// ---------------------------------------------------------------- criterion 5
const itemOriginal = [
  "Skills: Java, Kafka, Spring Boot",
  "Project Atlas — Java, Kafka",
  "Languages: English, Mandarin",
].join("\n");
function itemOut(patch: { skills?: string[]; tech?: string[]; languages?: string[] }): TailorOutput {
  const r = emptySourced();
  r.skills = [{ id: "s1", name: "Tech", items: patch.skills ?? ["Java"] }];
  r.projects = [
    { id: "p1", name: "Atlas", role: "", org: "", start: "", end: "", tech: patch.tech ?? ["Java"], source: "Project Atlas — Java, Kafka", bullets: [] },
  ];
  r.languages = patch.languages ?? ["English"];
  return { resume: r, changes: [], notIncluded: [] };
}

describe("criterion 5: items", () => {
  it("items found in the original (case-insensitive, whitespace-normalised) give no finding", () => {
    const out = itemOut({ skills: ["java", "Spring   Boot"], tech: ["KAFKA"], languages: ["english", "Mandarin"] });
    expect(kind(factCheck(itemOriginal, out), "item")).toEqual([]);
  });
  it("same language: a skill, tech item or language not in the original is red item", () => {
    const f = factCheck(itemOriginal, itemOut({ skills: ["Java", "Go"], tech: ["Java", "Rust"], languages: ["English", "French"] }));
    expect(red(kind(f, "item")).map((x) => x.value).sort()).toEqual(["French", "Go", "Rust"]);
  });
  it("same language: a non-Latin item not found is red, not amber", () => {
    const f = factCheck(itemOriginal, itemOut({ languages: ["普通话"] }));
    expect(red(kind(f, "item")).map((x) => x.value)).toEqual(["普通话"]);
    expect(kind(amber(f), "item")).toEqual([]);
  });
  it("cross language: a Latin item must occur verbatim (case-insensitive), else red", () => {
    const ok = factCheck(itemOriginal, itemOut({ skills: ["kafka", "Spring Boot"] }), { outputLang: "zh" });
    expect(kind(ok, "item")).toEqual([]);
    const bad = factCheck(itemOriginal, itemOut({ skills: ["Kafka", "Spring Boots", "Rust"], tech: ["Go"] }), { outputLang: "zh" });
    expect(red(kind(bad, "item")).map((x) => x.value).sort()).toEqual(["Go", "Rust", "Spring Boots"]);
  });
  it("cross language: a non-Latin item not found is amber item (普通话 for Mandarin)", () => {
    const f = factCheck(itemOriginal, itemOut({ languages: ["英语", "普通话"] }), { outputLang: "zh" });
    expect(red(f)).toEqual([]);
    expect(kind(amber(f), "item").map((x) => x.value).sort()).toEqual(["普通话", "英语"].sort());
  });
});

// ---------------------------------------------------------------- criterion 6
describe("criterion 6: coverage of name, email and phone lines", () => {
  const cases: [string, string][] = [
    ["name", "Alex Tan, Backend Engineer"],
    ["email", "Contact: alex.tan@example.com"],
    ["phone", "Mobile +65 9000 0000"],
  ];
  it.each(cases)("a line containing the %s is covered", (_n, line) => {
    const f = factCheck(line, basicsOut({ links: [] }));
    expect(kind(f, "coverage")).toEqual([]);
  });
  it("a line with none of them is still amber coverage", () => {
    const f = factCheck("Alex Tan\nSomething else entirely", basicsOut({ links: [] }));
    expect(kind(amber(f), "coverage")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- criterion 7
describe("criterion 7: faithful pairs and mutations", () => {
  const pairs = [
    { label: "case 1 (en) -> zh", original: case1Original, make: case1ZhOutput, lang: "zh" as const, notFound: "法语", latinNew: "Spanish" },
    { label: "case 2 (zh) -> en", original: case2Original, make: case2EnOutput, lang: "en" as const, notFound: "法语", latinNew: "French" },
  ];

  for (const p of pairs) {
    describe(p.label, () => {
      const base = () => factCheck(p.original, p.make(), { outputLang: p.lang });
      /** The findings a mutation adds over the faithful baseline. */
      const added = (mutate: (o: TailorOutput) => void): Finding[] => {
        const out = p.make();
        mutate(out);
        const have = new Set(base().map((f) => f.id));
        return factCheck(p.original, out, { outputLang: p.lang }).filter((f) => !have.has(f.id));
      };

      it("gives no red finding", () => {
        expect(red(base())).toEqual([]);
      });
      it("accepts deep-frozen inputs and does not change them", () => {
        const out = deepFreeze(p.make());
        const before = JSON.stringify(out);
        const o = p.original;
        expect(() => factCheck(o, out, { outputLang: p.lang })).not.toThrow();
        expect(JSON.stringify(out)).toBe(before);
        expect(factCheck(o, out, { outputLang: p.lang })).toEqual(factCheck(o, clone(out), { outputLang: p.lang }));
      });
      it("an added skill Go gives exactly one red item", () => {
        const f = added((o) => o.resume.skills[0]!.items.push("Go"));
        expect(f.map((x) => [x.level, x.kind, x.value])).toEqual([["red", "item", "Go"]]);
      });
      it("a changed email digit gives exactly one red basics", () => {
        const f = added((o) => (o.resume.basics.email = o.resume.basics.email.replace("@", "7@")));
        expect(f.map((x) => [x.level, x.kind])).toEqual([["red", "basics"]]);
      });
      it("an added Latin-script language gives exactly one red item", () => {
        const f = added((o) => o.resume.languages.push(p.latinNew));
        expect(f.map((x) => [x.level, x.kind, x.value])).toEqual([["red", "item", p.latinNew]]);
      });
      it("an added non-Latin language gives exactly one amber item (cross-language)", () => {
        const f = added((o) => o.resume.languages.push(p.notFound));
        expect(f.map((x) => [x.level, x.kind, x.value])).toEqual([["amber", "item", p.notFound]]);
      });
      it("an invented company gives exactly one red unsourced", () => {
        const f = added((o) => (o.resume.experience[0]!.company = "Zenith"));
        expect(f.map((x) => [x.level, x.kind, x.value])).toEqual([["red", "unsourced", "Zenith"]]);
      });
    });
  }

  it("same language, the invented company is red unsourced as a whole (#8 rule)", () => {
    const out = case1Output();
    out.resume.experience[0]!.company = "Zenith Robotics";
    const f = kind(red(factCheck(case1Original, out)), "unsourced");
    expect(values(f)).toEqual(["Zenith Robotics"]);
  });
});
