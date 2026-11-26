// resume-sg#7 criteria 1 and 2: the key store keeps the key in memory unless the user opts in.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearKey, getKey, isRemembered, setKey } from "../../src/security/keyStore.ts";

const KEY = "test-key-not-real";
const SLOT = "jd2cv.apiKey";

beforeEach(() => {
  localStorage.clear();
  clearKey();
});
afterEach(() => {
  clearKey();
  localStorage.clear();
});

describe("criterion 1: memory only by default", () => {
  it("setKey(key, false) keeps the key in memory and writes nothing to localStorage", () => {
    setKey(KEY, false);
    expect(getKey()).toBe(KEY);
    expect(localStorage.length).toBe(0);
    expect(isRemembered()).toBe(false);
  });
  it("starts empty", () => {
    expect(getKey()).toBe("");
    expect(isRemembered()).toBe(false);
  });
});

describe("criterion 2: remember on this device", () => {
  it("setKey(key, true) stores the key under jd2cv.apiKey", () => {
    setKey(KEY, true);
    expect(localStorage.getItem(SLOT)).toBe(KEY);
    expect(getKey()).toBe(KEY);
    expect(isRemembered()).toBe(true);
  });
  it("setKey(key, false) removes the stored copy", () => {
    setKey(KEY, true);
    setKey(KEY, false);
    expect(localStorage.getItem(SLOT)).toBeNull();
    expect(getKey()).toBe(KEY);
    expect(isRemembered()).toBe(false);
  });
  it("clearKey removes memory and the stored copy", () => {
    setKey(KEY, true);
    clearKey();
    expect(getKey()).toBe("");
    expect(localStorage.getItem(SLOT)).toBeNull();
    expect(isRemembered()).toBe(false);
  });
  it("a remembered key is read back on load", () => {
    localStorage.setItem(SLOT, KEY);
    expect(isRemembered()).toBe(true);
    expect(getKey()).toBe(KEY);
  });
  it("uses no other storage slot", () => {
    setKey(KEY, true);
    expect(Object.keys(localStorage)).toEqual([SLOT]);
    expect(sessionStorage.length).toBe(0);
  });
});
