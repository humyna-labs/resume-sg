// @vitest-environment node
// resume-sg#7 criterion 7, tightened by the pre-launch security review (2026-11-27): connect-src allows only
// api.anthropic.com (no same-origin fetch, so nothing can be posted to an endpoint on this site), and form-action is 'none'.
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
  "connect-src https://api.anthropic.com",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
];

describe("criterion 7: CSP for api.anthropic.com", () => {
  it("connect-src is exactly https://api.anthropic.com", () => {
    expect(directives.filter((d) => d.startsWith("connect-src"))).toEqual(["connect-src https://api.anthropic.com"]);
  });
  it("the CSP is exactly the baseline, in order", () => {
    expect(directives).toEqual(BASELINE);
  });
  it("no origin other than https://api.anthropic.com appears anywhere in the CSP", () => {
    const origins = csp.match(/\b[a-z][a-z0-9+.-]*:\/\/[^\s;]+/gi) ?? [];
    expect(origins).toEqual(["https://api.anthropic.com"]);
    expect(csp).not.toMatch(/\*|unsafe-inline|unsafe-eval/);
  });
});
