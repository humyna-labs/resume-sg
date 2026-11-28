/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// resume-sg#8 (brief v5.2 section 4): factCheck(original, out) -> Finding[], pure, no AI.
// Contract: src/ai/types.ts, src/ai/factCheck.ts. Synthetic data only.
import { afterEach, describe, expect, it, vi } from "vitest";
import { factCheck, normalise, unresolvedCount } from "../../src/ai/factCheck.ts";
import type { Decision, Finding, TailorOutput } from "../../src/ai/types.ts";
import {
  case1Hackathon,
  case1Original,
  case1Output,
  case2Annual,
  case2Original,
  case2Output,
  clone,
  deepFreeze,
  emptySourced,
} from "../fixtures/fact-check-cases.ts";

const red = (f: Finding[]) => f.filter((x) => x.level === "red");
const amber = (f: Finding[]) => f.filter((x) => x.level === "amber");
const kinds = (f: Finding[], k: Finding["kind"]) => f.filter((x) => x.kind === k);

// One experience entry whose source is the whole first line; bullets are the following lines.
function oneEntry(opts: {
  dates: string;
  start: string;
  end: string;
  bullets?: { text: string; source: string }[];
  summary?: string;
  extraOriginal?: string;
}): { original: string; out: TailorOutput } {
  const head = `Engineer, Acme, ${opts.dates}`;
  const bullets = opts.bullets ?? [];
  const original = [head, ...bullets.map((b) => `- ${b.source}`), opts.extraOriginal ?? ""].join("\n");
  const resume = emptySourced();
  resume.summary = opts.summary ?? "";
  resume.experience = [
    { id: "e1", company: "Acme", title: "Engineer", location: "", start: opts.start, end: opts.end, source: head, bullets },
  ];
  return { original, out: { resume, changes: [], notIncluded: [] } };
}

const bulletCase = (text: string, source: string) =>
  oneEntry({ dates: "2020 - 2021", start: "2020", end: "2021", bullets: [{ text, source }] });

describe("normalise", () => {
  it("collapses runs of space, tab and newline to one space and trims", () => {
    expect(normalise("  a \t b\n\n c\r\n d  ")).toBe("a b c d");
    expect(normalise("")).toBe("");
  });
});

describe("criterion 1 (a): sources occur in the original", () => {
  it("whitespace and line-break differences never cause a finding", () => {
    const original = "Built   the\tpayment\nAPI for   merchants\n\nShipped it";
    const { out } = bulletCase("Built the payment API", "Built the payment API");
    out.resume.experience = [];
    out.resume.certificates = [{ text: "x", source: "Built the payment API" }];
    out.notIncluded = [{ source: "  API for merchants  Shipped\nit " }];
    expect(kinds(factCheck(original, out), "source")).toEqual([]);
  });

  it("a changed character gives a red source finding at the bullet path", () => {
    const { original, out } = bulletCase("Built the payment API", "Built the payment API");
    out.resume.experience[0]!.bullets[0]!.source = "Built the payment APl"; // I -> l
    const f = kinds(factCheck(original, out), "source");
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ level: "red", where: "experience[0].bullets[0]" });
  });

  it("checks the entry source, certificates, extras items and notIncluded", () => {
    const original = "Engineer, Acme, 2020 - 2021\nCert A (2020)\nAward line one";
    const resume = emptySourced();
    resume.experience = [
      { id: "e1", company: "Acme", title: "Engineer", location: "", start: "2020", end: "2021", source: "Engineer, Acme, 2020 - 2022", bullets: [] },
    ];
    resume.certificates = [{ text: "Cert A", source: "Cert B (2020)" }];
    resume.extras = [{ id: "x1", heading: "Awards", items: [{ text: "Award", source: "Award line two" }] }];
    const f = kinds(factCheck(original, { resume, changes: [], notIncluded: [{ source: "Nothing here" }] }), "source");
    const wheres = f.map((x) => x.where);
    expect(wheres).toContain("experience[0]");
    expect(wheres).toContain("certificates[0]");
    expect(wheres).toContain("extras[0].items[0]");
    expect(wheres.some((w) => w.startsWith("notIncluded[0]"))).toBe(true);
    expect(f.every((x) => x.level === "red")).toBe(true);
  });
});

describe("criterion 2 (b): numbers", () => {
  const passing: [string, string, string][] = [
    ["1200 = 1,200", "Handled 1200 requests", "Handled 1,200 requests"],
    ["1,200 = 1200", "Handled 1,200 requests", "Handled 1200 requests"],
    ["40% = 40 %", "Cut incidents by 40%", "Cut incidents by 40 %"],
    ["40 % = 40%", "Cut incidents by 40 %", "Cut incidents by 40%"],
    ["decimal 6.2%", "Raised rate to 6.2%", "Raised rate to 6.2%"],
    ["money S$5k", "Saved S$5k a month", "Saved S$5k a month"],
    ["money ¥3,000 = ¥3000", "Saved ¥3,000", "Saved ¥3000"],
    ["money $1.2M", "Closed $1.2M deal", "Closed $1.2M deal"],
    ["five = 5", "Led five engineers", "Led 5 engineers"],
    ["5 = five", "Led 5 engineers", "Led five engineers"],
    ["ten = 10", "Ran ten workshops", "Ran 10 workshops"],
    ["两 = 2", "带领两名工程师", "带领 2 名工程师"],
    ["2 = 两", "带领 2 名工程师", "带领两名工程师"],
    ["三 = 3", "完成三次测试", "做过 3 次测试"],
    ["十 = 10", "管理十人团队", "管理 10 人团队"],
    ["translation keeps numbers (zh bullet, en source)", "提升 40%", "Incidents fell 40% year on year"],
    ["translation keeps numbers (en bullet, zh source)", "Raised conversion from 6.2% to 9.1%", "转化率从 6.2% 提升到 9.1%"],
    ["no numbers at all", "Led the team", "Led the team"],
  ];
  for (const [name, text, source] of passing)
    it(`passes: ${name}`, () => {
      const { original, out } = bulletCase(text, source);
      expect(kinds(factCheck(original, out), "number")).toEqual([]);
    });

  const failing: [string, string, string, string[]][] = [
    ["different digit", "Led 7 engineers", "Led 5 engineers", ["7"]],
    ["5 is not 15", "Managed 5 engineers", "Managed 15 engineers", ["5"]],
    ["added number", "Led 5 engineers across 12 regions", "Led 5 engineers", ["12"]],
    ["number word not in source", "Delivered in five weeks", "Delivered in 6 weeks", ["five", "5"]],
    ["Chinese number word 五 vs 4", "拥有五年经验", "拥有 4 年经验", ["五", "5"]],
    ["percent changed", "Cut cost by 45%", "Cut cost by 40%", ["45%", "45"]],
    ["money changed", "Closed $1.3M deal", "Closed $1.2M deal", ["$1.3M", "1.3"]],
  ];
  for (const [name, text, source, values] of failing)
    it(`red number: ${name}`, () => {
      const { original, out } = bulletCase(text, source);
      const f = kinds(factCheck(original, out), "number");
      expect(f.length).toBeGreaterThan(0);
      expect(f[0]).toMatchObject({ level: "red", where: "experience[0].bullets[0]" });
      expect(values).toContain(f[0]!.value);
    });

  it("a summary number may come from anywhere in the original", () => {
    const { original, out } = oneEntry({
      dates: "2020 - 2021",
      start: "2020",
      end: "2021",
      bullets: [{ text: "Cut cost by 40%", source: "Cut cost by 40%" }],
      summary: "Engineer who cut cost by 40%",
    });
    expect(kinds(factCheck(original, out), "number")).toEqual([]);
  });

  it("a summary number missing from the whole original is red at summary", () => {
    const { original, out } = oneEntry({
      dates: "2020 - 2021",
      start: "2020",
      end: "2021",
      summary: "Engineer with 12 years of experience",
    });
    const f = kinds(factCheck(original, out), "number");
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ level: "red", where: "summary", value: "12" });
  });
});

describe("criterion 3 (c): unsourced facts", () => {
  it("employer, title, school and degree must occur in their entry source", () => {
    const { original, out } = oneEntry({ dates: "2020 - 2021", start: "2020", end: "2021" });
    out.resume.experience[0]!.company = "Globex";
    out.resume.experience[0]!.title = "Director";
    out.resume.education = [
      { id: "d1", school: "Nowhere Uni", degree: "PhD", start: "", end: "", details: [], source: "Engineer, Acme, 2020 - 2021" },
    ];
    const wheres = kinds(factCheck(original, out), "unsourced").map((x) => x.where);
    expect(wheres).toEqual(
      expect.arrayContaining(["experience[0].company", "experience[0].title", "education[0].school", "education[0].degree"]),
    );
  });

  it("a certificate whose text is not in its (valid) source is red unsourced", () => {
    const original = "Engineer, Acme\nAWS Certified Solutions Architect (2022)";
    const resume = emptySourced();
    resume.certificates = [{ text: "Google Cloud Professional Architect", source: "AWS Certified Solutions Architect (2022)" }];
    const f = factCheck(original, { resume, changes: [], notIncluded: [{ source: "Engineer, Acme" }] });
    const u = kinds(f, "unsourced");
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ level: "red" });
    expect(u[0]!.where.startsWith("certificates[0]")).toBe(true);
  });

  it("a certificate whose source is not in the original is red source and red unsourced", () => {
    const original = "Engineer, Acme";
    const resume = emptySourced();
    resume.certificates = [{ text: "PMP", source: "PMP certified 2020" }];
    const f = factCheck(original, { resume, changes: [], notIncluded: [{ source: "Engineer, Acme" }] });
    expect(kinds(f, "source").map((x) => x.where)).toContain("certificates[0]");
    const u = kinds(f, "unsourced").filter((x) => x.where.startsWith("certificates[0]"));
    expect(u).toHaveLength(1);
    expect(u[0]!.level).toBe("red");
  });

  it("a valid certificate gives no finding", () => {
    const original = "PMP (2020)\nCertificates"; // #52: the source is the whole line (a 42% source would be weak)
    const resume = emptySourced();
    resume.certificates = [{ text: "PMP (2020)", source: "PMP (2020)" }];
    expect(red(factCheck(original, { resume, changes: [], notIncluded: [] }))).toEqual([]);
  });

  it("an extras item whose text is not in its (valid) source is red unsourced at extras[0].items[1]", () => {
    const original = "Volunteer lead at Food Bank\nWon hackathon 2019";
    const resume = emptySourced();
    resume.extras = [
      {
        id: "x1",
        heading: "Other",
        items: [
          { text: "Volunteer lead at Food Bank", source: "Volunteer lead at Food Bank" },
          { text: "Won national robotics prize", source: "Won hackathon 2019" },
        ],
      },
    ];
    const u = kinds(factCheck(original, { resume, changes: [], notIncluded: [] }), "unsourced");
    expect(u).toHaveLength(1);
    expect(u[0]).toMatchObject({ level: "red" });
    expect(u[0]!.where.startsWith("extras[0].items[1]")).toBe(true);
  });

  it("an extras item whose source is not in the original is red source and red unsourced", () => {
    const original = "Volunteer lead at Food Bank";
    const resume = emptySourced();
    resume.extras = [{ id: "x1", heading: "Other", items: [{ text: "Chess champion", source: "Chess champion 2018" }] }];
    const f = factCheck(original, { resume, changes: [], notIncluded: [{ source: "Volunteer lead at Food Bank" }] });
    expect(kinds(f, "source").map((x) => x.where)).toContain("extras[0].items[0]");
    expect(kinds(f, "unsourced").some((x) => x.where.startsWith("extras[0].items[0]") && x.level === "red")).toBe(true);
  });

  it("a valid extras item gives no red finding", () => {
    const original = "Won hackathon 2019";
    const resume = emptySourced();
    resume.extras = [{ id: "x1", heading: "Awards", items: [{ text: "Won hackathon 2019", source: "Won hackathon 2019" }] }];
    expect(red(factCheck(original, { resume, changes: [], notIncluded: [] }))).toEqual([]);
  });

  it("a project name must occur in its source; a valid one passes", () => {
    const original = "Atlas Router, backend lead, 2020 - 2021";
    const mk = (name: string): TailorOutput => {
      const resume = emptySourced();
      resume.projects = [
        { id: "p1", name, role: "", org: "", start: "2020", end: "2021", tech: [], source: "Atlas Router, backend lead, 2020 - 2021", bullets: [] },
      ];
      return { resume, changes: [], notIncluded: [] };
    };
    expect(red(factCheck(original, mk("Atlas Router")))).toEqual([]);
    const u = kinds(factCheck(original, mk("Orion Gateway")), "unsourced");
    expect(u).toHaveLength(1);
    expect(u[0]!.where).toBe("projects[0].name");
  });

  it("a failed entry source makes the entry's employer unsourced", () => {
    const { original, out } = oneEntry({ dates: "2020 - 2021", start: "2020", end: "2021" });
    out.resume.experience[0]!.source = "Engineer, Acme, 1999 - 2001";
    const f = factCheck(original, out);
    expect(kinds(f, "source").map((x) => x.where)).toContain("experience[0]");
    expect(kinds(f, "unsourced").some((x) => x.where === "experience[0].company")).toBe(true);
  });
});

describe("criterion 3 (c): dates must occur in the entry source after normalising formats", () => {
  const dateFindings = (f: Finding[]) => kinds(f, "date");

  // [label, dates as written in the source line, start, end]
  const same: [string, string, string, string][] = [
    ["dot range, dot values", "2019.07-2021.06", "2019.07", "2021.06"],
    ["dot range, hyphen values", "2019.07-2021.06", "2019-07", "2021-06"],
    ["dot range with spaces", "2019.07 - 2021.06", "2019.07", "2021.06"],
    ["dot range, month names", "2019.07-2021.06", "Jul 2019", "June 2021"],
    ["dot range, Chinese values", "2019.07-2021.06", "2019年7月", "2021年6月"],
    ["hyphen range, hyphen months", "2019-07-2021-06", "2019-07", "2021-06"],
    ["hyphen range, hyphen months, spaced", "2019-07 - 2021-06", "2019-07", "2021-06"],
    ["hyphen range, dot values", "2019-07-2021-06", "2019.07", "2021.06"],
    ["en dash range, month names", "Mar 2021 – Dec 2022", "March 2021", "Dec 2022"],
    ["en dash range, dot values", "Mar 2021 – Dec 2022", "2021.03", "2022-12"],
    ["Chinese source", "2021年3月 – 2022年5月", "Mar 2021", "2022.05"],
    ["Chinese source with tilde", "2021年3月~2022年5月", "2021-03", "May 2022"],
    ["Present", "Mar 2021 – Present", "2021-03", "Present"],
    ["Present = now", "Mar 2021 – Present", "March 2021", "now"],
    ["Present = 至今", "Mar 2021 – Present", "Mar 2021", "至今"],
    ["至今 = Present", "2021.07 – 至今", "2021.07", "Present"],
    ["至今 = now", "2021年7月 至今", "Jul 2021", "now"],
    ["now = 至今", "2021.03 - now", "2021-03", "至今"],
    ["year only", "2011 – 2015", "2011", "2015"],
  ];
  for (const [label, dates, start, end] of same)
    it(`passes: ${label} (${dates} vs ${start} / ${end})`, () => {
      const { original, out } = oneEntry({ dates, start, end });
      expect(red(factCheck(original, out))).toEqual([]);
    });

  const different: [string, string, string, string, "start" | "end"][] = [
    ["dot range, wrong start month", "2019.07-2021.06", "2019.08", "2021.06", "start"],
    ["dot range, wrong end year", "2019.07-2021.06", "2019.07", "2022.06", "end"],
    ["hyphen range, wrong start", "2019-07-2021-06", "2019-08", "2021-06", "start"],
    ["hyphen range, wrong end", "2019-07-2021-06", "2019-07", "2021-05", "end"],
    ["month names, wrong month", "Mar 2021 – Dec 2022", "Apr 2021", "Dec 2022", "start"],
    ["Chinese, wrong month", "2021年3月 – 2022年5月", "2021.03", "2022.06", "end"],
    ["Present but source has an end date", "2019.07-2021.06", "2019.07", "Present", "end"],
    ["end date but source says Present", "Mar 2021 – Present", "Mar 2021", "Dec 2022", "end"],
  ];
  for (const [label, dates, start, end, field] of different)
    it(`red date: ${label}`, () => {
      const { original, out } = oneEntry({ dates, start, end });
      const f = dateFindings(factCheck(original, out));
      expect(f).toHaveLength(1);
      expect(f[0]).toMatchObject({ level: "red", where: `experience[0].${field}` });
      expect(f[0]!.value).toBe(field === "start" ? start : end);
    });

  it("education dates are checked the same way", () => {
    const original = "B.Sc. Physics, Example University, 2011.09-2015.06";
    const mk = (start: string, end: string): TailorOutput => {
      const resume = emptySourced();
      resume.education = [
        { id: "d1", school: "Example University", degree: "B.Sc. Physics", start, end, details: [], source: original },
      ];
      return { resume, changes: [], notIncluded: [] };
    };
    expect(red(factCheck(original, mk("2011-09", "Jun 2015")))).toEqual([]);
    const f = dateFindings(factCheck(original, mk("2011-09", "2016-06")));
    expect(f).toHaveLength(1);
    expect(f[0]!.where).toBe("education[0].end");
  });
});

describe("criterion 4 (d): coverage", () => {
  const cover = (original: string, sources: string[]) => {
    const resume = emptySourced();
    resume.certificates = sources.map((s) => ({ text: s, source: s }));
    return factCheck(original, { resume, changes: [], notIncluded: [] });
  };

  it("an uncovered line is amber coverage with the line as value and an original:line path", () => {
    const f = amber(cover("Alpha task\nBravo task\nCharlie task", ["Alpha task", "Charlie task"]));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ kind: "coverage", level: "amber", value: "Bravo task" });
    expect(f[0]!.where.startsWith("original:line ")).toBe(true);
  });

  it("strips bullet markers - • * and 1. from the reported line", () => {
    const f = cover("- Dash item\n• Dot item\n* Star item\n1. Numbered item", []);
    expect(kinds(f, "coverage").map((x) => x.value)).toEqual(["Dash item", "Dot item", "Star item", "Numbered item"]);
  });

  it("covers a line when the source contains it, or it contains the source", () => {
    const f = cover("- Short line\n- A much longer original line with detail", ["Short line and more words", "longer original line with detail"]);
    expect(kinds(f, "coverage")).toEqual([]);
  });

  it("a notIncluded source covers a line", () => {
    const resume = emptySourced();
    const f = factCheck("Alpha task\nBravo task", { resume, changes: [], notIncluded: [{ source: "Alpha task" }, { source: "Bravo task" }] });
    expect(kinds(f, "coverage")).toEqual([]);
  });

  // Changed by resume-sg#52: a bullet, certificate, extras or notIncluded source must lie inside one line to be strong.
  it("a certificate source spanning two lines is weak: it covers neither line (resume-sg#52)", () => {
    const f = cover("First half of a\nsentence that wraps", ["First half of a sentence that wraps"]);
    expect(kinds(f, "coverage").map((x) => x.value)).toEqual(["First half of a", "sentence that wraps"]);
  });

  it("an entry source spanning two lines covers both (resume-sg#52)", () => {
    const original = "Engineer, Acme, 2020 - 2021\nBuilt the billing service";
    const resume = emptySourced();
    resume.experience = [
      { id: "e1", company: "Acme", title: "Engineer", location: "", start: "2020", end: "2021", source: original, bullets: [] },
    ];
    expect(kinds(factCheck(original, { resume, changes: [], notIncluded: [] }), "coverage")).toEqual([]);
  });

  it("ignores empty lines", () => {
    expect(kinds(cover("\n\n   \n\t\n", []), "coverage")).toEqual([]);
  });

  const headings = [
    "Experience", "Work experience", "Education", "Skills", "Projects", "Summary", "Certificates", "Languages",
    "工作经历", "教育背景", "专业技能", "项目经历", "个人简介", "自我评价", "证书", "语言",
  ];
  for (const h of headings)
    it(`ignores the heading-only line "${h}" and "${h}:"`, () => {
      expect(kinds(cover(`${h}\n${h}:\n${h}：`, []), "coverage")).toEqual([]);
    });

  it("a heading followed by content is not ignored", () => {
    const f = kinds(cover("Skills: Java, Go", []), "coverage");
    expect(f).toHaveLength(1);
    expect(f[0]!.value).toBe("Skills: Java, Go");
  });
});

describe("criterion 5: decisions", () => {
  const mk = (id: string, level: Finding["level"]): Finding => ({ id, level, kind: level === "red" ? "number" : "coverage", where: "w", value: id });
  const findings = [mk("r1", "red"), mk("r2", "red"), mk("r3", "red"), mk("a1", "amber"), mk("a2", "amber")];

  it("counts red findings without a decision; amber never counts", () => {
    expect(unresolvedCount(findings, {})).toBe(3);
    expect(unresolvedCount([mk("a1", "amber")], {})).toBe(0);
    expect(unresolvedCount([], {})).toBe(0);
  });

  it("removed and kept resolve a red finding", () => {
    const d: Record<string, Decision> = { r1: "removed", r2: "kept" };
    expect(unresolvedCount(findings, d)).toBe(1);
    expect(unresolvedCount(findings, { ...d, r3: "kept" })).toBe(0);
  });

  it("an added decision (amber) does not change the count; unknown ids are ignored", () => {
    expect(unresolvedCount(findings, { a1: "added", a2: "added", nope: "removed" })).toBe(3);
  });
});

describe("finding ids", () => {
  it("are stable for the same input and unique within a result", () => {
    const a = factCheck(case1Original, (() => { const o = case1Output(); o.resume.experience[0]!.company = "Nimbus"; return o; })());
    const b = factCheck(case1Original, (() => { const o = case1Output(); o.resume.experience[0]!.company = "Nimbus"; return o; })());
    expect(a.length).toBeGreaterThan(0);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length);
  });
});

describe("criterion 7: pure functions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not change deep-frozen inputs and returns the same result twice", () => {
    const out = deepFreeze(case1Output());
    const first = factCheck(case1Original, out);
    const second = factCheck(case1Original, out);
    expect(second).toEqual(first);
    expect(out).toEqual(case1Output());
  });

  it("uses no network, storage or randomness", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const rnd = vi.spyOn(Math, "random");
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    const mutated = case2Output();
    mutated.resume.experience[0]!.company = "星河科技";
    factCheck(case2Original, deepFreeze(mutated));
    unresolvedCount([], {});
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(rnd).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("criterion 6: sample-cases fixtures (both languages)", () => {
  type Mut = { name: string; apply: (o: TailorOutput) => void; expected: { kind: Finding["kind"]; level: Finding["level"]; where?: string; values?: string[] } };

  const suites: { label: string; original: string; build: () => TailorOutput; muts: Mut[] }[] = [
    {
      label: "case 1 (English)",
      original: case1Original,
      build: case1Output,
      muts: [
        {
          name: "invented employer",
          apply: (o) => { o.resume.experience[0]!.company = "Nimbus Payments"; },
          expected: { kind: "unsourced", level: "red", where: "experience[0].company", values: ["Nimbus Payments"] },
        },
        {
          name: "changed source",
          apply: (o) => { o.resume.experience[0]!.bullets[0]!.source = "Redesigned the settlment service; end-of-day batch time went from 4 hours to 35 minutes."; },
          expected: { kind: "source", level: "red", where: "experience[0].bullets[0]" },
        },
        {
          name: "added number",
          apply: (o) => { o.resume.experience[0]!.bullets[2]!.text += " Rolled out across 12 regions."; },
          expected: { kind: "number", level: "red", where: "experience[0].bullets[2]", values: ["12"] },
        },
        {
          name: "number word in the summary (ten vs 9)",
          apply: (o) => { o.resume.summary = "Backend engineer with ten years in fintech."; },
          expected: { kind: "number", level: "red", where: "summary", values: ["ten", "10"] },
        },
        {
          name: "changed date",
          apply: (o) => { o.resume.experience[0]!.start = "Apr 2021"; },
          expected: { kind: "date", level: "red", where: "experience[0].start", values: ["Apr 2021"] },
        },
        {
          name: "dropped original line",
          apply: (o) => { o.notIncluded = o.notIncluded.filter((n) => n.source !== case1Hackathon); },
          expected: { kind: "coverage", level: "amber", values: [case1Hackathon] },
        },
      ],
    },
    {
      label: "case 2 (中文)",
      original: case2Original,
      build: case2Output,
      muts: [
        {
          name: "invented employer",
          apply: (o) => { o.resume.experience[1]!.company = "星河科技"; },
          expected: { kind: "unsourced", level: "red", where: "experience[1].company", values: ["星河科技"] },
        },
        {
          name: "changed source",
          apply: (o) => { o.resume.experience[0]!.bullets[2]!.source = "搭建流失用户的短信和推送召回策略，30 天召回率提升 35%！"; },
          expected: { kind: "source", level: "red", where: "experience[0].bullets[2]" },
        },
        {
          name: "added number",
          apply: (o) => { o.resume.experience[0]!.bullets[1]!.text += "覆盖 88 个国家。"; },
          expected: { kind: "number", level: "red", where: "experience[0].bullets[1]", values: ["88"] },
        },
        {
          name: "number word (五次 for base 3 次)",
          apply: (o) => { o.resume.experience[1]!.bullets[1]!.text = "完成五次 A/B 测试，验证优惠券面额对下单的影响。"; },
          expected: { kind: "number", level: "red", where: "experience[1].bullets[1]", values: ["五", "5"] },
        },
        {
          name: "changed date",
          apply: (o) => { o.resume.experience[1]!.end = "2018.05"; }, // #47: red only if found nowhere; 2021.07 is elsewhere (amber)
          expected: { kind: "date", level: "red", where: "experience[1].end", values: ["2018.05"] },
        },
        {
          name: "dropped original line",
          apply: (o) => { o.notIncluded = o.notIncluded.filter((n) => n.source !== case2Annual); },
          expected: { kind: "coverage", level: "amber", values: [case2Annual] },
        },
      ],
    },
  ];

  for (const s of suites)
    describe(s.label, () => {
      it("the unmutated pair gives no finding at all", () => {
        expect(factCheck(s.original, s.build())).toEqual([]);
      });

      for (const m of s.muts)
        it(`mutation "${m.name}" gives exactly the expected finding`, () => {
          const out = s.build();
          m.apply(out);
          let f = factCheck(s.original, out);
          if (m.expected.kind === "source") {
            // resume-sg#52: numbers are checked only against a strong source, so a source that is not in the original
            // may also leave red number findings at the same bullet; nothing else may appear.
            const own = f.filter((x) => x.kind === "source");
            expect(own).toHaveLength(1);
            expect(f.filter((x) => x.kind !== "source").every((x) => x.kind === "number" && x.level === "red" && x.where === own[0]!.where)).toBe(true);
            f = own;
          }
          expect(f).toHaveLength(1);
          expect(f[0]).toMatchObject({ kind: m.expected.kind, level: m.expected.level });
          if (m.expected.where) expect(f[0]!.where).toBe(m.expected.where);
          if (m.expected.kind === "coverage") expect(f[0]!.where.startsWith("original:line ")).toBe(true);
          if (m.expected.values) expect(m.expected.values).toContain(f[0]!.value);
        });
    });

  it("a translated bullet that keeps its numbers gives no finding (zh bullet from en source)", () => {
    const out = case1Output();
    out.resume.experience[0]!.bullets[2]!.text = "引入契约测试和金丝雀发布，生产事故同比下降 40%。";
    expect(factCheck(case1Original, out)).toEqual([]);
  });

  it("a translated bullet that keeps its numbers gives no finding (en bullet from zh source)", () => {
    const out = case2Output();
    out.resume.experience[0]!.bullets[0]!.text =
      "Reworked the first-order flow and landing page with design; first-order conversion rose from 6.2% to 9.1%.";
    expect(factCheck(case2Original, out)).toEqual([]);
  });

  it("the fixtures are not changed by checking them", () => {
    const o = clone(case1Output());
    factCheck(case1Original, deepFreeze(o));
    expect(o).toEqual(case1Output());
  });
});
