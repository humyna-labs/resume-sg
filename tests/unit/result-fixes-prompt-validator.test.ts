/* eslint-disable @typescript-eslint/no-explicit-any -- the mutations poke at untyped JSON */
// resume-sg#47 criterion 2 (B: the prompt states each rule) and the validator half of criterion 6 (F: text hygiene).
import { describe, expect, it } from "vitest";
import { buildTailorRequest, parseTailorOutput } from "../../src/ai/tailor.ts";
import { clone } from "../fixtures/fact-check-cases.ts";
import { validOutput } from "../fixtures/tailor-flow.ts";

// ---------------------------------------------------------------- B: the prompt
describe("criterion 2 (B): src/ai/prompts/tailor.txt states each rule, found in the built system prompt", () => {
  const modes = ["balanced", "results-first", "career-change"] as const;
  const system = (mode: (typeof modes)[number] = "balanced", lang: "en" | "zh" = "en") =>
    buildTailorRequest({ original: "x", jd: "y", lang, mode }).system;
  /** The lines (and sentences) of the prompt, so a rule has to be stated in one place, not spread over the page. */
  const parts = (s: string): string[] => s.split(/\n|(?<=[.;:])\s+/).map((x) => x.trim()).filter((x) => x !== "");
  const stated = (s: string, ...all: RegExp[]) => parts(s).some((p) => all.every((re) => re.test(p)));

  it.each(modes)("B1 (%s): an entry's source covers its whole original block: heading, date line and bullets", (m) => {
    const s = system(m);
    expect(stated(s, /entry|entries/i, /whole|entire|full/i, /block/i), "entry source covers the whole block").toBe(true);
    expect(stated(s, /heading/i, /date line/i, /bullets?/i), "the block is the heading, the date line and the bullets").toBe(true);
  });
  it.each(modes)("B2 (%s): a bullet's source is its exact original line", (m) => {
    expect(stated(system(m), /bullet/i, /exact(ly)?/i, /(original )?line/i, /source/i)).toBe(true);
  });
  it.each(modes)("B3 (%s): skills are copied exactly as written", (m) => {
    expect(stated(system(m), /skills?/i, /(exactly as (they are )?written|copied exactly|verbatim|exactly as in the original)/i)).toBe(true);
  });
  it.each(modes)("B3 (%s): with no added explanations, no merges and no renames of skills", (m) => {
    const s = system(m);
    expect(stated(s, /skills?/i, /explanation/i), "no added explanations").toBe(true);
    expect(stated(s, /skills?/i, /merg/i), "no merges").toBe(true);
    expect(stated(s, /skills?/i, /renam/i), "no renames").toBe(true);
  });
  it.each(modes)("B4 (%s): every text field is plain text only, no markdown", (m) => {
    expect(stated(system(m), /plain text/i, /markdown/i)).toBe(true);
  });
  it("the rules are in the prompt for both output languages", () => {
    const s = system("balanced", "zh");
    expect(stated(s, /plain text/i, /markdown/i)).toBe(true);
    expect(stated(s, /skills?/i, /renam/i)).toBe(true);
  });
  it("the existing rules are still there (source rule, notIncluded)", () => {
    const s = system();
    expect(s).toContain("notIncluded");
    expect(s).toMatch(/substring/i);
  });
});

// ---------------------------------------------------------------- F: validator hygiene
const out = (f: (o: any) => void): any => {
  const o: any = clone(validOutput());
  f(o);
  return o;
};
const parse = (o: unknown): any => parseTailorOutput(JSON.stringify(o));

describe("criterion 6 (F): parseTailorOutput strips markdown and leading list markers from every text field", () => {
  it("bullet text: **, __ and ` marks and each leading marker (-, *, •, ·, 1., #, >)", () => {
    const cases: [string, string][] = [
      ["**Led** 5 engineers", "Led 5 engineers"],
      ["__Led__ 5 engineers", "Led 5 engineers"],
      ["Led `Kafka` migration", "Led Kafka migration"],
      ["- Led 5 engineers", "Led 5 engineers"],
      ["* Led 5 engineers", "Led 5 engineers"],
      ["• Led 5 engineers", "Led 5 engineers"],
      ["· Led 5 engineers", "Led 5 engineers"],
      ["1. Led 5 engineers", "Led 5 engineers"],
      ["# Led 5 engineers", "Led 5 engineers"],
      ["### Led 5 engineers", "Led 5 engineers"],
      ["> Led 5 engineers", "Led 5 engineers"],
      ["- **Led** 5 engineers", "Led 5 engineers"],
      ["- 1. Led 5 engineers", "Led 5 engineers"],
      ["  - Led 5 engineers  ", "Led 5 engineers"],
    ];
    for (const [raw, want] of cases) {
      const o = out((x) => {
        x.resume.experience[0].bullets[0].text = raw;
      });
      expect(parse(o).resume.experience[0].bullets[0].text, raw).toBe(want);
    }
  });
  it("every text field of the result is cleaned, and so are changes", () => {
    const dirty = "- **Marked** text";
    const o = out((x) => {
      const r = x.resume;
      r.basics.name = "**Jamie Lin**";
      r.basics.headline = "# Lead Engineer";
      r.basics.location = "- Singapore";
      r.summary = "> **Backend** engineer";
      const e = r.experience[0];
      e.company = "**Harborline Payments**";
      e.title = "- Lead Backend Engineer";
      e.location = "`Singapore`";
      r.projects = [{ id: "p1", name: "**Atlas**", role: "- Owner", org: "__Acme__", start: "", end: "", tech: ["- `Java`", "• **Kafka**"], source: "Atlas", bullets: [{ text: dirty, source: "Atlas" }] }];
      r.education[0].school = "**Example University**";
      r.education[0].degree = "- B.Eng.";
      r.education[0].details = ["• **Honours**"];
      r.certificates[0].text = "- **AWS** Certified";
      r.skills[0].name = "**Languages**";
      r.skills[0].items = ["- Java", "**Kotlin**", "`SQL`"];
      r.extras = [{ id: "x1", heading: "## Awards", items: [{ text: dirty, source: "Atlas" }] }];
      r.languages = ["- English", "**Mandarin**"];
      x.changes = [{ where: "**experience**", what: "- Reworded **the** bullet." }];
    });
    const r = parse(o).resume;
    expect(r.basics).toMatchObject({ name: "Jamie Lin", headline: "Lead Engineer", location: "Singapore" });
    expect(r.summary).toBe("Backend engineer");
    expect(r.experience[0]).toMatchObject({ company: "Harborline Payments", title: "Lead Backend Engineer", location: "Singapore" });
    expect(r.projects[0]).toMatchObject({ name: "Atlas", role: "Owner", org: "Acme", tech: ["Java", "Kafka"] });
    expect(r.projects[0].bullets[0].text).toBe("Marked text");
    expect(r.education[0]).toMatchObject({ school: "Example University", degree: "B.Eng.", details: ["Honours"] });
    expect(r.certificates[0].text).toBe("AWS Certified");
    expect(r.skills[0]).toMatchObject({ name: "Languages", items: ["Java", "Kotlin", "SQL"] });
    expect(r.extras[0]).toMatchObject({ heading: "Awards" });
    expect(r.extras[0].items[0].text).toBe("Marked text");
    expect(r.languages).toEqual(["English", "Mandarin"]);
    const c = parse(o).changes[0];
    expect(c).toEqual({ where: "experience", what: "Reworded the bullet." });
  });
  it("`source` is never touched: it stays an exact substring of the original", () => {
    const src = "- **海港支付** · 2021.03 · `LiteFlow`";
    const o = out((x) => {
      x.resume.experience[0].source = src;
      x.resume.experience[0].bullets[0].source = "1. # > * x";
      x.resume.certificates[0].source = "• **AWS**";
      x.notIncluded = [{ source: "- **kept as is**" }];
    });
    const r = parse(o);
    expect(r.resume.experience[0].source).toBe(src);
    expect(r.resume.experience[0].bullets[0].source).toBe("1. # > * x");
    expect(r.resume.certificates[0].source).toBe("• **AWS**");
    expect(r.notIncluded[0].source).toBe("- **kept as is**");
  });
  it("numbers, dates and ordinary punctuation survive: 3.5 years, 2021.03, A-B, 5 * 3, C++, a - b", () => {
    const o = out((x) => {
      x.resume.summary = "3.5 years of C++ work; A-B tests, 5 * 3 = 15, a - b";
      x.resume.experience[0].start = "2021.03";
      x.resume.experience[0].end = "2022-05";
      x.resume.experience[0].bullets[0].text = "2021.03 launch of the 3.5x faster API";
    });
    const r = parse(o).resume;
    expect(r.summary).toBe("3.5 years of C++ work; A-B tests, 5 * 3 = 15, a - b");
    expect(r.experience[0]).toMatchObject({ start: "2021.03", end: "2022-05" });
    expect(r.experience[0].bullets[0].text).toBe("2021.03 launch of the 3.5x faster API");
  });
  it("a Chinese bullet is cleaned the same way", () => {
    const o = out((x) => {
      x.resume.experience[0].bullets[0].text = "- **重构** 清算服务";
    });
    expect(parse(o).resume.experience[0].bullets[0].text).toBe("重构 清算服务");
  });
  it("a valid, clean output is still returned unchanged", () => {
    expect(parse(validOutput())).toEqual(validOutput());
  });
});
