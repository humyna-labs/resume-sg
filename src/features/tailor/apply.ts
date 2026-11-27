// Pure functions: the displayed result is (model output, findings, decisions) -> output -> Resume.
import { normalise } from "../../ai/factCheck.ts";
import type { Decision, Finding, SourcedExperience, SourcedProject, SourcedText, TailorOutput } from "../../ai/types.ts";
import type { Resume, SectionId } from "../../resume/model.ts";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

type Step = string | number;
function steps(path: string): Step[] {
  const out: Step[] = [];
  for (const m of path.matchAll(/([A-Za-z_]+)|\[(\d+)\]/g)) out.push(m[2] !== undefined ? Number(m[2]) : (m[1] as string));
  return out;
}

/** Resolve "experience[0].bullets[3]" to its container and key in `root`. */
function locate(root: unknown, path: string): { parent: unknown; key: Step } | null {
  const s = steps(path);
  let cur: unknown = root;
  for (const k of s.slice(0, -1)) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<Step, unknown>)[k];
  }
  const key = s[s.length - 1];
  if (cur === undefined || cur === null || key === undefined) return null;
  return { parent: cur, key };
}

function stripText(text: string, value: string): string {
  return text.split(value).join("").replace(/\s{2,}/g, " ").trim();
}

/** The operation that "Remove it" performs for a finding, bound to objects of `out` (so earlier removals cannot shift it). */
function removal(out: TailorOutput, f: Finding): (() => void) | null {
  const loc = locate(out, f.where.startsWith("notIncluded") ? f.where : `resume.${f.where}`);
  if (!loc) return null;
  const { parent, key } = loc;
  if (typeof key === "number" && Array.isArray(parent)) {
    const el = parent[key] as unknown;
    if (f.kind === "number" && el && typeof el === "object" && "text" in el) {
      const o = el as SourcedText;
      return () => void (o.text = stripText(o.text, f.value));
    }
    return () => {
      const i = parent.indexOf(el);
      if (i >= 0) parent.splice(i, 1);
    };
  }
  const rec = parent as Record<string, unknown>;
  const cur = rec[key as string];
  if (typeof cur !== "string") return null;
  if (f.kind === "number") return () => void (rec[key as string] = stripText(cur, f.value));
  return () => void (rec[key as string] = "");
}

/** Where a missing original line goes back: the experience or project whose source starts last before the line. */
function addBack(out: TailorOutput, original: string, line: string, heading: string): void {
  const norm = normalise(original);
  const pos = norm.indexOf(line);
  const entries: (SourcedExperience | SourcedProject)[] = [...out.resume.experience, ...out.resume.projects];
  let best: SourcedExperience | SourcedProject | null = null;
  let bestAt = -1;
  for (const e of entries) {
    const at = norm.indexOf(normalise(e.source));
    if (at >= 0 && at <= pos && at > bestAt) {
      best = e;
      bestAt = at;
    }
  }
  const bullet: SourcedText = { text: line, source: line };
  if (best) {
    best.bullets.push(bullet);
    return;
  }
  let extra = out.resume.extras.find((x) => x.id === "added-back");
  if (!extra) {
    extra = { id: "added-back", heading, items: [] };
    out.resume.extras.push(extra);
  }
  extra.items.push(bullet);
}

/** The model output with the user's decisions applied. `heading` names the extras section used when no entry fits. */
export function applyDecisions(
  output: TailorOutput,
  findings: Finding[],
  decisions: Record<string, Decision>,
  original: string,
  heading: string,
): TailorOutput {
  const out = clone(output);
  const ops: (() => void)[] = [];
  const adds: string[] = [];
  for (const f of findings) {
    const d = decisions[f.id];
    if (d === "removed" && f.level === "red") {
      const op = removal(out, f);
      if (op) ops.push(op);
    } else if (d === "added" && f.level === "amber" && f.kind === "coverage") adds.push(f.value);
  }
  for (const op of ops) op();
  for (const line of adds) addBack(out, original, line, heading);
  return out;
}

/**
 * `applyDecisions`, plus the lines the user put back from "Not in this version". Returns the output before tightening
 * and the bullet sources tightening must never move (put-back lines and "Add it back" lines).
 */
export function prepare(
  output: TailorOutput,
  findings: Finding[],
  decisions: Record<string, Decision>,
  putBack: string[],
  original: string,
  heading: string,
): { pre: TailorOutput; fixed: string[] } {
  const pre = applyDecisions(output, findings, decisions, original, heading);
  const fixed: string[] = [];
  for (const f of findings) if (decisions[f.id] === "added" && f.level === "amber" && f.kind === "coverage") fixed.push(f.value);
  const hasBullet = (s: string): boolean => [...pre.resume.experience, ...pre.resume.projects].some((e) => e.bullets.some((b) => b.source === s));
  for (const s of putBack) {
    fixed.push(s);
    if (hasBullet(s)) continue;
    const i = pre.notIncluded.findIndex((n) => n.source === s);
    if (i < 0) continue;
    pre.notIncluded.splice(i, 1);
    const line = normalise(s);
    addBack(pre, original, line, heading);
    fixed.push(line);
  }
  return { pre, fixed };
}

function ids<T extends { id: string }>(list: T[], prefix: string): T[] {
  const seen = new Set<string>();
  return list.map((x, i) => {
    const id = x.id !== "" && !seen.has(x.id) ? x.id : `${prefix}${i + 1}`;
    seen.add(id);
    return { ...x, id };
  });
}

/** Drop the `source` fields and map the output to the editor's `Resume`. */
export function toResume(out: TailorOutput): Resume {
  const r = out.resume;
  const text = (l: SourcedText[]) => l.map((b) => b.text);
  return {
    basics: { ...r.basics, links: [...r.basics.links] },
    summary: r.summary,
    experience: ids(r.experience, "exp-").map((e) => ({
      id: e.id,
      company: e.company,
      title: e.title,
      location: e.location,
      start: e.start,
      end: e.end,
      bullets: text(e.bullets),
    })),
    education: ids(r.education, "edu-").map((e) => ({
      id: e.id,
      school: e.school,
      degree: e.degree,
      start: e.start,
      end: e.end,
      details: [...e.details],
    })),
    certificates: text(r.certificates),
    skills: ids(r.skills, "skill-").map((s) => ({ id: s.id, name: s.name, items: [...s.items] })),
    languages: [...r.languages],
    projects: ids(r.projects, "proj-").map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      org: p.org,
      start: p.start,
      end: p.end,
      tech: [...p.tech],
      bullets: text(p.bullets),
      experienceId: p.experienceId === "" ? undefined : p.experienceId,
    })),
    extras: ids(r.extras, "extra-").map((x) => ({ id: x.id, heading: x.heading, items: text(x.items) })),
    order: r.order as SectionId[],
  };
}
