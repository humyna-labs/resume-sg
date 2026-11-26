// @vitest-environment node
// resume-sg#7 criterion 7: the CSP allows exactly one extra origin, api.anthropic.com, in connect-src.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const headers = readFileSync(join(import.meta.dirname, "..", "..", "public", "_headers"), "utf8");
const csp = /Content-Security-Policy:\s*(.+)/.exec(headers)?.[1]?.trim() ?? "";
const directives = csp.split(";").map((d) => d.trim()).filter(Boolean);

const BASELINE = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
];

describe("criterion 7: CSP for api.anthropic.com", () => {
  it("connect-src is exactly 'self' https://api.anthropic.com", () => {
    expect(directives.filter((d) => d.startsWith("connect-src"))).toEqual(["connect-src 'self' https://api.anthropic.com"]);
  });
  it("every other directive is unchanged, in order", () => {
    const expected = BASELINE.map((d) => (d === "connect-src 'self'" ? "connect-src 'self' https://api.anthropic.com" : d));
    expect(directives).toEqual(expected);
  });
  it("no origin other than https://api.anthropic.com appears anywhere in the CSP", () => {
    const origins = csp.match(/\b[a-z][a-z0-9+.-]*:\/\/[^\s;]+/gi) ?? [];
    expect(origins).toEqual(["https://api.anthropic.com"]);
    expect(csp).not.toMatch(/\*|unsafe-inline|unsafe-eval/);
  });
});
