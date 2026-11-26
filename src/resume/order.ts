import { DEFAULT_ORDER } from "./model.ts";
import type { SectionId } from "./model.ts";

export type TailorMode = "balanced" | "results-first" | "career-change";

const CAREER_CHANGE: readonly SectionId[] = [
  "summary",
  "skills",
  "projects",
  "experience",
  "education",
  "certificates",
  "extras",
  "languages",
];

/** The section order for a mode. Fewer than 2 years of work puts Education right after Summary. */
export function defaultOrder(mode: TailorMode, yearsOfWork: number): SectionId[] {
  const base = [...(mode === "career-change" ? CAREER_CHANGE : DEFAULT_ORDER)];
  if (yearsOfWork >= 2) return base;
  const rest = base.filter((s) => s !== "education");
  return [rest[0] as SectionId, "education", ...rest.slice(1)];
}

/** Only the default order of the same mode and years is accepted. */
export function validateOrder(order: readonly string[], mode: TailorMode, yearsOfWork: number): boolean {
  const want = defaultOrder(mode, yearsOfWork);
  return order.length === want.length && want.every((s, i) => order[i] === s);
}
