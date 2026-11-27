// resume-sg#47 criteria 1 (block rule), 3 (coverage) and 5 (item gloss) for src/ai/factCheck.ts. Synthetic data only.
//
// Contract used here (the issue leaves the shape of a finding open, so these tests fix it):
//  - a value found only elsewhere in the original keeps its kind ("date" or "number"), its `where` and its `value`
//    (the raw date or number, as for red) and has level "amber"; red is kept for a value that occurs nowhere.
import { describe, expect, it } from "vitest";
import { factCheck } from "../../src/ai/factCheck.ts";
import type { Finding, SourcedProject, TailorOutput } from "../../src/ai/types.ts";
import { emptySourced } from "../fixtures/fact-check-cases.ts";

const of = (f: Finding[], kind: Finding["kind"]) => f.filter((x) => x.kind === kind);
const sig = (f: Finding[]) => f.map((x) => `${x.level}:${x.kind}:${x.where}:${x.value}`);

/** 12 filler lines; `at` maps a line index to its text. Filler lines hold no digits and no number words. */
function lines(at: Record<number, string>, n = 14): string[] {
  const filler = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november"];
  return Array.from({ length: n }, (_, i) => at[i] ?? `Filler line ${filler[i]}`);
}

const HEAD = "Engineer, Acme";
const entry = (source: string, extra: Partial<TailorOutput["resume"]["experience"][0]> = {}) => ({
  id: "e1", company: "Acme", title: "Engineer", location: "", start: "", end: "", source, bullets: [], ...extra,
});
const wrap = (r: ReturnType<typeof emptySourced>): TailorOutput => ({ resume: r, changes: [], notIncluded: [] });

// ---------------------------------------------------------------- dates: where the date line sits relative to the source
describe("criterion 1 (A): a date of an entry passes in the source or its block, is amber elsewhere, red nowhere", () => {
  // The source is line 5 only. Its block is lines 4 to 8 (1 before, 3 after).
  const SRC_AT = 5;
  const run = (dateAt: number | null, start = "2021-03", end = "2022-05", dateLine = "2021.03 - 2022.05") => {
    const original = lines(dateAt === null ? { [SRC_AT]: HEAD } : { [SRC_AT]: HEAD, [dateAt]: dateLine }).join("\n");
    const r = emptySourced();
    r.experience = [entry(HEAD, { start, end })];
    return factCheck(original, wrap(r));
  };

  it("a date on its own line directly under the heading (inside the block) is no finding", () => {
    expect(of(run(6), "date")).toEqual([]);
    expect(of(run(6), "unsourced")).toEqual([]);
  });
  it("a date 3 lines after the source (last line of the block) is no finding", () => {
    expect(of(run(8), "date")).toEqual([]);
  });
  it("a date 1 line before the source (first line of the block) is no finding", () => {
    expect(of(run(4), "date")).toEqual([]);
  });
  it("a date 4 lines after the source (outside the block) is amber, one finding per date field", () => {
    const f = of(run(9), "date");
    expect(sig(f)).toEqual(["amber:date:experience[0].start:2021-03", "amber:date:experience[0].end:2022-05"]);
  });
  it("a date 2 lines above the source (outside the block) is amber", () => {
    const f = of(run(3), "date");
    expect(f.map((x) => x.level)).toEqual(["amber", "amber"]);
  });
  it("a date on the first line of the original, far from the source, is amber", () => {
    expect(of(run(0), "date").map((x) => x.level)).toEqual(["amber", "amber"]);
  });
  it("a date found nowhere is red", () => {
    const f = of(run(null), "date");
    expect(sig(f)).toEqual(["red:date:experience[0].start:2021-03", "red:date:experience[0].end:2022-05"]);
  });
  it("only the field that is outside the block is amber; the one inside passes; the one nowhere is red", () => {
    const original = lines({ [SRC_AT]: HEAD, [6]: "2021.03", [12]: "June 2022" }).join("\n");
    const r = emptySourced();
    r.experience = [entry(HEAD, { start: "2021-03", end: "2022-06" })];
    expect(sig(of(factCheck(original, wrap(r)), "date"))).toEqual(["amber:date:experience[0].end:2022-06"]);
    r.experience = [entry(HEAD, { start: "2021-03", end: "2023-01" })];
    expect(sig(of(factCheck(original, wrap(r)), "date"))).toEqual(["red:date:experience[0].end:2023-01"]);
  });
  it("a date inside the source itself is no finding (as before)", () => {
    const src = `${HEAD}, 2021.03 - 2022.05`;
    const original = lines({ [SRC_AT]: src }).join("\n");
    const r = emptySourced();
    r.experience = [entry(src, { start: "2021-03", end: "2022-05" })];
    expect(of(factCheck(original, wrap(r)), "date")).toEqual([]);
  });
  it("a present/至今 marker follows the same rule", () => {
    const original = lines({ [SRC_AT]: HEAD, [10]: "2021.03 - 至今" }).join("\n");
    const r = emptySourced();
    r.experience = [entry(HEAD, { start: "", end: "present" })];
    expect(sig(of(factCheck(original, wrap(r)), "date"))).toEqual(["amber:date:experience[0].end:present"]);
  });

  describe("a source of several lines: the block runs from 1 line before the first line to 3 after the last", () => {
    // source = lines 5 and 6; block = lines 4 to 9
    const SRC = `${HEAD}\nTeam lead`;
    const multi = (dateAt: number) => {
      const original = lines({ [5]: HEAD, [6]: "Team lead", [dateAt]: "2021.03" }).join("\n");
      const r = emptySourced();
      r.experience = [entry(SRC, { start: "2021-03" })];
      return of(factCheck(original, wrap(r)), "date");
    };
    it("3 lines after the last source line is inside", () => expect(multi(9)).toEqual([]));
    it("1 line before the first source line is inside", () => expect(multi(4)).toEqual([]));
    it("4 lines after the last source line is outside: amber", () => expect(multi(10).map((x) => x.level)).toEqual(["amber"]));
    it("2 lines before the first source line is outside: amber", () => expect(multi(3).map((x) => x.level)).toEqual(["amber"]));
  });

  it("education dates follow the rule: inside passes, elsewhere amber, nowhere red", () => {
    const SCHOOL = "BSc Physics, Example University";
    const mk = (original: string, start: string, end: string) => {
      const r = emptySourced();
      r.education = [{ id: "d1", school: "Example University", degree: "BSc Physics", start, end, details: [], source: SCHOOL }];
      return sig(of(factCheck(original, wrap(r)), "date"));
    };
    const near = lines({ [5]: SCHOOL, [6]: "2011.09 - 2015.06" }).join("\n");
    const far = lines({ [5]: SCHOOL, [12]: "2011.09 - 2015.06" }).join("\n");
    expect(mk(near, "2011-09", "2015-06")).toEqual([]);
    expect(mk(far, "2011-09", "2015-06")).toEqual(["amber:date:education[0].start:2011-09", "amber:date:education[0].end:2015-06"]);
    expect(mk(near, "2011-09", "2016-06")).toEqual(["red:date:education[0].end:2016-06"]);
  });

  it("a project's dates may come from its parent experience's source or block", () => {
    const EXP = "Engineer, Acme, 2021.03 - 2022.05";
    const original = lines({ [5]: EXP, [6]: "- Built the Atlas billing tool." }).join("\n");
    const r = emptySourced();
    r.experience = [entry(EXP, { start: "2021-03", end: "2022-05" })];
    const p: SourcedProject = {
      id: "p1", name: "Atlas", role: "", org: "", start: "2021-03", end: "2022-05", tech: [], experienceId: "e1",
      source: "- Built the Atlas billing tool.", bullets: [],
    };
    r.projects = [p];
    expect(of(factCheck(original, wrap(r)), "date")).toEqual([]);
    p.start = "2019-01";
    expect(sig(of(factCheck(original, wrap(r)), "date"))).toEqual(["red:date:projects[0].start:2019-01"]);
  });
});

// ---------------------------------------------------------------- numbers
describe("criterion 1 (A): a number in an entry field or bullet passes in the source, its block, or the parent's source or block", () => {
  // Lines: 5 = entry source, 6 = bullet 1, 7 = bullet 2. Entry block = lines 4 to 8 (source is line 5 only).
  // Bullet 2 (line 7) block = lines 6 to 10. Bullet 1 (line 6) block = lines 5 to 9.
  const ENTRY = "Engineer, Acme, 2020 - 2021";
  const B1 = "- Built the billing API.";
  const B2 = "- Wrote the runbooks.";
  const mk = (at: Record<number, string>, text: string, which: 0 | 1 = 1, entrySource = ENTRY) => {
    const original = lines({ [5]: ENTRY, [6]: B1, [7]: B2, ...at }).join("\n");
    const r = emptySourced();
    r.experience = [
      entry(entrySource, {
        start: "2020", end: "2021",
        bullets: [
          { text: which === 0 ? text : "Built the billing API.", source: B1 },
          { text: which === 1 ? text : "Wrote the runbooks.", source: B2 },
        ],
      }),
    ];
    return of(factCheck(original, wrap(r)), "number");
  };

  it("in the bullet's own source: no finding", () => {
    const original = lines({ [5]: ENTRY, [6]: "- Built the billing API for 7 teams." }).join("\n");
    const r = emptySourced();
    r.experience = [entry(ENTRY, { start: "2020", end: "2021", bullets: [{ text: "Built the billing API for 7 teams.", source: "- Built the billing API for 7 teams." }] })];
    expect(of(factCheck(original, wrap(r)), "number")).toEqual([]);
  });
  it("in the bullet's block (3 lines after its source): no finding, even outside the entry's block", () => {
    // bullet 2 is line 7, so line 10 is in its block but not in the entry's block (4 to 8)
    expect(mk({ 10: "Served 7 teams" }, "Wrote the runbooks for 7 teams.")).toEqual([]);
  });
  it("in the parent entry's block but outside the bullet's block: no finding", () => {
    // line 4 is in the entry's block, not in bullet 2's block (6 to 10)
    expect(mk({ 4: "Team of 7 people" }, "Wrote the runbooks for 7 teams.")).toEqual([]);
  });
  it("in the parent entry's source: no finding", () => {
    const src = "Engineer, Acme, 2020 - 2021, team of 7";
    const original = lines({ [5]: src, [6]: B1, [7]: B2 }).join("\n");
    const r = emptySourced();
    r.experience = [entry(src, { start: "2020", end: "2021", bullets: [{ text: "Led 7 engineers.", source: B1 }] })];
    expect(of(factCheck(original, wrap(r)), "number")).toEqual([]);
  });
  it("only elsewhere in the original (outside both blocks): amber, with the number as value", () => {
    const f = mk({ 12: "Served 7 teams" }, "Wrote the runbooks for 7 teams.");
    expect(sig(f)).toEqual(["amber:number:experience[0].bullets[1]:7"]);
  });
  it("just outside the bullet's block (4 lines after its source) and outside the entry's: amber", () => {
    expect(mk({ 11: "Served 7 teams" }, "Wrote the runbooks for 7 teams.").map((x) => x.level)).toEqual(["amber"]);
  });
  it("nowhere in the original: red", () => {
    expect(sig(mk({}, "Wrote the runbooks for 7 teams."))).toEqual(["red:number:experience[0].bullets[1]:7"]);
  });
  it("number words follow the same rule: 'two' passes for a 2 in the block, is amber for a 2 elsewhere, red for no 2", () => {
    expect(mk({ 8: "2 reviewers" }, "Wrote the runbooks with two reviewers.")).toEqual([]);
    expect(sig(mk({ 12: "2 reviewers" }, "Wrote the runbooks with two reviewers."))).toEqual(["amber:number:experience[0].bullets[1]:two"]);
    expect(sig(mk({}, "Wrote the runbooks with two reviewers."))).toEqual(["red:number:experience[0].bullets[1]:two"]);
  });
  it("Chinese number words follow the same rule", () => {
    expect(mk({ 8: "共 3 人" }, "写了运行手册，三人评审。").map((x) => x.level)).toEqual([]);
    expect(mk({ 12: "共 3 人" }, "写了运行手册，三人评审。").map((x) => x.level)).toEqual(["amber"]);
    expect(mk({}, "写了运行手册，三人评审。").map((x) => x.level)).toEqual(["red"]);
  });
  it("a number up to 10 (here 9) follows the same rule as any other", () => {
    expect(mk({ 12: "9 teams" }, "Wrote 9 runbooks.").map((x) => x.level)).toEqual(["amber"]);
    expect(mk({ 8: "9 teams" }, "Wrote 9 runbooks.")).toEqual([]);
  });
  it("a project bullet follows the same rule through its project and its parent experience", () => {
    const P = "- Built the Atlas tool.";
    const original = lines({ [5]: ENTRY, [6]: P, [12]: "7 teams" }).join("\n");
    const r = emptySourced();
    r.experience = [entry(ENTRY, { start: "2020", end: "2021" })];
    r.projects = [
      { id: "p1", name: "Atlas", role: "", org: "", start: "", end: "", tech: [], experienceId: "e1", source: P, bullets: [{ text: "Served 7 teams.", source: P }] },
    ];
    expect(sig(of(factCheck(original, wrap(r)), "number"))).toEqual(["amber:number:projects[0].bullets[0]:7"]);
  });
  it("summary numbers keep the #8 rule: anywhere in the original is fine, nowhere is red", () => {
    const original = lines({ [5]: ENTRY, [12]: "Served 7 teams" }).join("\n");
    const r = emptySourced();
    r.experience = [entry(ENTRY, { start: "2020", end: "2021" })];
    r.summary = "Engineer who served 7 teams";
    expect(of(factCheck(original, wrap(r)), "number")).toEqual([]);
    r.summary = "Engineer who served 8 teams";
    expect(sig(of(factCheck(original, wrap(r)), "number"))).toEqual(["red:number:summary:8"]);
  });
});

// ---------------------------------------------------------------- criterion 3: coverage
describe("criterion 3 (C): coverage ignores lines without letters, digits or CJK, and strips markdown", () => {
  const cover = (original: string, sources: string[]) => {
    const r = emptySourced();
    r.certificates = sources.map((s) => ({ text: s, source: s }));
    return of(factCheck(original, wrap(r)), "coverage");
  };
  it("---, ***, ___ and |---|---| lines never give a coverage finding", () => {
    expect(cover("Alpha task\n---\n***\n|---|---|\n| --- | --- |\n===\nBravo task", ["Alpha task", "Bravo task"])).toEqual([]);
  });
  it("a line of punctuation and spaces only never gives a coverage finding", () => {
    expect(cover("Alpha task\n  - - -  \n* * *\n. . .\nBravo task", ["Alpha task", "Bravo task"])).toEqual([]);
  });
  it("a line with a letter, a digit or a CJK character still does", () => {
    const f = cover("---\nx\n7\n汉\n***", []);
    expect(f.map((x) => x.value)).toEqual(["x", "7", "汉"]);
  });
  it("the reported value has its markdown and list markers stripped (#, >, *, _, `, |, -, •, ·, 1.)", () => {
    const f = cover("## Heading line\n> Quoted line\n**Bold line**\n_Italic line_\n`Code line`\n| Cell one | Cell two |\n- Dash line\n* Star line\n• Dot line\n· Mid line\n1. Numbered line", []);
    expect(f.map((x) => x.value)).toEqual([
      "Heading line", "Quoted line", "Bold line", "Italic line", "Code line", "Cell one Cell two", "Dash line", "Star line", "Dot line", "Mid line", "Numbered line",
    ].map((v) => (v === "Cell one Cell two" ? expect.stringMatching(/^Cell one\s*\|?\s*Cell two$/) : v)));
  });
  it("`**海港支付** · 2021.03` is covered by the source `海港支付 · 2021.03`", () => {
    expect(cover("**海港支付** · 2021.03", ["海港支付 · 2021.03"])).toEqual([]);
  });
  it("a markdown source covers a plain original line and the other way round", () => {
    expect(cover("海港支付 · 2021.03 · 清算负责人", ["**海港支付** · 2021.03"])).toEqual([]);
    expect(cover("**海港支付** · 2021.03 · 清算负责人", ["海港支付 · 2021.03"])).toEqual([]);
  });
  it("a heading line (## ...) is covered by a source that has the heading text without its marks", () => {
    expect(cover("### Senior Engineer at Acme", ["Senior Engineer at Acme"])).toEqual([]);
  });
  it("an uncovered markdown line is still amber coverage", () => {
    expect(cover("**Bravo task**", ["Alpha task"]).map((x) => x.value)).toEqual(["Bravo task"]);
  });
  it("the where of a coverage finding still points at the original line number", () => {
    const f = cover("Alpha task\n---\n**Bravo task**", ["Alpha task"]);
    expect(f.map((x) => x.where)).toEqual(["original:line 3"]);
  });
});

// ---------------------------------------------------------------- criterion 5: item gloss
describe("criterion 5 (E): an item is compared by its text before a bracketed gloss as well as in full", () => {
  const orig = "技能：Java、LiteFlow、Docker\n规则引擎说明：配置化";
  const origEn = "Skills: Java, LiteFlow, Docker\nrule engine notes";
  const mk = (original: string, items: string[], tech: string[] = [], lang?: "en" | "zh") => {
    const r = emptySourced();
    r.skills = [{ id: "s1", name: "Tech", items }];
    r.projects = [{ id: "p1", name: "", role: "", org: "", start: "", end: "", tech, source: "", bullets: [] }];
    return of(factCheck(original, wrap(r), lang ? { outputLang: lang } : undefined), "item");
  };
  it("full-width gloss: 'LiteFlow（规则引擎）' passes when LiteFlow is in the original", () => {
    expect(mk(orig, ["LiteFlow（规则引擎）"])).toEqual([]);
  });
  it("half-width gloss: 'LiteFlow (rule engine)' passes when LiteFlow is in the original", () => {
    expect(mk(origEn, ["LiteFlow (rule engine)"])).toEqual([]);
    expect(mk(orig, ["LiteFlow (rule engine)"])).toEqual([]);
  });
  it("also for project tech items, and across languages (zh original, en output)", () => {
    expect(mk(orig, [], ["LiteFlow (rule engine)"])).toEqual([]);
    expect(mk(orig, ["LiteFlow (rule engine)"], [], "en")).toEqual([]);
    expect(mk(origEn, ["LiteFlow（规则引擎）"], [], "zh")).toEqual([]);
  });
  it("the whole item in the original still passes", () => {
    expect(mk("Skills: LiteFlow (rule engine), Java", ["LiteFlow (rule engine)"])).toEqual([]);
  });
  it("the base before the gloss must be in the original: 'Redis（规则引擎）' is flagged although the gloss text is there", () => {
    const f = mk(orig, ["Redis（规则引擎）"]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ level: "red", kind: "item", value: "Redis（规则引擎）" });
  });
  it("the gloss alone never makes an item pass: '（规则引擎）' and '(rule engine)' are flagged", () => {
    expect(mk(origEn, ["(rule engine)"])).toHaveLength(1);
    expect(mk(orig, ["（规则引擎）"])).toHaveLength(1);
  });
  it("a base that only matches inside a longer word does not pass ('Light' vs LiteFlow)", () => {
    expect(mk(orig, ["Lite（轻量）"])).toHaveLength(1);
  });
});
