// resume-sg#31 (session-autosave), criteria 4, 5 (store part) and 6: the sessionStorage contract of
// src/privacy/sessionStore.ts. Synthetic data and fake keys only.
//
// Assumption (the issue does not give the type of `savedAt` / `generatedAt`): a number (ms since epoch) or an ISO
// string. `validEntry()` probes which one the store accepts, so the tests do not pick a side.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAll, clearSession, loadSession, saveSession } from "../../src/privacy/sessionStore.ts";
import { clearKey, getKey, isRemembered, setKey } from "../../src/security/keyStore.ts";
import { ORIGINAL_EN, JD_EN, validOutput } from "../fixtures/tailor-flow.ts";

const SLOT = "jd2cv.session";
const NOT_REAL = "test-key-not-real";

type Raw = Record<string, unknown>;
const entry = (stamp: number | string): Raw => ({
  version: 1,
  savedAt: stamp,
  original: ORIGINAL_EN,
  jd: JD_EN,
  options: { template: "modern", lang: "en", mode: "results-first", model: "claude-opus-5-5" },
  step: 5,
  result: { output: validOutput(), decisions: { "some-id": "kept" }, generatedAt: stamp },
});
const stored = (): Raw | null => {
  const raw = sessionStorage.getItem(SLOT);
  return raw === null ? null : (JSON.parse(raw) as Raw);
};
/** An entry the store accepts, whatever type it chose for the timestamps. */
function validEntry(): Raw {
  for (const stamp of [1_764_000_000_000, "2026-11-27T07:05:00.000Z"]) {
    sessionStorage.setItem(SLOT, JSON.stringify(entry(stamp)));
    if (loadSession() !== null) {
      sessionStorage.removeItem(SLOT);
      return entry(stamp);
    }
  }
  throw new Error("loadSession rejects a well-formed version 1 entry");
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  clearKey();
});
afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  clearKey();
});

describe("criterion 1 (store): where the session lives", () => {
  it("saveSession writes jd2cv.session in sessionStorage only, as version 1, and loadSession reads it back", () => {
    const e = validEntry();
    saveSession(e as never);
    const raw = stored();
    expect(raw).not.toBeNull();
    expect(raw?.version).toBe(1);
    expect(raw?.original).toBe(ORIGINAL_EN);
    expect(raw?.jd).toBe(JD_EN);
    expect(raw?.options).toEqual({ template: "modern", lang: "en", mode: "results-first", model: "claude-opus-5-5" });
    expect(raw?.step).toBe(5);
    expect((raw?.result as Raw).decisions).toEqual({ "some-id": "kept" });
    expect(localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
    const back = loadSession() as unknown as Raw;
    expect(back.original).toBe(ORIGINAL_EN);
    expect((back.result as Raw).decisions).toEqual({ "some-id": "kept" });
  });
  it("a session without a result and with pending: true is valid", () => {
    const e = validEntry();
    delete e.result;
    e.step = 4;
    e.pending = true;
    saveSession(e as never);
    const back = loadSession() as unknown as Raw;
    expect(back).not.toBeNull();
    expect(back.pending).toBe(true);
    expect(back.step).toBe(4);
  });
  it("clearSession removes the entry", () => {
    saveSession(validEntry() as never);
    clearSession();
    expect(sessionStorage.getItem(SLOT)).toBeNull();
    expect(loadSession()).toBeNull();
  });
});

describe("criterion 4 (store): never the key", () => {
  it("saveSession throws when a string value equals the current key, and writes nothing", () => {
    setKey(NOT_REAL, false);
    for (const field of ["original", "jd"]) {
      const e = validEntry();
      e[field] = NOT_REAL;
      expect(() => saveSession(e as never), field).toThrow();
      expect(sessionStorage.getItem(SLOT), field).toBeNull();
    }
    const e = validEntry();
    (e.options as Raw).model = NOT_REAL;
    expect(() => saveSession(e as never)).toThrow();
  });
  it("a value nested in the result that equals the key also throws", () => {
    setKey(NOT_REAL, false);
    const e = validEntry();
    const out = validOutput();
    out.resume.summary = NOT_REAL;
    (e.result as Raw).output = out;
    expect(() => saveSession(e as never)).toThrow();
  });
  it("saves normally when no value equals the key", () => {
    setKey(NOT_REAL, false);
    expect(() => saveSession(validEntry() as never)).not.toThrow();
    expect(sessionStorage.getItem(SLOT)).not.toBeNull();
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(NOT_REAL);
  });
});

describe("criterion 5 (store): clearAll", () => {
  const seed = () => {
    saveSession(validEntry() as never);
    sessionStorage.setItem("jd2cv.other", "x");
    sessionStorage.setItem("jd2cv.another", "y");
    sessionStorage.setItem("unrelated", "keep me");
  };
  it("removes jd2cv.session and every other jd2cv. entry in sessionStorage, nothing else", () => {
    seed();
    clearAll({ includeKey: false });
    expect(sessionStorage.getItem(SLOT)).toBeNull();
    expect(sessionStorage.getItem("jd2cv.other")).toBeNull();
    expect(sessionStorage.getItem("jd2cv.another")).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("keep me");
  });
  it("includeKey: false keeps the remembered key", () => {
    setKey(NOT_REAL, true);
    seed();
    clearAll({ includeKey: false });
    expect(isRemembered()).toBe(true);
    expect(localStorage.getItem("jd2cv.apiKey")).toBe(NOT_REAL);
  });
  it("includeKey: true also removes the remembered key (clearKey)", () => {
    setKey(NOT_REAL, true);
    seed();
    clearAll({ includeKey: true });
    expect(sessionStorage.getItem(SLOT)).toBeNull();
    expect(isRemembered()).toBe(false);
    expect(localStorage.getItem("jd2cv.apiKey")).toBeNull();
    expect(getKey()).toBe("");
  });
});

describe("criterion 6: loadSession rejects and removes a corrupt entry", () => {
  const corrupt = (name: string, make: () => string) =>
    it(name, () => {
      validEntry(); // the store accepts a good entry first, so the rejection below is about the corruption
      sessionStorage.setItem(SLOT, make());
      expect(loadSession()).toBeNull();
      expect(sessionStorage.getItem(SLOT)).toBeNull();
    });
  corrupt("bad JSON", () => "{not json");
  corrupt("a JSON value that is not an object", () => "[1,2,3]");
  corrupt("version 2", () => JSON.stringify({ ...validEntry(), version: 2 }));
  corrupt("a missing key: original", () => {
    const e = validEntry();
    delete e.original;
    return JSON.stringify(e);
  });
  corrupt("a missing key: options", () => {
    const e = validEntry();
    delete e.options;
    return JSON.stringify(e);
  });
  corrupt("a missing key: step", () => {
    const e = validEntry();
    delete e.step;
    return JSON.stringify(e);
  });
  corrupt("wrong type: original is a number", () => JSON.stringify({ ...validEntry(), original: 5 }));
  corrupt("wrong type: step is 6", () => JSON.stringify({ ...validEntry(), step: 6 }));
  corrupt("wrong type: step is a string", () => JSON.stringify({ ...validEntry(), step: "2" }));
  corrupt("wrong type: options.template is a number", () => {
    const e = validEntry();
    (e.options as Raw).template = 3;
    return JSON.stringify(e);
  });
  corrupt("wrong type: result.decisions is an array", () => {
    const e = validEntry();
    (e.result as Raw).decisions = [];
    return JSON.stringify(e);
  });
  it("no entry at all is simply null", () => {
    expect(loadSession()).toBeNull();
  });
});
