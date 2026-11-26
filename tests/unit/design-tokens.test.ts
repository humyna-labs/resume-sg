import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Criteria 1, 4, 7, 8 and 11 of #19: static checks of tokens, CSS and source.

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const SRC = walk("src");
const CSS_FILES = SRC.filter((f) => f.endsWith(".css"));
const TOKENS = "src/styles/tokens.css";
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const tokensCss = strip(readFileSync(TOKENS, "utf8"));

/** Normalise a CSS value so "#FFF", "0.08" and spacing differences compare equal. */
function normValue(v: string): string {
  return v
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/!important/g, "")
    .replace(/(^|[^\d])0\.(\d)/g, "$1.$2")
    .replace(/^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/, "#$1$2$3");
}
const declarations = new Map<string, string>(); // custom property -> normalised value
for (const m of tokensCss.matchAll(/(--[\w-]+)\s*:\s*([^;}]+);?/g)) declarations.set(m[1] as string, normValue(m[2] as string));
const values = new Set(declarations.values());

describe("criterion 1: tokens.css defines every value of the spec as a custom property", () => {
  it("names the two properties the issue spells out", () => {
    expect(declarations.get("--accent")).toBe("#0a5cd8");
    expect(declarations.get("--alt")).toBe("#f5f5f7");
  });

  const spec: Record<string, string> = {
    background: "#fff",
    "alternate section": "#f5f5f7",
    text: "#1d1d1f",
    "secondary text": "#424245",
    muted: "#6e6e73",
    hairline: "rgba(0,0,0,.08)",
    accent: "#0a5cd8",
    "accent tint": "#e8f0fd",
    success: "#1a7f37",
    "success tint": "#e7f5ec",
    error: "#c4320a",
    "error tint": "#fdecea",
    highlight: "#fff3c4",
    "input border": "#d2d2d7",
    "card radius": "22px",
    "inner radius": "14px",
    "pill radius": "999px",
    "input radius": "12px",
    "card shadow": "0 1px 2px rgba(0,0,0,.04),0 8px 28px rgba(0,0,0,.06)",
    "h1 desktop": "68px",
    "h1 phone": "40px",
    "h2 desktop": "44px",
    "h2 phone": "30px",
    "content max width": "1080px",
    "side padding": "24px",
    "section vertical": "88px",
    "section vertical phone": "56px",
    "nav height": "56px",
    "input height": "44px",
    "button small": "32px",
    "button large": "50px",
  };
  for (const [name, value] of Object.entries(spec)) {
    it(`defines ${name} (${value})`, () => {
      expect(values.has(normValue(value)), `no custom property in tokens.css has the value ${value}`).toBe(true);
    });
  }

  it("keeps motion duration at 200 ms", () => {
    const motion = [...declarations.entries()].filter(([k]) => /transition|motion|duration/.test(k));
    expect(motion.length).toBeGreaterThan(0);
    for (const [, v] of motion) expect(v).toMatch(/^(\.2s|200ms)/);
  });

  it("components use the properties, not the literals", () => {
    const literals = [
      "#0a5cd8", "#f5f5f7", "#1d1d1f", "#424245", "#6e6e73", "#e8f0fd", "#1a7f37", "#e7f5ec",
      "#c4320a", "#fdecea", "#fff3c4", "#d2d2d7",
    ];
    for (const f of CSS_FILES.filter((x) => x !== TOKENS)) {
      const css = strip(readFileSync(f, "utf8")).toLowerCase();
      for (const lit of literals) expect(css, `${f} uses literal ${lit}`).not.toContain(lit);
      expect(css, `${f} has a literal card shadow`).not.toMatch(/0\s+8px\s+28px/);
      expect(css, `${f} has a literal radius`).not.toMatch(/border-radius\s*:\s*(22|14|12)px/);
    }
  });

  it("components actually reference the tokens", () => {
    const all = CSS_FILES.filter((x) => x !== TOKENS).map((f) => readFileSync(f, "utf8")).join("\n");
    for (const name of ["--accent", "--alt"]) expect(all).toContain(`var(${name})`);
    expect((all.match(/var\(--/g) ?? []).length).toBeGreaterThan(40);
  });

  it("uses one breakpoint at 760px", () => {
    const all = CSS_FILES.map((f) => strip(readFileSync(f, "utf8"))).join("\n");
    const widths = new Set([...all.matchAll(/@media[^{]*\(\s*(?:max|min)-width\s*:\s*([\d.]+)px/g)].map((m) => m[1]));
    expect([...widths]).toEqual(["760"]);
  });
});

describe("criterion 7: nothing hides horizontal overflow", () => {
  it("no overflow hidden or clip on html, body or :root", () => {
    for (const f of CSS_FILES) {
      const css = strip(readFileSync(f, "utf8"));
      for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selectors = (rule[1] as string).split(",").map((s) => s.trim());
        const body = rule[2] as string;
        const hitsRoot = selectors.some((s) => /^(html|body|:root)(\b|$)/.test(s));
        if (hitsRoot) expect(body, `${f}: ${rule[1]}`).not.toMatch(/overflow(-x)?\s*:\s*(hidden|clip)/);
      }
    }
  });
});

describe("criterion 8: motion only on opacity and transform, 200 ms", () => {
  it("every transition names opacity or transform with 200ms, never all", () => {
    for (const f of CSS_FILES) {
      const css = strip(readFileSync(f, "utf8"));
      for (const m of css.matchAll(/(?<![-\w])transition(-property)?\s*:\s*([^;}]+)/g)) {
        const value = (m[2] as string).trim();
        for (const part of value.split(/,(?![^(]*\))/)) {
          const first = part.trim().split(/\s+/)[0] ?? "";
          if (m[1]) expect(first, `${f}: transition-property ${value}`).toMatch(/^(opacity|transform|none)$/);
          else expect(first, `${f}: transition ${value}`).toMatch(/^(opacity|transform|none)$/);
          for (const t of part.match(/[\d.]+m?s\b/g) ?? []) expect(["200ms", ".2s", "0.2s", "0s"]).toContain(t);
        }
      }
    }
  });
  it("has a prefers-reduced-motion: reduce block", () => {
    const all = CSS_FILES.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(all).toMatch(/prefers-reduced-motion\s*:\s*reduce/);
  });
});

describe("criterion 4: rich text is built as React elements", () => {
  it("no dangerouslySetInnerHTML anywhere in the source", () => {
    for (const f of SRC.filter((x) => /\.(ts|tsx|js|jsx|html)$/.test(x)))
      expect(readFileSync(f, "utf8"), f).not.toContain("dangerouslySetInnerHTML");
  });
  it("dictionary strings hold no markup", () => {
    for (const f of SRC.filter((x) => /i18n[\\/](en|zh)\.ts$/.test(x)))
      expect(readFileSync(f, "utf8"), f).not.toMatch(/<\/?(span|mark|b|strong|em|a|br)\b[^>]*>/i);
  });
});

describe("criterion 11: no new dependency, image, font file or external URL in CSS", () => {
  it("package.json dependencies are unchanged", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["react", "react-dom"]);
  });
  it("no image or font files under src or public", () => {
    const files = [...SRC, ...walk("public")];
    expect(files.filter((f) => /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot)$/i.test(f))).toEqual([]);
  });
  it("CSS has no url(), @import or @font-face and no external address", () => {
    for (const f of CSS_FILES) {
      const css = strip(readFileSync(f, "utf8"));
      expect(css, f).not.toMatch(/url\s*\(/i);
      expect(css, f).not.toMatch(/@import|@font-face/i);
      expect(css, f).not.toMatch(/https?:\/\//i);
    }
  });
  it("system font stack only", () => {
    const stack = declarations.get("--font-stack") ?? "";
    expect(stack.startsWith("-apple-system")).toBe(true);
    expect(stack).toContain("sans-serif");
  });
});
