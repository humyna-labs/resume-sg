/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// resume-sg#38 (amends #8 and #36): zh original with en output, items, language names, word boundaries,
// number units. Contract: factCheck(original, out, opts?: { outputLang }), LANGUAGE_NAMES. Synthetic data only.
import { describe, expect, it } from "vitest";
import { LANGUAGE_NAMES, detectLang, factCheck } from "../../src/ai/factCheck.ts";
import type { Finding, TailorOutput } from "../../src/ai/types.ts";
import { case2Original, clone, deepFreeze, emptySourced } from "../fixtures/fact-check-cases.ts";
import { case2NaturalEnOutput } from "../fixtures/fact-check-3-cases.ts";

const red = (f: Finding[]) => f.filter((x) => x.level === "red");
const kind = (f: Finding[], k: string) => f.filter((x) => (x.kind as string) === k);
const vals = (f: Finding[]) => f.map((x) => x.value).sort();

// ---------------------------------------------------------------- LANGUAGE_NAMES
describe("LANGUAGE_NAMES", () => {
  const flat = (): string[] => LANGUAGE_NAMES.flatMap((g) => [...g]);
  it("is an array of groups of names", () => {
    expect(Array.isArray(LANGUAGE_NAMES)).toBe(true);
    for (const g of LANGUAGE_NAMES) expect(g.length).toBeGreaterThanOrEqual(2);
  });
  it("holds the groups of the owner's map", () => {
    const groups = LANGUAGE_NAMES.map((g) => [...g]);
    expect(groups).toContainEqual(["普通话", "中文", "汉语", "Mandarin", "Chinese"]);
    for (const [zh, en] of [
      ["英语", "English"], ["粤语", "Cantonese"], ["马来语", "Malay"], ["泰米尔语", "Tamil"], ["印尼语", "Indonesian"],
      ["日语", "Japanese"], ["韩语", "Korean"], ["法语", "French"], ["德语", "German"], ["西班牙语", "Spanish"],
      ["越南语", "Vietnamese"], ["泰语", "Thai"],
    ] as const) {
      expect(groups.some((g) => g.includes(zh) && g.includes(en))).toBe(true);
    }
    expect(flat()).not.toContain("");
  });
});

// ---------------------------------------------------------------- criterion 2: zh original, en output, entry fields
const zhOriginal = [
  "工程师 · 青禾 · 2020 – 2021",
  "- 搭建计费系统，服务 3 个团队。",
  "项目 Atlas，Java 2020",
  "市场营销 学士 · 示例大学 · 2016 – 2020",
  "Azure 基础认证 2021",
  "读书伙伴志愿者 2019",
].join("\n");

function zhEnOut(): TailorOutput {
  const r = emptySourced();
  r.experience = [
    {
      id: "e1", company: "Qinghe Life", title: "Engineer", location: "", start: "2020", end: "2021",
      source: "工程师 · 青禾 · 2020 – 2021",
      bullets: [{ text: "Built the billing system for 3 teams.", source: "搭建计费系统，服务 3 个团队。" }],
    },
  ];
  r.projects = [
    { id: "p1", name: "Atlas project", role: "", org: "", start: "2020", end: "", tech: [], source: "项目 Atlas，Java 2020", bullets: [] },
  ];
  r.education = [
    {
      id: "d1", school: "Example University", degree: "Bachelor of Marketing", start: "2016", end: "2020", details: [],
      source: "市场营销 学士 · 示例大学 · 2016 – 2020",
    },
  ];
  r.certificates = [{ text: "Azure Fundamentals certificate 2021", source: "Azure 基础认证 2021" }];
  r.extras = [{ id: "x1", heading: "Volunteering", items: [{ text: "Reading buddy volunteer 2019", source: "读书伙伴志愿者 2019" }] }];
  return { resume: r, changes: [], notIncluded: [] };
}

describe("criterion 2: zh original, en output: entry fields are not checked against the original", () => {
  const en = { outputLang: "en" } as const;

  it("the fixture original is detected as zh", () => {
    expect(detectLang(zhOriginal)).toBe("zh");
  });
  it("English renderings give no red finding", () => {
    expect(red(factCheck(zhOriginal, zhEnOut(), en))).toEqual([]);
  });

  const fields: [string, (o: TailorOutput) => void][] = [
    ["company", (o) => (o.resume.experience[0]!.company = "Zenith Robotics")],
    ["title", (o) => (o.resume.experience[0]!.title = "Zenith Engineer")],
    ["project name", (o) => (o.resume.projects[0]!.name = "Zenith project")],
    ["school", (o) => (o.resume.education[0]!.school = "Zenith University")],
    ["degree", (o) => (o.resume.education[0]!.degree = "Zenith Bachelor")],
    ["certificate", (o) => (o.resume.certificates[0]!.text = "Zenith certificate 2021")],
    ["extras text", (o) => (o.resume.extras[0]!.items[0]!.text = "Zenith volunteer 2019")],
  ];
  it.each(fields)("%s: a Latin token absent from the original gives no finding of its own", (_n, mutate) => {
    const base = factCheck(zhOriginal, zhEnOut(), en);
    const out = zhEnOut();
    mutate(out);
    const f = factCheck(zhOriginal, out, en);
    expect(kind(f, "unsourced")).toEqual([]);
    expect(f.map((x) => x.id).sort()).toEqual(base.map((x) => x.id).sort());
  });

  it("a wrong entry source is still red source", () => {
    const out = zhEnOut();
    out.resume.experience[0]!.source = "工程师 · 青禾 · 2019 – 2021";
    expect(kind(red(factCheck(zhOriginal, out, en)), "source")).toHaveLength(1);
  });
  it("numbers and dates are checked as before", () => {
    const out = zhEnOut();
    out.resume.experience[0]!.end = "2022";
    out.resume.experience[0]!.bullets[0]!.text = "Built the billing system for 7 teams.";
    const f = red(factCheck(zhOriginal, out, en));
    expect(kind(f, "date").map((x) => x.value)).toEqual(["2022"]);
    expect(kind(f, "number").map((x) => x.value)).toEqual(["7"]);
  });
  it("en original, zh output keeps the #36 rule: a Latin token absent from the original is red unsourced", () => {
    const o = ["Engineer, Acme, 2020 - 2021", "- Built the billing API used by 3 teams."].join("\n");
    const r = emptySourced();
    r.experience = [
      {
        id: "e1", company: "Zenith", title: "工程师", location: "", start: "2020", end: "2021",
        source: "Engineer, Acme, 2020 - 2021", bullets: [],
      },
    ];
    const f = red(factCheck(o, { resume: r, changes: [], notIncluded: [] }, { outputLang: "zh" }));
    expect(f.map((x) => [x.kind, x.value])).toEqual([["unsourced", "Zenith"]]);
  });
});

// ---------------------------------------------------------------- criterion 3: items, zh original, en output
describe("criterion 3: items in zh-to-en output", () => {
  const en = { outputLang: "en" } as const;
  const orig = ["工程师 · 青禾 · 2020 – 2021", "技能：SQL、Google 云、数据看板", "项目 Atlas，Java 2020"].join("\n");
  const itemOut = (skills: string[], tech: string[] = []): TailorOutput => {
    const r = emptySourced();
    r.skills = [{ id: "s1", name: "Tech", items: skills }];
    r.projects = [
      { id: "p1", name: "Atlas", role: "", org: "", start: "", end: "", tech, source: "项目 Atlas，Java 2020", bullets: [] },
    ];
    return { resume: r, changes: [], notIncluded: [] };
  };
  const items = (f: Finding[], level: "red" | "amber") => vals(kind(f, "item").filter((x) => x.level === level));

  it("the fixture original is detected as zh", () => {
    expect(detectLang(orig)).toBe("zh");
  });
  it("an item that occurs in the original passes (case-insensitive, whitespace-normalised)", () => {
    const f = factCheck(orig, itemOut(["SQL", "sql", "数据看板", "Google  云"], ["Java", "java"]), en);
    expect(kind(f, "item")).toEqual([]);
  });
  it("a single-token Latin skill absent from the original is red item", () => {
    const f = factCheck(orig, itemOut(["Go", "Kubernetes", "AWS"]), en);
    expect(items(f, "red")).toEqual(["AWS", "Go", "Kubernetes"]);
    expect(items(f, "amber")).toEqual([]);
  });
  it("Go does not match Google (word boundary): red", () => {
    expect(items(factCheck(orig, itemOut(["Go"]), en), "red")).toEqual(["Go"]);
  });
  it("Go matches an original that contains Go as a word", () => {
    const o = ["工程师 · 青禾 · 2020 – 2021", "技能：Go, Java、数据看板"].join("\n");
    expect(detectLang(o)).toBe("zh");
    expect(kind(factCheck(o, itemOut(["Go", "Java"]), en), "item")).toEqual([]);
  });
  it("a multi-word item absent from the original is amber item", () => {
    const f = factCheck(orig, itemOut(["Data dashboards"]), en);
    expect(items(f, "amber")).toEqual(["Data dashboards"]);
    expect(items(f, "red")).toEqual([]);
  });
  it("a non-Latin item absent from the original is amber item", () => {
    const f = factCheck(orig, itemOut(["增长黑客"]), en);
    expect(items(f, "amber")).toEqual(["增长黑客"]);
    expect(items(f, "red")).toEqual([]);
  });
  it("project tech items follow the same rules", () => {
    const f = factCheck(orig, itemOut([], ["Java", "Rust", "Message queue"]), en);
    expect(items(f, "red")).toEqual(["Rust"]);
    expect(items(f, "amber")).toEqual(["Message queue"]);
  });
});

// ---------------------------------------------------------------- criterion 4: languages
describe("criterion 4: languages in both cross directions", () => {
  const zhLangOrig = ["王小雨", "擅长后端开发和系统设计，负责订单服务", "语言：英语（工作语言）、普通话（母语）"].join("\n");
  const enLangOrig = ["Alex Tan", "Languages: English, Mandarin", "Based in Thailand and Germany"].join("\n");
  const langOut = (languages: string[]): TailorOutput => ({
    resume: { ...emptySourced(), languages },
    changes: [],
    notIncluded: [],
  });
  const lang = (o: string, languages: string[], outputLang: "en" | "zh") => factCheck(o, langOut(languages), { outputLang });
  const items = (f: Finding[], level: "red" | "amber") => vals(kind(f, "item").filter((x) => x.level === level));

  it("the fixture originals are detected as zh and en", () => {
    expect(detectLang(zhLangOrig)).toBe("zh");
    expect(detectLang(enLangOrig)).toBe("en");
  });

  describe("zh original, en output", () => {
    it("English (working language) and Mandarin (native) pass", () => {
      expect(kind(lang(zhLangOrig, ["English (working language)", "Mandarin (native)"], "en"), "item")).toEqual([]);
    });
    it("any name of the group counts: Chinese passes for 普通话; english is case-insensitive", () => {
      expect(kind(lang(zhLangOrig, ["Chinese (native)", "english"], "en"), "item")).toEqual([]);
    });
    it("Japanese, Cantonese: red when neither name occurs; the proficiency is ignored", () => {
      const f = lang(zhLangOrig, ["Japanese", "Cantonese (native)", "Japanese (N2)"], "en");
      expect(items(f, "red")).toEqual(["Cantonese (native)", "Japanese", "Japanese (N2)"]);
      expect(items(f, "amber")).toEqual([]);
    });
    it("a name not in the map follows the item rules: single Latin token red, multi-word amber", () => {
      const f = lang(zhLangOrig, ["Hokkien", "Sign language"], "en");
      expect(items(f, "red")).toEqual(["Hokkien"]);
      expect(items(f, "amber")).toEqual(["Sign language"]);
    });
    it("a Chinese original that names 中文 covers Mandarin", () => {
      const o = ["王小雨", "擅长后端开发和系统设计，负责订单服务", "语言：中文"].join("\n");
      expect(kind(lang(o, ["Mandarin (native)"], "en"), "item")).toEqual([]);
    });
  });

  describe("en original, zh output", () => {
    it("英语（工作语言） and 普通话（母语） pass for English, Mandarin", () => {
      expect(kind(lang(enLangOrig, ["英语（工作语言）", "普通话（母语）", "英语 (working)"], "zh"), "item")).toEqual([]);
    });
    it("普通话 passes for an original with Mandarin; 汉语 and 中文 pass for Chinese", () => {
      expect(kind(lang("Languages: Mandarin", ["普通话"], "zh"), "item")).toEqual([]);
      expect(kind(lang("Languages: Chinese", ["汉语", "中文"], "zh"), "item")).toEqual([]);
    });
    it("日语 is red when neither name occurs; the bracketed proficiency is ignored", () => {
      const f = lang(enLangOrig, ["日语", "日语（普通话）", "日语（N2）"], "zh");
      expect(items(f, "red")).toEqual(["日语", "日语（N2）", "日语（普通话）"]);
      expect(items(f, "amber")).toEqual([]);
    });
    it("English names match whole words: 泰语 and 德语 are red for Thailand and Germany", () => {
      expect(items(lang(enLangOrig, ["泰语", "德语"], "zh"), "red")).toEqual(["德语", "泰语"]);
    });
    it("a name not in the map keeps the #36 item rule (non-Latin amber, Latin red)", () => {
      const f = lang(enLangOrig, ["闽南语", "Hokkien"], "zh");
      expect(items(f, "amber")).toEqual(["闽南语"]);
      expect(items(f, "red")).toEqual(["Hokkien"]);
    });
  });

  it("same-language output keeps the #36 language rule", () => {
    const f = lang("Languages: English, Mandarin", ["English", "French", "Mandarin"], "en");
    expect(items(f, "red")).toEqual(["French"]);
    expect(kind(factCheck("Languages: English", langOut(["English", "French"])), "item").map((x) => x.value)).toEqual(["French"]);
  });
});

// ---------------------------------------------------------------- criterion 5: word boundaries
describe("criterion 5: word boundaries", () => {
  it("same language: Go does not match Google, matches Go, Java", () => {
    const mk = (skills: string[]): TailorOutput => ({ resume: { ...emptySourced(), skills: [{ id: "s", name: "T", items: skills }] }, changes: [], notIncluded: [] });
    expect(vals(kind(red(factCheck("Skills: Google Cloud, Java", mk(["Go"]))), "item"))).toEqual(["Go"]);
    expect(kind(factCheck("Skills: Go, Java", mk(["Go", "go"])), "item")).toEqual([]);
  });
  it("the #36 Latin-token check (en original, zh output) matches whole words", () => {
    const entry = (company: string): TailorOutput => {
      const r = emptySourced();
      r.experience = [
        { id: "e1", company, title: "工程师", location: "", start: "2020", end: "2021", source: "Engineer, Google, 2020 - 2021", bullets: [] },
      ];
      return { resume: r, changes: [], notIncluded: [] };
    };
    const o = "Engineer, Google, 2020 - 2021";
    const bad = red(factCheck(o, entry("Go 科技"), { outputLang: "zh" }));
    expect(bad.map((x) => [x.kind, x.value])).toEqual([["unsourced", "Go"]]);
    expect(red(factCheck(o, entry("Google 科技"), { outputLang: "zh" }))).toEqual([]);
    expect(red(factCheck("Engineer, Go, Java, 2020 - 2021", { ...entry("go 科技"), }, { outputLang: "zh" })).filter((x) => x.kind === "unsourced")).toEqual([]);
  });
});

// ---------------------------------------------------------------- criterion 7: number units
describe("criterion 7: numbers compare by value", () => {
  type Dir = { label: string; original: (line: string) => string; make: (text: string, source: string) => TailorOutput; opts?: { outputLang: "en" | "zh" } };
  const make = (head: string) => (text: string, source: string): TailorOutput => {
    const r = emptySourced();
    r.experience = [
      { id: "e1", company: "", title: "", location: "", start: "", end: "", source: head, bullets: [{ text, source }] },
    ];
    return { resume: r, changes: [], notIncluded: [] };
  };
  const dirs: Dir[] = [
    { label: "same language (en)", original: (l) => `Engineer, Acme, 2020 - 2021\n- ${l}`, make: make("Engineer, Acme, 2020 - 2021") },
    { label: "same language (zh)", original: (l) => `工程师 · 青禾 · 2020 – 2021\n- ${l}`, make: make("工程师 · 青禾 · 2020 – 2021") },
    { label: "zh original, en output", original: (l) => `工程师 · 青禾 · 2020 – 2021\n- ${l}`, make: make("工程师 · 青禾 · 2020 – 2021"), opts: { outputLang: "en" } },
    { label: "en original, zh output", original: (l) => `Engineer, Acme, 2020 - 2021\n- ${l}`, make: make("Engineer, Acme, 2020 - 2021"), opts: { outputLang: "zh" } },
  ];
  // [text in the source line, text in the output, equal by value]
  const pairs: [string, string, boolean][] = [
    ["新增 18 万 用户", "added 180,000 users", true],
    ["added 180,000 users", "新增 18 万 用户", true],
    ["added 180k users", "新增 18 万 用户", true],
    ["新增 18 万 用户", "added 180k users", true],
    ["added 180K users", "added 180,000 users", true],
    ["raised 1.2 万", "raised 12,000", true],
    ["raised 12,000", "raised 1.2 万", true],
    ["budget S$5k", "budget 5,000", true],
    ["budget 5,000", "budget S$5k", true],
    ["3 千 orders", "3,000 orders", true],
    ["3,000 orders", "3k orders", true],
    ["2 亿 views", "200,000,000 views", true],
    ["1.5m views", "1,500,000 views", true],
    ["1,500,000 views", "1.5M views", true],
    ["新增 18 万 用户", "added 18,000 users", false],
    ["新增 18 万 用户", "added 18 users", false],
    ["added 180,000 users", "新增 18 千 用户", false],
    ["added 180k users", "added 180m users", false],
  ];
  for (const d of dirs) {
    describe(d.label, () => {
      it.each(pairs)("source %j, output %j: equal by value = %s", (src, text, equal) => {
        const f = factCheck(d.original(src), d.make(text, src), d.opts);
        const n = kind(red(f), "number");
        if (equal) expect(n).toEqual([]);
        else expect(n.length).toBeGreaterThan(0);
      });
    });
  }
  it("the summary compares by value against the whole original", () => {
    const r = emptySourced();
    r.summary = "Added 180,000 users";
    expect(kind(factCheck("新增注册用户 18 万", { resume: r, changes: [], notIncluded: [] }, { outputLang: "en" }), "number")).toEqual([]);
  });
});

// ---------------------------------------------------------------- criterion 6: pair (5)
describe("criterion 6: case 2 (zh) with a natural English output", () => {
  const en = { outputLang: "en" } as const;
  const base = () => factCheck(case2Original, case2NaturalEnOutput(), en);
  const added = (mutate: (o: TailorOutput) => void): Finding[] => {
    const out = case2NaturalEnOutput();
    mutate(out);
    const have = new Set(base().map((f) => f.id));
    return factCheck(case2Original, out, en).filter((f) => !have.has(f.id));
  };

  it("gives no red finding", () => {
    expect(red(base())).toEqual([]);
  });
  it("the 180,000 bullet uses its exact source", () => {
    const b = case2NaturalEnOutput().resume.experience[0]!.bullets[1]!;
    expect(b.text).toBe("Planned 12 acquisition campaigns that added 180,000 new registered users");
    expect(case2Original).toContain(b.source);
  });
  it("an added skill Kubernetes gives exactly one red item", () => {
    const f = added((o) => o.resume.skills[0]!.items.push("Kubernetes"));
    expect(f.map((x) => [x.level, x.kind, x.value])).toEqual([["red", "item", "Kubernetes"]]);
  });
  it("an added language Japanese gives exactly one red item", () => {
    const f = added((o) => o.resume.languages.push("Japanese"));
    expect(f.map((x) => [x.level, x.kind, x.value])).toEqual([["red", "item", "Japanese"]]);
  });
  it("a changed email digit gives exactly one red basics", () => {
    const f = added((o) => (o.resume.basics.email = o.resume.basics.email.replace("@", "7@")));
    expect(f.map((x) => [x.level, x.kind])).toEqual([["red", "basics"]]);
  });
});

// ---------------------------------------------------------------- criterion 8: purity
describe("criterion 8: pure functions", () => {
  it("accepts deep-frozen inputs, does not change them, and is repeatable", () => {
    const out = deepFreeze(case2NaturalEnOutput());
    const before = JSON.stringify(out);
    const run = () => factCheck(case2Original, out, { outputLang: "en" });
    expect(run).not.toThrow();
    expect(JSON.stringify(out)).toBe(before);
    expect(run()).toEqual(factCheck(case2Original, clone(out), { outputLang: "en" }));
  });
});
