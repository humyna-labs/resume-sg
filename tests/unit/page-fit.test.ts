// resume-sg#11 criteria 1 to 3 and 8: pageCount, targetPages, tighten (pure functions in src/layout/pageFit.ts).
//
// API the builder must provide (v5.2 names: TailorResult = TailorOutput, notInThisVersion = notIncluded):
//   pageCount(heightPx: number): number
//   targetPages(base: Resume, now: string /* "YYYY-MM" */): 1 | 2
//   tighten(result: TailorOutput, measure: (r: TailorOutput) => number, target: 1 | 2, fixed?: readonly string[]): TailorOutput
//     `fixed` = bullet `source` strings that must never be moved (lines the user put back); default none.
//     It is pure: the input (even frozen) is not changed, a new TailorOutput is returned.
import { describe, expect, it } from "vitest";
import { factCheck } from "../../src/ai/factCheck.ts";
import type { TailorOutput } from "../../src/ai/types.ts";
import { pageCount, targetPages, tighten } from "../../src/layout/pageFit.ts";
import { clone, deepFreeze } from "../fixtures/fact-check-cases.ts";
import { baseWithDates, bulletText, bulletsOf, synth, totalBullets } from "../fixtures/page-fit.ts";
import type { RoleSpec } from "../fixtures/page-fit.ts";

const NOW = "2026-11";

// Five roles, newest first: 6, 5, 5, 4, 4 bullets = 24. Older roles (after the two most recent) are R3, R4, R5.
const counts = [6, 5, 5, 4, 4];
const roles = (): RoleSpec[] =>
  counts.map((n, r) => ({
    company: `Company ${["Alpha", "Bravo", "Charlie", "Delta", "Echo"][r]}`,
    title: "Software Engineer",
    start: `${2024 - 3 * r}-01`,
    end: r === 0 ? "" : `${2026 - 3 * r}-12`,
    bullets: Array.from({ length: n }, (_, b) => bulletText(r, b)),
  }));
const fx = () => synth(roles());

/** A fake measure: "pages" = bullets / limit, so measure <= 1 exactly when there are at most `limit` bullets. */
const fits = (limit: number) => (r: TailorOutput) => totalBullets(r) / limit;
const sources = (o: TailorOutput, i: number) => o.resume.experience[i]?.bullets.map((b) => b.source) ?? [];
const base = () => fx().output.resume.experience.map((e) => e.bullets.map((b) => b.source));
const noBullets = (e: TailorOutput["resume"]["experience"][number]) => ({ ...e, bullets: 0 });
const moved = (o: TailorOutput) => o.notIncluded.map((n) => n.source);

describe("criterion 1: pageCount and targetPages", () => {
  it("pageCount: 1 for 0, 1 for 1123, 2 for 1124, 3 for 2247", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1123)).toBe(1);
    expect(pageCount(1124)).toBe(2);
    expect(pageCount(2246)).toBe(2);
    expect(pageCount(2247)).toBe(3);
  });

  it("targetPages: 1 for 4 years 11 months, with a fixed now", () => {
    expect(targetPages(baseWithDates([{ start: "2021-12", end: "" }]), NOW)).toBe(1);
  });
  it("targetPages: 2 for 5 years 1 month", () => {
    expect(targetPages(baseWithDates([{ start: "2021-10", end: "" }]), NOW)).toBe(2);
  });
  it("targetPages: exactly 5 years is still 1 page (at most 5 years)", () => {
    expect(targetPages(baseWithDates([{ start: "2021-11", end: "" }]), NOW)).toBe(1);
  });
  it("targetPages: the span runs from the earliest start to the latest end, across roles and gaps", () => {
    const spans = [
      { start: "2024-06", end: "" },
      { start: "2021-12", end: "2022-06" },
    ];
    expect(targetPages(baseWithDates(spans), NOW)).toBe(1); // 4 years 11 months
    const older = [...spans, { start: "2021-09", end: "2021-10" }];
    expect(targetPages(baseWithDates(older), NOW)).toBe(2); // 5 years 2 months
  });
  it("targetPages: an end date in the past ends the span there; no experience is 1 page", () => {
    expect(targetPages(baseWithDates([{ start: "2010-01", end: "2013-06" }]), NOW)).toBe(1);
    expect(targetPages(baseWithDates([]), NOW)).toBe(1);
  });
  it("targetPages: the same base gives 2 when 'now' moves on by two months", () => {
    const b = baseWithDates([{ start: "2021-12", end: "" }]);
    expect(targetPages(b, "2026-11")).toBe(1);
    expect(targetPages(b, "2027-01")).toBe(2);
  });
});

describe("the synthetic fixture itself", () => {
  it("passes the fact-check with no finding", () => {
    const { original, output } = fx();
    expect(factCheck(original, output)).toEqual([]);
  });
});

describe("criterion 2: tighten applies steps 1, 2, 3 in order and stops as soon as it fits", () => {
  it("is a no-op when it already fits (also when exactly at the limit)", () => {
    const { output } = fx();
    expect(tighten(output, fits(24), 1)).toEqual(output);
    expect(tighten(output, fits(30), 1)).toEqual(output);
    expect(tighten(output, () => 2, 2)).toEqual(output);
  });

  it("step 1a: older roles go to at most 2 bullets, the last bullets first, and nothing else moves", () => {
    const { output } = fx();
    const out = tighten(output, fits(17), 1);
    const b = base();
    expect(sources(out, 0)).toEqual(b[0]);
    expect(sources(out, 1)).toEqual(b[1]);
    expect(sources(out, 2)).toEqual(b[2]?.slice(0, 2));
    expect(sources(out, 3)).toEqual(b[3]?.slice(0, 2));
    expect(sources(out, 4)).toEqual(b[4]?.slice(0, 2));
    expect([...moved(out)].sort()).toEqual([...(b[2] ?? []).slice(2), ...(b[3] ?? []).slice(2), ...(b[4] ?? []).slice(2)].sort());
  });

  it("step 1b: then older roles go to 1 bullet; the two most recent roles are untouched", () => {
    const out = tighten(fx().output, fits(14), 1);
    const b = base();
    expect(sources(out, 0)).toEqual(b[0]);
    expect(sources(out, 1)).toEqual(b[1]);
    for (const i of [2, 3, 4]) expect(sources(out, i)).toEqual(b[i]?.slice(0, 1));
    expect(moved(out)).toHaveLength(24 - 14);
  });

  it("step 2: then recent roles go down to 3 bullets, the last bullet first", () => {
    const out = tighten(fx().output, fits(9), 1);
    const b = base();
    expect(sources(out, 0)).toEqual(b[0]?.slice(0, 3));
    expect(sources(out, 1)).toEqual(b[1]?.slice(0, 3));
    for (const i of [2, 3, 4]) expect(sources(out, i)).toEqual(b[i]?.slice(0, 1));
    expect(moved(out)).toHaveLength(24 - 9);
  });

  it("step 3: then the least relevant remaining bullet goes, older entries first (one more bullet to move)", () => {
    const out = tighten(fx().output, fits(8), 1);
    const b = base();
    expect(sources(out, 0)).toEqual(b[0]?.slice(0, 3));
    expect(sources(out, 1)).toEqual(b[1]?.slice(0, 2)); // the last bullet of R2 went first
    for (const i of [2, 3, 4]) expect(sources(out, i)).toEqual(b[i]?.slice(0, 1));
  });

  it("step 3 ends with one bullet per entry, and stops there when it still does not fit", () => {
    const out = tighten(fx().output, fits(4), 1); // 5 entries need 5 bullets: cannot fit
    const b = base();
    for (let i = 0; i < 5; i++) expect(sources(out, i)).toEqual(b[i]?.slice(0, 1));
    expect(moved(out)).toHaveLength(24 - 5);
  });

  it("stops as soon as it fits: moves just enough bullets", () => {
    for (const limit of [23, 20, 16, 12, 10, 7, 6]) {
      const out = tighten(fx().output, fits(limit), 1);
      expect(totalBullets(out)).toBe(limit);
      expect(moved(out)).toHaveLength(24 - limit);
    }
  });

  it("target 2 uses the same rule with a bigger limit", () => {
    const out = tighten(fx().output, (r) => totalBullets(r) / 10, 2); // fits when measure <= 2, i.e. 20 bullets
    expect(totalBullets(out)).toBe(20);
  });

  it("older roles are counted across company groups: two roles of one company are two roles", () => {
    const four: RoleSpec[] = [0, 1, 2, 3].map((r) => ({
      company: r < 2 ? "Company Alpha" : `Company ${["x", "y", "Charlie", "Delta"][r]}`,
      title: `Engineer level ${["one", "two", "three", "four"][r]}`,
      start: `${2024 - 3 * r}-01`,
      end: r === 0 ? "" : `${2026 - 3 * r}-12`,
      bullets: Array.from({ length: 5 }, (_, b) => bulletText(r, b)),
    }));
    const { output } = synth(four);
    const out = tighten(output, fits(14), 1); // 20 -> 14 exactly at the end of step 1a
    const b = bulletsOf(output);
    expect(sources(out, 0)).toEqual(b[0]);
    expect(sources(out, 1)).toEqual(b[1]);
    expect(sources(out, 2)).toEqual(b[2]?.slice(0, 2));
    expect(sources(out, 3)).toEqual(b[3]?.slice(0, 2));
  });

  it("a fixed bullet is skipped: step 1 keeps it and moves another one", () => {
    const b = base();
    const fixed = b[2]?.[4] as string; // the last bullet of R3
    const out = tighten(fx().output, fits(17), 1, [fixed]);
    expect(sources(out, 2)).toEqual([b[2]?.[0], fixed]);
    expect(moved(out)).not.toContain(fixed);
    expect(totalBullets(out)).toBe(17);
  });

  it("a fixed bullet is skipped in step 2: the recent role keeps it and moves others from the end", () => {
    const b = base();
    const fixed = b[0]?.[5] as string; // the last (least relevant) bullet of R1
    const out = tighten(fx().output, fits(9), 1, [fixed]);
    expect(sources(out, 0)).toEqual([b[0]?.[0], b[0]?.[1], fixed]);
    expect(moved(out)).not.toContain(fixed);
  });

  it("with every bullet of an entry fixed, those stay even when it cannot fit", () => {
    const b = base();
    const fixed = b[1] as string[];
    const out = tighten(fx().output, fits(1), 1, fixed);
    expect(sources(out, 1)).toEqual(fixed);
    for (const i of [0, 2, 3, 4]) expect(sources(out, i)).toHaveLength(1);
  });

  it("does not change its input (a deep-frozen input works) and ends when nothing is left to move", () => {
    const { output } = fx();
    const frozen = deepFreeze(clone(output));
    const out = tighten(frozen, () => 99, 1); // never fits: must still terminate
    expect(out).not.toBe(frozen);
    expect(totalBullets(out)).toBe(5);
  });
});

describe("criterion 3: what tighten moves, and what it never touches", () => {
  const cases: [string, number][] = [["step 1", 14], ["step 2", 9], ["step 3", 5], ["a limit nothing can meet", 0]];
  for (const [name, limit] of cases) {
    it(`${name}: every moved bullet is in notIncluded as { source } from the base, in the base order of its entry`, () => {
      const { output } = fx();
      output.notIncluded = [{ source: "Earlier left-out line" }];
      const out = tighten(output, fits(Math.max(limit, 1)), 1);
      const all = bulletsOf(output).flat();
      const kept = bulletsOf(out).flat();
      const added = out.notIncluded.slice(1);
      expect(out.notIncluded[0]).toEqual({ source: "Earlier left-out line" });
      expect(added.every((n) => Object.keys(n).join() === "source")).toBe(true);
      expect([...added.map((n) => n.source), ...kept].sort()).toEqual([...all].sort());
      expect(new Set(added.map((n) => n.source)).size).toBe(added.length);
    });

    it(`${name}: checkLost (fact-check) reports nothing new, and employers, titles, dates and entries are intact`, () => {
      const { original, output } = fx();
      const before = factCheck(original, output);
      const out = tighten(output, fits(Math.max(limit, 1)), 1);
      expect(factCheck(original, out)).toEqual(before);
      expect(before).toEqual([]);
      expect(out.resume.experience.map(noBullets)).toEqual(output.resume.experience.map(noBullets));
      expect(out.resume.education).toEqual(output.resume.education);
      expect(out.resume.basics).toEqual(output.resume.basics);
      expect(out.resume.order).toEqual(output.resume.order);
    });

    it(`${name}: no bullet text is changed`, () => {
      const { output } = fx();
      const text = new Map(output.resume.experience.flatMap((e) => e.bullets.map((b) => [b.source, b.text] as const)));
      const out = tighten(output, fits(Math.max(limit, 1)), 1);
      for (const e of out.resume.experience) for (const b of e.bullets) expect(b.text).toBe(text.get(b.source));
    });
  }

  it("projects (standalone) keep their entry line and at least one bullet; every entry keeps one bullet", () => {
    const { original, output } = synth(roles(), {
      projects: [{ name: "Open Notes", bullets: [bulletText(7, 0), bulletText(7, 1), bulletText(7, 2)] }],
    });
    const out = tighten(output, () => 99, 2);
    expect(out.resume.projects).toHaveLength(1);
    expect(out.resume.projects[0]?.name).toBe("Open Notes");
    expect(out.resume.projects[0]?.bullets).toHaveLength(1);
    for (const e of out.resume.experience) expect(e.bullets).toHaveLength(1);
    expect(factCheck(original, out)).toEqual([]);
  });

  it("an entry that has no bullets stays as it is (nothing to move, nothing removed)", () => {
    const { output } = fx();
    const empty = clone(output);
    (empty.resume.experience[3] as { bullets: unknown[] }).bullets = [];
    const out = tighten(empty, () => 99, 1);
    expect(out.resume.experience).toHaveLength(5);
    expect(out.resume.experience[3]?.bullets).toHaveLength(0);
  });
});
