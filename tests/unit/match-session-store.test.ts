// resume-sg#48 criterion 7 (store part): the analysis lives in the saved result as session.result.match = { output, dropped }.
// An entry that does not validate, including its analysis, is rejected and removed (owner, 2026-11-28 17:34 SGT). Never the key.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearSession, loadSession, saveSession } from "../../src/privacy/sessionStore.ts";
import { clearKey, setKey } from "../../src/security/keyStore.ts";
import { JD_MATCH, validMatch } from "../fixtures/match.ts";
import { ORIGINAL_EN, validOutput } from "../fixtures/tailor-flow.ts";

const SLOT = "jd2cv.session";
type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const entry = (): Raw => ({
  version: 1,
  savedAt: 1_764_000_000_000,
  original: ORIGINAL_EN,
  jd: JD_MATCH,
  options: { template: "classic", lang: "en", mode: "balanced", model: "claude-sonnet-5-5" },
  step: 5,
  result: { output: validOutput(), decisions: {}, generatedAt: 1_764_000_000_000, match: { output: validMatch(), dropped: 2 } },
});

beforeEach(() => {
  sessionStorage.clear();
  clearKey();
});
afterEach(() => {
  sessionStorage.clear();
  clearKey();
});

describe("criterion 7 (store): the analysis is part of the saved result", () => {
  it("saveSession keeps result.match and loadSession returns it", () => {
    saveSession(entry() as never);
    const raw = JSON.parse(sessionStorage.getItem(SLOT) as string) as Raw;
    expect(raw.result.match.dropped).toBe(2);
    const back = loadSession() as unknown as Raw;
    expect(back.result.match).toEqual({ output: validMatch(), dropped: 2 });
    expect(back.result.output).toEqual(validOutput());
  });
  it("a result without an analysis is still valid", () => {
    const e = entry();
    delete e.result.match;
    saveSession(e as never);
    expect((loadSession() as unknown as Raw).result.match).toBeUndefined();
  });
  it("saveSession throws, and writes nothing, when any string of the analysis equals the key", () => {
    setKey("test-key-not-real", false);
    const e = entry();
    e.result.match.output.questionsToAsk[0] = "test-key-not-real";
    expect(() => saveSession(e as never)).toThrow();
    expect(sessionStorage.getItem(SLOT)).toBeNull();
  });
  const corrupt = (name: string, edit: (e: Raw) => void) =>
    it(`loadSession rejects and removes an entry whose analysis has ${name}`, () => {
      saveSession(entry() as never);
      expect(loadSession()).not.toBeNull(); // the good entry is accepted first
      const e = clone(entry());
      edit(e);
      sessionStorage.setItem(SLOT, JSON.stringify(e));
      expect(loadSession()).toBeNull();
      expect(sessionStorage.getItem(SLOT)).toBeNull();
    });
  corrupt("a match that is a string", (e) => void (e.result.match = "done"));
  corrupt("no output", (e) => void delete e.result.match.output);
  corrupt("a dropped count that is not a number", (e) => void (e.result.match.dropped = "2"));
  corrupt("a negative dropped count", (e) => void (e.result.match.dropped = -1));
  corrupt("an extra key in the output", (e) => void (e.result.match.output.score = 90));
  corrupt("an unknown status", (e) => void (e.result.match.output.requirements[0].status = "great"));
  corrupt("2 strengths", (e) => void (e.result.match.output.strengths.length = 2));
  corrupt("4 interview questions", (e) => void e.result.match.output.interviewQuestions.pop());
  corrupt("a wrong type: gaps is an object", (e) => void (e.result.match.output.gaps = {}));
  it("clearSession still removes the entry with its analysis", () => {
    saveSession(entry() as never);
    clearSession();
    expect(sessionStorage.getItem(SLOT)).toBeNull();
  });
});
