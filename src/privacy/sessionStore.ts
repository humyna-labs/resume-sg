// Session autosave (brief v5.2 section 3): the input, the options and the last result live in sessionStorage,
// which belongs to this tab only and is gone when the tab closes. Never localStorage, cookies or IndexedDB.
// The API key is never stored here: saveSession throws if any string value equals the current key.
import type { OutputLang, TailorMode } from "../ai/tailor.ts";
import { matchProblems } from "../ai/match.ts";
import type { Decision, MatchOutput, TailorOutput } from "../ai/types.ts";
import { clearKey, getKey } from "../security/keyStore.ts";

export const SESSION_SLOT = "jd2cv.session";
const PREFIX = "jd2cv.";

export type SessionStep = 1 | 2 | 3 | 4 | 5;

export interface SessionResult {
  output: TailorOutput;
  decisions: Record<string, Decision>;
  generatedAt: number;
  /** The match analysis (resume-sg#48): the checked output and how many items the code check removed. */
  match?: { output: MatchOutput; dropped: number };
  /** What the result was generated from, so that its checks still match after the inputs were edited. */
  base?: { original: string; jd: string; lang: OutputLang; mode: TailorMode; model: string };
}

export interface Session {
  version: 1;
  savedAt: number;
  original: string;
  jd: string;
  options: { template: string; lang: OutputLang; mode: TailorMode; model: string };
  step: SessionStep;
  result?: SessionResult;
  pending?: true;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const MODES = ["balanced", "results-first", "career-change"];

function validOutput(o: unknown): boolean {
  if (!isObj(o) || !isObj(o.resume) || !isArr(o.changes) || !isArr(o.notIncluded)) return false;
  const r = o.resume;
  return (
    isObj(r.basics) &&
    isStr(r.summary) &&
    ["experience", "projects", "education", "certificates", "skills", "extras", "languages", "order"].every((k) => isArr(r[k]))
  );
}

function validResult(r: unknown): boolean {
  if (!isObj(r)) return false;
  if (!validOutput(r.output) || !isObj(r.decisions) || typeof r.generatedAt !== "number") return false;
  if (!Object.values(r.decisions).every((d) => d === "removed" || d === "kept" || d === "added")) return false;
  if (r.match !== undefined) {
    const m = r.match;
    if (!isObj(m) || Object.keys(m).some((k) => k !== "output" && k !== "dropped")) return false;
    if (typeof m.dropped !== "number" || !Number.isInteger(m.dropped) || m.dropped < 0 || matchProblems(m.output).length > 0) return false;
  }
  if (r.base === undefined) return true;
  const b = r.base;
  return isObj(b) && isStr(b.original) && isStr(b.jd) && (b.lang === "en" || b.lang === "zh") && MODES.includes(b.mode as string) && isStr(b.model);
}

function validSession(s: unknown): s is Session {
  if (!isObj(s) || s.version !== 1 || typeof s.savedAt !== "number") return false;
  if (!isStr(s.original) || !isStr(s.jd)) return false;
  const o = s.options;
  if (!isObj(o) || !isStr(o.template) || !isStr(o.model)) return false;
  if ((o.lang !== "en" && o.lang !== "zh") || !MODES.includes(o.mode as string)) return false;
  if (![1, 2, 3, 4, 5].includes(s.step as number)) return false;
  if (s.result !== undefined && !validResult(s.result)) return false;
  return s.pending === undefined || s.pending === true;
}

function walkStrings(v: unknown, visit: (s: string) => void): void {
  if (isStr(v)) visit(v);
  else if (isArr(v)) v.forEach((x) => walkStrings(x, visit));
  else if (isObj(v)) Object.values(v).forEach((x) => walkStrings(x, visit));
}

/** The saved session, or null. An entry that does not validate is removed. */
export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_SLOT);
    if (raw === null) return null;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
    if (validSession(data)) return data;
    sessionStorage.removeItem(SESSION_SLOT);
  } catch {
    // storage unavailable: start empty
  }
  return null;
}

/** Throws, and writes nothing, if any string value equals the current key. */
export function saveSession(s: Session): void {
  const key = getKey();
  if (key !== "") {
    let leak = false;
    walkStrings(s, (v) => {
      if (v === key) leak = true;
    });
    if (leak) throw new Error("The session must never hold the API key.");
  }
  try {
    sessionStorage.setItem(SESSION_SLOT, JSON.stringify(s));
  } catch {
    // storage full or unavailable: the page keeps working without the autosave
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_SLOT);
  } catch {
    // nothing to clear
  }
}

/** Every jd2cv. entry of this tab; with `includeKey` also the key remembered on this device. */
export function clearAll({ includeKey }: { includeKey: boolean }): void {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(PREFIX)) sessionStorage.removeItem(k);
  } catch {
    // nothing to clear
  }
  if (includeKey) clearKey();
}
