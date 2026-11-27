// Page fit (brief v4 sections 3 and 4, adapted in v5.2): how many A4 pages, the page target, and tightening.
import type { SourcedText, TailorOutput } from "../ai/types.ts";
import type { Resume } from "../resume/model.ts";

/** The preview page: A4 at 96 dpi. */
export const PAGE_W = 794;
export const PAGE_H = 1123;

export function pageCount(heightPx: number): number {
  return Math.max(1, Math.ceil(heightPx / PAGE_H));
}

/** Months since year 0 for "YYYY-MM" or "YYYY" (`yearEnd`: a bare year means its last month); null if unreadable. */
function monthIndex(value: string, yearEnd: boolean): number | null {
  const m = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] !== undefined ? Number(m[2]) - 1 : yearEnd ? 11 : 0;
  return year * 12 + month;
}

/** 1 when the experience spans at most 5 years (earliest start to latest end; `end: ""` = `now`, "YYYY-MM"), else 2. */
export function targetPages(base: Resume, now: string): 1 | 2 {
  const current = monthIndex(now, false);
  let first: number | null = null;
  let last: number | null = null;
  for (const e of base.experience) {
    const s = monthIndex(e.start, false);
    const f = e.end.trim() === "" ? current : monthIndex(e.end, true);
    if (s === null) continue;
    if (first === null || s < first) first = s;
    if (f !== null && (last === null || f > last)) last = f;
  }
  if (first === null || last === null) return 1;
  return last - first > 60 ? 2 : 1;
}

interface Entry {
  bullets: SourcedText[];
}

/** The moves, in order, as [entry index, bullet index in the untouched entry]. Entries: experience, then projects. */
function plan(entries: Entry[], roles: number, fixed: ReadonlySet<string>): [number, number][] {
  const remaining = entries.map((e) => e.bullets.map((_, j) => j));
  const moves: [number, number][] = [];
  const lastMovable = (i: number): number => {
    const rem = remaining[i] as number[];
    const bullets = (entries[i] as Entry).bullets;
    for (let k = rem.length - 1; k >= 0; k--) if (!fixed.has((bullets[rem[k] as number] as SourcedText).source)) return k;
    return -1;
  };
  const move = (i: number): boolean => {
    const k = lastMovable(i);
    if (k < 0) return false;
    const rem = remaining[i] as number[];
    moves.push([i, rem[k] as number]);
    rem.splice(k, 1);
    return true;
  };
  const trim = (i: number, keep: number): void => {
    while ((remaining[i] as number[]).length > keep && move(i)) {
      /* keep moving */
    }
  };
  // 1. older roles (after the two most recent): to 2 bullets, then to 1
  for (const keep of [2, 1]) for (let i = roles - 1; i >= 2; i--) trim(i, keep);
  // 2. recent roles: to no fewer than 3
  for (let i = Math.min(2, roles) - 1; i >= 0; i--) trim(i, 3);
  // 3. the last bullet of the oldest entry that still has a spare one, until one per entry is left
  for (;;) {
    let moved = false;
    for (let i = entries.length - 1; i >= 0 && !moved; i--) {
      if ((remaining[i] as number[]).length > 1) moved = move(i);
    }
    if (!moved) break;
  }
  return moves;
}

/**
 * Moves bullets into `notIncluded` (never changing their text) until `measure(result) <= target` or nothing is left to
 * move: older roles to 2, then 1 bullet; recent roles to 3; then the last bullet of the oldest entries, keeping one per
 * entry. Bullets whose `source` is in `fixed` (lines the user put back) are never moved. Pure: returns a new output.
 */
export function tighten(
  result: TailorOutput,
  measure: (r: TailorOutput) => number,
  target: 1 | 2,
  fixed: readonly string[] = [],
): TailorOutput {
  const base = JSON.parse(JSON.stringify(result)) as TailorOutput;
  const entries: Entry[] = [...base.resume.experience, ...base.resume.projects];
  const moves = plan(entries, base.resume.experience.length, new Set(fixed));
  // Applying the first k moves; the result only gets shorter with k, so the smallest k that fits is found by bisection.
  const apply = (k: number): TailorOutput => {
    const out = JSON.parse(JSON.stringify(result)) as TailorOutput;
    const list: Entry[] = [...out.resume.experience, ...out.resume.projects];
    const gone = list.map(() => new Set<number>());
    for (const [i, j] of moves.slice(0, k)) {
      (gone[i] as Set<number>).add(j);
      out.notIncluded.push({ source: ((list[i] as Entry).bullets[j] as SourcedText).source });
    }
    list.forEach((e, i) => {
      const drop = gone[i] as Set<number>;
      if (drop.size > 0) e.bullets = e.bullets.filter((_, j) => !drop.has(j));
    });
    return out;
  };
  const fits = (k: number): boolean => measure(apply(k)) <= target;
  if (fits(0) || moves.length === 0) return apply(0);
  if (!fits(moves.length)) return apply(moves.length);
  let lo = 0;
  let hi = moves.length;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return apply(hi);
}
