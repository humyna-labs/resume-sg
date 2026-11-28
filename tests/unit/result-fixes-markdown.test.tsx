/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// resume-sg#47 criterion 9: the markdown fixture (tests/fixtures/markdown-resume.ts), zh -> zh and zh -> en.
import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { detectLang, factCheck } from "../../src/ai/factCheck.ts";
import { parseTailorOutput } from "../../src/ai/tailor.ts";
import type { Finding, TailorOutput } from "../../src/ai/types.ts";
import { toResume } from "../../src/features/tailor/apply.ts";
import { formatRange } from "../../src/resume/dates.ts";
import type { Resume } from "../../src/resume/model.ts";
import { TEMPLATES } from "../../src/templates/index.ts";
import { mdEnOutput, mdOriginal, mdZhOutput } from "../fixtures/markdown-resume.ts";

afterEach(cleanup);

const level = (f: Finding[], l: Finding["level"]) => f.filter((x) => x.level === l);
const q = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const open = (end: string) => (/^(至今|present)$/i.test(end) ? "" : end);

describe("the fixture", () => {
  it("is a Chinese markdown original with headings, ---, bold and dates on their own line", () => {
    expect(detectLang(mdOriginal)).toBe("zh");
    const lines = mdOriginal.split("\n");
    expect(lines.filter((l) => l === "---").length).toBeGreaterThanOrEqual(3);
    expect(lines.some((l) => /^#{1,3} /.test(l))).toBe(true);
    expect(lines.some((l) => /\*\*.+\*\*/.test(l))).toBe(true);
    expect(lines).toContain("2021.03 - 至今");
  });
  it("both outputs are valid TailorOutputs and the validator leaves them unchanged", () => {
    expect(parseTailorOutput(JSON.stringify(mdZhOutput()))).toEqual(mdZhOutput());
    expect(parseTailorOutput(JSON.stringify(mdEnOutput()))).toEqual(mdEnOutput());
  });
});

describe("criterion 9: zh -> zh, a faithful output gives no finding at all", () => {
  const f = factCheck(mdOriginal, mdZhOutput(), { outputLang: "zh" });
  it("no red finding", () => expect(level(f, "red")).toEqual([]));
  it("no amber finding either", () => expect(level(f, "amber")).toEqual([]));
  it("no coverage card for ---", () => expect(f.filter((x) => x.kind === "coverage")).toEqual([]));
});

describe("criterion 9: zh -> en, a faithful output gives no red; the ambers are the translated name, titles and degree", () => {
  const f = factCheck(mdOriginal, mdEnOutput(), { outputLang: "en" });
  it("no red finding", () => expect(level(f, "red")).toEqual([]));
  // Changed by resume-sg#52: a cross-language run also lists every experience title and education degree (kind "translated").
  it("ambers are of the expected kinds only: the name (basics) and one translated line per title and degree", () => {
    expect(level(f, "amber").map((x) => [x.kind, x.where]).sort()).toEqual(
      [["basics", "basics.name"], ["translated", "education[0].degree"], ["translated", "experience[0].title"], ["translated", "experience[1].title"]].sort(),
    );
  });
  it("no coverage card at all, so none for ---", () => {
    expect(f.filter((x) => x.kind === "coverage")).toEqual([]);
    expect(f.filter((x) => x.value.trim() !== "" && !/[\p{L}\p{N}]/u.test(x.value))).toEqual([]);
  });
});

describe("criterion 9: mutations of the fixture are still caught", () => {
  it("a number that is nowhere in the original is red; a date from another entry is amber, not red", () => {
    const out: TailorOutput = mdZhOutput();
    out.resume.experience[1]!.bullets[0]!.text += " 服务 7 个团队。";
    out.resume.experience[0]!.start = "2013.09";
    const f = factCheck(mdOriginal, out, { outputLang: "zh" });
    expect(level(f, "red").map((x) => [x.kind, x.value])).toEqual([["number", "7"]]);
    expect(level(f, "amber").map((x) => [x.kind, x.where])).toEqual([["date", "experience[0].start"]]);
  });
  it("a bullet line that no source covers is one coverage amber, shown without its list marker", () => {
    const out: TailorOutput = mdZhOutput();
    out.resume.experience[1]!.bullets = [];
    out.resume.experience[1]!.source = "### 星河科技 · 后端工程师\n\n2017.07 - 2021.02";
    const f = factCheck(mdOriginal, out, { outputLang: "zh" });
    expect(level(f, "amber").map((x) => [x.kind, x.value])).toEqual([["coverage", "搭建规则引擎，使用 LiteFlow 编排，覆盖 3 条产品线。"]]);
  });
});

describe.each(TEMPLATES.map((t) => t.id))("criterion 9: rendering of the fixture in %s", (id) => {
  const entry = TEMPLATES.find((t) => t.id === id)!;
  const render1 = (resume: Resume, lang: "en" | "zh"): HTMLElement => {
    const C = entry.component as ComponentType<{ resume: Resume; lang: "en" | "zh" }>;
    const { container } = render(<C resume={resume} lang={lang} />);
    return container.querySelector<HTMLElement>("[data-template]")!;
  };
  for (const [lang, make] of [["zh", mdZhOutput], ["en", mdEnOutput]] as const) {
    it(`${lang}: one-role dates are shown once, on the company line, never on the role line`, () => {
      const out = make();
      const root = render1(toResume(out), lang);
      const groups = q(root, "[data-group]");
      expect(groups).toHaveLength(2);
      groups.forEach((g, i) => {
        const e = out.resume.experience[i]!;
        expect(q(g, '[data-level="role"]')).toHaveLength(1);
        expect(q(g, '[data-level="role"] [data-part="dates"]')).toHaveLength(0);
        expect(q(g, '[data-level="company"] [data-part="dates"]')).toHaveLength(1);
        expect(txt(q(g, '[data-level="company"] [data-part="dates"]')[0])).toBe(formatRange(e.start, open(e.end), lang));
      });
    });
    it(`${lang}: every bullet is plain text (no leading list marker or markdown) so that it renders exactly one marker`, () => {
      const root = render1(toResume(make()), lang);
      const items = q(root, "li");
      expect(items.length).toBeGreaterThanOrEqual(4);
      for (const li of items) {
        expect(txt(li), "text of a bullet").not.toMatch(/^([-*•·>#]|\d+\.)\s/);
        expect(txt(li)).not.toMatch(/\*\*|__|`/);
      }
    });
    it(`${lang}: the project built from an experience bullet nests under its role`, () => {
      const root = render1(toResume(make()), lang);
      expect(q(root, "[data-nest]")).toHaveLength(1);
      expect(q(root, '[data-section="projects"]')).toHaveLength(0);
    });
  }
});
