// The match analysis call: request builder, hand-written validator, pure quote check, one retry.
import { callAnthropic } from "./anthropic.ts";
import { fenceInputs, retryText } from "./fence.ts";
import promptRaw from "./prompts/match.txt?raw";
import { TailorCutOffError, TailorInvalidError, problemPaths } from "./tailor.ts";
import type { OutputLang } from "./tailor.ts";
import type { MatchOutput } from "./types.ts";

const LANGUAGE_NAME: Record<OutputLang, string> = { en: "English", zh: "Chinese (中文, Simplified)" };

export interface MatchInput {
  original: string;
  jd: string;
  lang: OutputLang;
}

export function buildMatchRequest(input: MatchInput): { system: string; user: string } {
  const { user, tags } = fenceInputs([
    { name: "original_resume", label: "Original resume", text: input.original },
    { name: "job_description", label: "Job description", text: input.jd },
  ]);
  const system = promptRaw
    .trim()
    .replace("{{LANGUAGE}}", () => LANGUAGE_NAME[input.lang])
    .replace("{{ORIGINAL_TAG}}", () => tags["original_resume"] ?? "")
    .replace("{{JD_TAG}}", () => tags["job_description"] ?? "");
  return { system, user };
}

// ---------------------------------------------------------------- validator
const MAX = { quote: 1000, note: 1000, text: 1500, point: 600 } as const;
const MAX_ERRORS = 12;
const STATUSES = ["evidence", "partial", "missing"];

type Rec = Record<string, unknown>;

/** The problems of a MatchOutput, as "path: message" lines; empty when it is valid. */
export function matchProblems(root: unknown): string[] {
  const errors: string[] = [];
  const err = (path: string, msg: string): void => {
    if (errors.length < MAX_ERRORS) errors.push(`${path}: ${msg}`);
  };
  const obj = (v: unknown, path: string, keys: readonly string[], optional: readonly string[] = []): Rec | null => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      err(path, "must be an object");
      return null;
    }
    const o = v as Rec;
    for (const k of keys) if (!(k in o)) err(path, `missing key "${k}"`);
    for (const k of Object.keys(o)) if (!keys.includes(k) && !optional.includes(k)) err(path, `unexpected key "${k}"`);
    return o;
  };
  const str = (v: unknown, path: string, max: number): void => {
    if (typeof v !== "string") err(path, "must be a string");
    else if (v.length > max) err(path, `too long (${v.length} characters, at most ${max})`);
  };
  const list = (v: unknown, path: string, min: number, max: number): unknown[] => {
    if (!Array.isArray(v)) {
      err(path, "must be an array");
      return [];
    }
    if (v.length < min || v.length > max) err(path, min === max ? `must have exactly ${min} entries (got ${v.length})` : `must have ${min} to ${max} entries (got ${v.length})`);
    return v.slice(0, max + 1);
  };
  const top = obj(root, "output", ["requirements", "strengths", "gaps", "interviewQuestions", "questionsToAsk"]);
  if (!top) return errors;
  list(top["requirements"], "requirements", 0, 40).forEach((v, i) => {
    const p = `requirements[${i}]`;
    const o = obj(v, p, ["jdQuote", "status", "note"], ["evidenceQuote"]);
    if (!o) return;
    str(o["jdQuote"], `${p}.jdQuote`, MAX.quote);
    if (typeof o["status"] !== "string" || !STATUSES.includes(o["status"])) err(`${p}.status`, "must be evidence, partial or missing");
    if ("evidenceQuote" in o) str(o["evidenceQuote"], `${p}.evidenceQuote`, MAX.quote);
    str(o["note"], `${p}.note`, MAX.note);
  });
  list(top["strengths"], "strengths", 3, 5).forEach((v, i) => {
    const p = `strengths[${i}]`;
    const o = obj(v, p, ["jdQuote", "status", "evidenceQuote", "note", "howToTell"]);
    if (!o) return;
    str(o["jdQuote"], `${p}.jdQuote`, MAX.quote);
    if (o["status"] !== "evidence") err(`${p}.status`, "must be evidence");
    str(o["evidenceQuote"], `${p}.evidenceQuote`, MAX.quote);
    str(o["note"], `${p}.note`, MAX.note);
    str(o["howToTell"], `${p}.howToTell`, MAX.text);
  });
  list(top["gaps"], "gaps", 0, 40).forEach((v, i) => {
    const p = `gaps[${i}]`;
    const o = obj(v, p, ["jdQuote", "howToAddress"]);
    if (!o) return;
    str(o["jdQuote"], `${p}.jdQuote`, MAX.quote);
    str(o["howToAddress"], `${p}.howToAddress`, MAX.text);
  });
  list(top["interviewQuestions"], "interviewQuestions", 5, 5).forEach((v, i) => {
    const p = `interviewQuestions[${i}]`;
    const o = obj(v, p, ["question", "starPoints"]);
    if (!o) return;
    str(o["question"], `${p}.question`, MAX.text);
    list(o["starPoints"], `${p}.starPoints`, 1, 8).forEach((x, j) => str(x, `${p}.starPoints[${j}]`, MAX.point));
  });
  list(top["questionsToAsk"], "questionsToAsk", 2, 2).forEach((x, i) => str(x, `questionsToAsk[${i}]`, MAX.text));
  return errors;
}

/** Parses and validates the model's text. Throws an Error whose message lists what is wrong. */
export function parseMatchOutput(text: string): MatchOutput {
  let body = text.trim();
  const fenced = /^```[A-Za-z]*\s*\n([\s\S]*?)\n?```$/.exec(body);
  if (fenced) body = (fenced[1] ?? "").trim();
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("The answer is not valid JSON. Return one JSON object and nothing else.");
  }
  const errors = matchProblems(data);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return data as MatchOutput;
}

// ---------------------------------------------------------------- code check
const flat = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Keeps only what the texts contain. A failing item is dropped and counted. Pure. */
export function checkMatch(original: string, jd: string, out: MatchOutput): { kept: MatchOutput; dropped: number } {
  const o = flat(original);
  const j = flat(jd);
  const inJd = (q: string): boolean => flat(q) !== "" && j.includes(flat(q));
  const inOriginal = (q: string): boolean => flat(q) !== "" && o.includes(flat(q));
  let dropped = 0;
  const keep = <T>(items: T[], ok: (x: T) => boolean): T[] =>
    items.filter((x) => {
      if (ok(x)) return true;
      dropped += 1;
      return false;
    });
  const requirements = keep(out.requirements, (r) => {
    if (!inJd(r.jdQuote)) return false;
    if (r.evidenceQuote === undefined) return r.status === "missing";
    return inOriginal(r.evidenceQuote);
  });
  const strengths = keep(out.strengths, (s) => s.status === "evidence" && inJd(s.jdQuote) && inOriginal(s.evidenceQuote));
  const gaps = keep(out.gaps, (g) => inJd(g.jdQuote));
  return {
    kept: structuredClone({ ...out, requirements, strengths, gaps }),
    dropped,
  };
}

// ---------------------------------------------------------------- the call
export interface MatchRun extends MatchInput {
  key: string;
  model: string;
  signal?: AbortSignal;
}

const MAX_TOKENS = 16000;

/** One AI call; on a normal end with invalid output one retry with the problems appended; a cut-off answer is not retried. */
export async function runMatch(run: MatchRun): Promise<MatchOutput> {
  const { system, user } = buildMatchRequest(run);
  const call = (content: string) =>
    callAnthropic({ key: run.key, model: run.model, system, user: content, maxTokens: MAX_TOKENS, ...(run.signal ? { signal: run.signal } : {}) });
  const first = await call(user);
  if (first.stopReason === "max_tokens") throw new TailorCutOffError(first.outputTokens);
  let problems: string;
  try {
    return parseMatchOutput(first.text);
  } catch (e) {
    problems = e instanceof Error ? e.message : "invalid output";
  }
  const second = await call(`${user}\n\n${retryText(problemPaths(problems))}`);
  if (second.stopReason === "max_tokens") throw new TailorCutOffError(second.outputTokens);
  try {
    return parseMatchOutput(second.text);
  } catch (e) {
    throw new TailorInvalidError(problemPaths(e instanceof Error ? e.message : ""), second.outputTokens);
  }
}
