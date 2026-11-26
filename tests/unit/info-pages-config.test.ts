import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL, PLACEHOLDER_CONTACT_EMAIL, isReleaseReady } from "../../src/config.ts";

// Criterion 4 is the release check: CI runs this before every merge.
describe("criterion 4: config and release check", () => {
  it("exports the constants", () => {
    expect(CONTACT_EMAIL).toBe("jd2cv.admin@gmail.com");
    expect(PLACEHOLDER_CONTACT_EMAIL).toBe("contact@example.com");
  });
  it("CONTACT_EMAIL is release ready", () => {
    expect(isReleaseReady(CONTACT_EMAIL)).toBe(true);
  });
  it("placeholder is not release ready, any case, trimmed", () => {
    expect(isReleaseReady("contact@example.com")).toBe(false);
    expect(isReleaseReady("  Contact@Example.COM  ")).toBe(false);
    expect(isReleaseReady("CONTACT@EXAMPLE.COM\n")).toBe(false);
  });
  it("a value without @ is not release ready", () => {
    expect(isReleaseReady("no-at-sign")).toBe(false);
    expect(isReleaseReady("")).toBe(false);
  });
  it("another real-looking address is ready", () => {
    expect(isReleaseReady("someone@example.org")).toBe(true);
  });
});

describe("criterion 5: compile-time guard (shape only; the tsc error is a written check)", () => {
  it("config.ts mentions the placeholder and a never-resolving type", () => {
    const src = readFileSync("src/config.ts", "utf8");
    expect(src).toMatch(/never/);
    expect(src).toMatch(/PLACEHOLDER_CONTACT_EMAIL/);
  });
});
