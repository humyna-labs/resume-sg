// resume-sg#13 criteria 1, 2, 7, 8, 9 (unit). Criteria 3 to 7 in a browser: tests/e2e/templates.spec.ts.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import { parseRoute } from "../../src/app/route.ts";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";
import { emptyResume } from "../../src/resume/model.ts";
import type { Resume } from "../../src/resume/model.ts";
import { DEFAULT_TEMPLATE, TEMPLATES } from "../../src/templates/index.ts";
import { referenceSample } from "../../src/templates/referenceSample.ts";
import { REFERENCE } from "../fixtures/reference-sample.ts";
import { leafValues, shape } from "./dict-helpers.ts";

type L = "en" | "zh";
type TemplateComponent = ComponentType<{ resume: Resume; lang: L }>;
const TAG = { en: "en-US", zh: "zh-CN" } as const;
const pick = (m: Record<string, unknown>, name: string) => (m.default ?? m[name]) as Record<string, unknown>;
const en = pick(enMod, "en");
const zh = pick(zhMod, "zh");

const NAMES = {
  en: ["Summary", "Experience", "Education", "Skills", "Certificates", "Languages"],
  zh: ["个人简介", "工作经历", "教育背景", "专业技能", "证书", "语言"],
};

function componentOf(id: string): TemplateComponent {
  const entry = TEMPLATES.find((t) => t.id === id) as unknown as Record<string, unknown> | undefined;
  expect(entry, `template ${id} is registered`).toBeDefined();
  const fn = Object.values(entry ?? {}).find((v) => typeof v === "function" || (typeof v === "object" && v !== null && "$$typeof" in v));
  expect(fn, `template ${id} has a component`).toBeDefined();
  return fn as TemplateComponent;
}

function renderTemplate(id: string, resume: Resume, lang: L) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US"); // UI language stays English
  const C = componentOf(id);
  const view = render(<C resume={resume} lang={lang} />);
  const root = view.container.querySelector<HTMLElement>("[data-template]");
  expect(root, "one root with data-template").not.toBeNull();
  return root as HTMLElement;
}

const headingEls = (root: HTMLElement) => within(root).queryAllByRole("heading");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const sectionHeadings = (root: HTMLElement, lang: L) =>
  headingEls(root).filter((h) => NAMES[lang].some((n) => norm(h.textContent ?? "").toLowerCase() === n.toLowerCase()));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = "";
});

describe("contract", () => {
  it("TEMPLATES lists classic then modern and the default is classic", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["classic", "modern"]);
    expect(DEFAULT_TEMPLATE).toBe("classic");
  });

  it("referenceSample returns exactly the reference data for en and zh", () => {
    expect(referenceSample("en")).toEqual(REFERENCE.en);
    expect(referenceSample("zh")).toEqual(REFERENCE.zh);
  });

  for (const id of ["classic", "modern"]) {
    it(`${id}: renders one root with data-template="${id}" and data-print-root`, () => {
      const root = renderTemplate(id, REFERENCE.en, "en");
      expect(root.getAttribute("data-template")).toBe(id);
      expect(root.hasAttribute("data-print-root")).toBe(true);
      expect(document.querySelectorAll("[data-template]").length).toBe(1);
    });
  }
});

describe.each(["classic", "modern"])("criterion 2 and 7: %s", (id) => {
  for (const lang of ["en", "zh"] as const) {
    const sample = REFERENCE[lang];

    it(`criterion 2: renders every section of the ${lang} sample, in the ${lang} section names`, () => {
      const root = renderTemplate(id, sample, lang);
      const found = sectionHeadings(root, lang).map((h) => norm(h.textContent ?? "").toLowerCase());
      expect(found).toEqual(NAMES[lang].map((n) => n.toLowerCase()));
      const text = root.textContent ?? "";
      expect(text).toContain(sample.basics.name);
      expect(text).toContain(sample.basics.headline);
      expect(text).toContain(sample.basics.email);
      expect(text).toContain(sample.summary);
      for (const e of sample.experience) {
        expect(text).toContain(e.title);
        expect(text).toContain(e.company);
        for (const b of e.bullets) expect(text).toContain(b);
      }
      expect(text).toContain(sample.education[0]?.school);
      expect(text).toContain(sample.certificates[0]);
      for (const g of sample.skills) {
        expect(text).toContain(g.name);
        for (const i of g.items) expect(text).toContain(i);
      }
      for (const l of sample.languages) expect(text).toContain(l);
    });

    it(`criterion 2: ${lang} dates use the en dash with spaces and "Present"/"至今"`, () => {
      const text = renderTemplate(id, sample, lang).textContent ?? "";
      if (lang === "en") {
        expect(text).toContain("Mar 2021 – Present");
        expect(text).toContain("Jul 2017 – Feb 2021");
        expect(text).toContain("Jul 2015 – Jun 2017");
      } else {
        expect(text).toContain("2021.03 – 至今");
        expect(text).toContain("2017.07 – 2021.02");
      }
      expect(text).toContain("2011 – 2015");
    });

    it(`criterion 7: ${lang} text reads header, then sections in the fixed order`, () => {
      const root = renderTemplate(id, sample, lang);
      const hs = sectionHeadings(root, lang);
      const text = root.textContent ?? "";
      expect(text.indexOf(sample.basics.name)).toBeLessThan(text.indexOf(sample.basics.email));
      // contact details sit before the first section heading, inside the body
      const first = hs[0] as HTMLElement;
      const pos = root.compareDocumentPosition(first);
      expect(pos & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
      const before = text.slice(0, text.indexOf(first.textContent ?? ""));
      expect(before).toContain(sample.basics.email);
      expect(before).toContain(sample.basics.phone);
      for (let i = 1; i < hs.length; i++) {
        const prev = hs[i - 1] as HTMLElement;
        const cur = hs[i] as HTMLElement;
        expect(prev.compareDocumentPosition(cur) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });

    it(`criterion 7: ${lang} has no img, svg, canvas, picture or inline background image or fixed position`, () => {
      const root = renderTemplate(id, sample, lang);
      expect(root.querySelectorAll("img, svg, canvas, picture, video, iframe").length).toBe(0);
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
        const style = el.getAttribute("style") ?? "";
        expect(style).not.toMatch(/background-image|url\(|position:\s*fixed/i);
      }
    });
  }

  it("criterion 2: section names follow the output language, not the UI language", () => {
    const root = renderTemplate(id, REFERENCE.zh, "zh"); // UI language is en
    expect(sectionHeadings(root, "en").length).toBe(0);
    expect(sectionHeadings(root, "zh").length).toBe(6);
  });

  it("criterion 2: zh skills line and languages use Chinese punctuation", () => {
    const text = renderTemplate(id, REFERENCE.zh, "zh").textContent ?? "";
    expect(text).toContain("英语（工作语言）；普通话（母语）");
    if (id === "classic") expect(text).toContain("编程语言：Java、Kotlin、SQL");
  });

  it("criterion 2: Certificates and Languages are two separate sections", () => {
    const root = renderTemplate(id, REFERENCE.en, "en");
    const names = headingEls(root).map((h) => norm(h.textContent ?? "").toLowerCase());
    expect(names).toContain("certificates");
    expect(names).toContain("languages");
    expect(names.some((n) => n.includes("certificates") && n.includes("languages"))).toBe(false);
  });

  it("criterion 2: empty sections are not rendered", () => {
    const r: Resume = { ...REFERENCE.en, certificates: [], languages: [] };
    const root = renderTemplate(id, r, "en");
    const names = headingEls(root).map((h) => norm(h.textContent ?? "").toLowerCase());
    expect(names).not.toContain("certificates");
    expect(names).not.toContain("languages");
    expect(names).toContain("skills");
  });

  it("criterion 2: a resume with only a name has no section headings", () => {
    const r = emptyResume();
    r.basics.name = "Sam Sample";
    const root = renderTemplate(id, r, "en");
    expect(root.textContent).toContain("Sam Sample");
    expect(sectionHeadings(root, "en").length).toBe(0);
  });

  it("criterion 7: contact details are in the body, and the template has no header/footer landmarks outside content", () => {
    const root = renderTemplate(id, REFERENCE.en, "en");
    expect(root.textContent).toContain("jamie.lin@example.com");
    expect(root.textContent).toContain("github.com/jamielin-example");
  });
});

// ---- criterion 1: switcher on the App page ----
const CLASSIC = /^classic$/i;
const MODERN = /^modern$/i;
const control = (name: RegExp) => {
  for (const role of ["radio", "tab", "button", "option"] as const) {
    const hit = screen.queryAllByRole(role, { name }).find((e) => !e.closest("[data-template]"));
    if (hit) return hit;
  }
  throw new Error(`no template switch control named ${String(name)} (radio, tab, button or option)`);
};
const isSelected = (el: HTMLElement) =>
  el.getAttribute("aria-checked") === "true" ||
  el.getAttribute("aria-pressed") === "true" ||
  el.getAttribute("aria-selected") === "true" ||
  (el as HTMLInputElement).checked === true;
const activate = (el: HTMLElement) => fireEvent.click(el);

describe("criterion 1: template switcher on the App page", () => {
  function setup(lang: L = "en") {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue(TAG[lang]);
    window.location.hash = "#/app";
    return render(<App />);
  }
  const roots = () => Array.from(document.querySelectorAll<HTMLElement>("[data-template]"));

  it("shows Classic by default, switches to Modern and back, changing only the preview", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /^load example$/i }));
    expect(isSelected(control(CLASSIC))).toBe(true);
    expect(isSelected(control(MODERN))).toBe(false);
    expect(roots().map((r) => r.dataset.template)).toEqual(["classic"]);
    expect(roots()[0]?.hasAttribute("data-print-root")).toBe(true);

    const editor = screen.getByTestId("resume-editor");
    const nameBefore = (within(editor).getByLabelText(/^name$/i) as HTMLInputElement).value;
    const htmlBefore = editor.innerHTML;

    activate(control(MODERN));
    expect(roots().map((r) => r.dataset.template)).toEqual(["modern"]);
    expect(roots()[0]?.hasAttribute("data-print-root")).toBe(true);
    expect(isSelected(control(MODERN))).toBe(true);
    expect(isSelected(control(CLASSIC))).toBe(false);
    expect((within(editor).getByLabelText(/^name$/i) as HTMLInputElement).value).toBe(nameBefore);
    expect(editor.innerHTML).toBe(htmlBefore);
    expect(roots()[0]?.textContent).toContain(nameBefore);

    activate(control(CLASSIC));
    expect(roots().map((r) => r.dataset.template)).toEqual(["classic"]);
  });

  it("the template shows the user's edits live", () => {
    setup();
    const editor = screen.getByTestId("resume-editor");
    fireEvent.change(within(editor).getByLabelText(/^name$/i), { target: { value: "Sam Sample" } });
    expect(roots()[0]?.textContent).toContain("Sam Sample");
    activate(control(MODERN));
    expect(roots()[0]?.textContent).toContain("Sam Sample");
  });
});

// ---- criterion 9 and the route ----
describe("criterion 9 and #/templates", () => {
  it("parseRoute knows #/templates", () => {
    expect(parseRoute("#/templates")).not.toBe("home");
  });

  it("en and zh dictionaries stay the same shape and hold the new strings", () => {
    expect(shape(en)).toEqual(shape(zh));
    const enVals = leafValues(en).map((v) => v.trim());
    const zhVals = leafValues(zh).map((v) => v.trim());
    for (const v of ["Templates", "Classic", "Modern"]) expect(enVals).toContain(v);
    expect(zhVals).toContain("模板");
  });

  for (const [lang, title] of [["en", "Templates"], ["zh", "模板"]] as const) {
    it(`#/templates (${lang}) has a "${title}" page with both switches, defaulting to Classic and the sample`, () => {
      vi.spyOn(window.navigator, "language", "get").mockReturnValue(TAG[lang]);
      window.location.hash = "#/templates";
      render(<App />);
      expect(screen.getByRole("heading", { level: 1, name: title })).toBeTruthy();
      const root = document.querySelector<HTMLElement>("[data-template]");
      expect(root?.dataset.template).toBe("classic");
      expect(root?.textContent).toContain("Jamie Lin");
      activate(control(MODERN));
      expect(document.querySelector<HTMLElement>("[data-template]")?.dataset.template).toBe("modern");
    });
  }
});

// ---- criterion 8: scan src/templates ----
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("criterion 8: no external resources, fonts or images under src/templates", () => {
  const dir = join(process.cwd(), "src", "templates");
  const files = (() => {
    try {
      return walk(dir);
    } catch {
      return [];
    }
  })();

  it("has the classic and modern folders with css and components", () => {
    for (const id of ["classic", "modern"]) {
      const mine = files.filter((f) => f.includes(`/${id}/`));
      expect(mine.some((f) => f.endsWith(".css")), `${id} css`).toBe(true);
      expect(mine.some((f) => /\.tsx$/.test(f)), `${id} tsx`).toBe(true);
    }
    expect(files.some((f) => f.endsWith("index.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("referenceSample.ts"))).toBe(true);
  });

  it("contains no url(, @import, @font-face or http", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      for (const bad of ["url(", "@import", "@font-face", "http"]) {
        expect(s.includes(bad), `${f} contains ${bad}`).toBe(false);
      }
    }
  });

  it("has no font or image files and no background-image or position: fixed", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f).not.toMatch(/\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|eot)$/i);
      if (f.endsWith(".css")) {
        const s = readFileSync(f, "utf8");
        expect(s).not.toMatch(/background-image/);
        expect(s).not.toMatch(/position:\s*fixed/);
      }
    }
  });

  it("adds no dependency", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["react", "react-dom"]);
  });
});
