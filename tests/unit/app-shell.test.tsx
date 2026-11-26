import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";
import { leafValues, shape } from "./dict-helpers.ts";

type Dict = Record<string, unknown>;
const pick = (m: Record<string, unknown>, name: string): Dict => (m.default ?? m[name]) as Dict;
const en = pick(enMod, "en");
const zh = pick(zhMod, "zh");

const ROUTES = ["#/", "#/app", "#/how-it-works", "#/faq", "#/contact", "#/privacy"];

function setup(hash: string, lang = "en-US") {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(lang);
  window.location.hash = hash;
  return render(<App />);
}

// The header (banner) holds the top navigation; the footer may hold its own nav landmark (design-spec v1, #19).
const nav = () => screen.getAllByRole("banner")[0] as HTMLElement;
const langButton = () => within(nav()).getByText(/^(中文|EN)$/).closest("button") as HTMLButtonElement;
const main = () => screen.getByRole("main");
const footer = () => screen.getAllByRole("contentinfo")[0] as HTMLElement;

const LABELS = {
  en: ["Start", "How it works", "FAQ", "Contact"],
  zh: ["开始定制", "工作原理", "常见问题", "联系我们"],
};
const HREFS = ["#/app", "#/how-it-works", "#/faq", "#/contact"];
const REPO = "https://github.com/humyna-labs/resume-sg";

beforeEach(() => {
  window.location.hash = "";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("navigation (criterion 1)", () => {
  for (const route of ROUTES) {
    for (const lang of ["en", "zh"] as const) {
      it(`shows logo, four links and a switch on ${route} in ${lang}`, () => {
        setup(route, lang === "zh" ? "zh-CN" : "en-US");
        const n = within(nav());
        expect(n.getByRole("link", { name: /^JD2CV/ }).getAttribute("href")).toBe("#/");
        LABELS[lang].forEach((label, i) => {
          // the links may also be rendered inside the phone menu sheet, so accept more than one match
          const links = n.getAllByRole("link", { name: label });
          expect(links.some((a) => a.getAttribute("href") === HREFS[i])).toBe(true);
        });
        expect(langButton()).toBeTruthy();
      });
    }
  }
});

describe("footer (criterion 2)", () => {
  for (const route of ROUTES) {
    it(`footer on ${route} in English`, () => {
      setup(route);
      const f = within(footer());
      expect(f.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("#/privacy");
      expect(f.getByText(/MIT licence/)).toBeTruthy();
      const links = Array.from(footer().querySelectorAll("a")).map((a) => a.getAttribute("href"));
      expect(links).toContain(REPO);
      expect(f.getByRole("link", { name: "Contact" }).getAttribute("href")).toBe("#/contact");
    });
    it(`footer on ${route} in Chinese`, () => {
      setup(route, "zh-CN");
      const f = within(footer());
      expect(f.getByRole("link", { name: "隐私" }).getAttribute("href")).toBe("#/privacy");
      expect(f.getByText(/MIT 许可证/)).toBeTruthy();
      const links = Array.from(footer().querySelectorAll("a")).map((a) => a.getAttribute("href"));
      expect(links).toContain(REPO);
      expect(f.getByRole("link", { name: "联系我们" }).getAttribute("href")).toBe("#/contact");
    });
  }
});

// The old Home copy (intro line, value points, steps list) was replaced by design-spec v1 (#19);
// the new Home texts are asserted in tests/unit/design-home.test.tsx.
describe("Home (criteria 3 and 4)", () => {
  it("English hero", () => {
    setup("#/");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Your resume, aimed at this job.");
  });
  it("Chinese hero", () => {
    setup("#/", "zh-CN");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("简历，对准这个岗位。");
  });
  it("unknown hash shows Home", () => {
    setup("#/does-not-exist");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Your resume, aimed at this job.");
  });
  it("hero primary button goes to the app page", () => {
    setup("#/");
    const links = within(main()).getAllByRole("link", { name: "Start" });
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a.getAttribute("href")).toBe("#/app");
  });
});

describe("dictionaries (criteria 5 and 6)", () => {
  it("have identical keys and structure", () => {
    expect(shape(zh)).toEqual(shape(en));
    expect(Object.keys(en).length).toBeGreaterThan(10);
  });
  it("have no empty values", () => {
    for (const d of [en, zh]) for (const v of leafValues(d)) expect(v.trim()).not.toBe("");
  });
  it("never claim data never leaves the browser", () => {
    for (const d of [en, zh])
      for (const v of leafValues(d)) expect(v).not.toMatch(/never leaves|不会离开/i);
  });
  it("never mention Apple in visible text", () => {
    for (const d of [en, zh]) for (const v of leafValues(d)) expect(v).not.toMatch(/apple/i);
    for (const route of ROUTES) {
      setup(route);
      expect(document.body.textContent ?? "").not.toMatch(/apple/i);
      cleanup();
    }
  });
});

describe("language switch (criterion 7)", () => {
  it("defaults by navigator.language", () => {
    setup("#/", "zh-TW");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(within(nav()).getAllByRole("link", { name: "工作原理" }).length).toBeGreaterThan(0);
    cleanup();
    setup("#/", "en-US");
    expect(document.documentElement.lang).toBe("en");
  });
  it("switches labels and lang both ways", () => {
    setup("#/", "en-US");
    fireEvent.click(langButton());
    for (const l of LABELS.zh) expect(within(nav()).getAllByRole("link", { name: l }).length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe("zh-CN");
    fireEvent.click(langButton());
    for (const l of LABELS.en) expect(within(nav()).getAllByRole("link", { name: l }).length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe("en");
  });
  it("keeps language in memory only", () => {
    setup("#/", "en-US");
    fireEvent.click(langButton());
    expect(document.cookie).toBe("");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});

describe("routes and placeholder (criteria 8 support, 9)", () => {
  for (const route of ROUTES) {
    it(`${route} shows exactly one h1`, () => {
      setup(route);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    });
  }
  it("App route h1 placeholder", () => {
    setup("#/app");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Tailor your resume");
    cleanup();
    setup("#/app", "zh-CN");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("定制你的简历");
  });
  it("drops the template placeholder and sets the title", () => {
    setup("#/");
    expect(document.body.textContent).not.toContain("This product was generated by the factory");
    expect(document.title).toBe("JD2CV");
  });
});
