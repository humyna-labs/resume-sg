import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";

type Dict = Record<string, string>;
const pick = (m: Record<string, unknown>, name: string): Dict => (m.default ?? m[name]) as Dict;
const en = pick(enMod, "en");
const zh = pick(zhMod, "zh");

const ROUTES = ["#/", "#/app", "#/how-it-works", "#/faq", "#/contact", "#/privacy"];

function setup(hash: string, lang = "en-US") {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(lang);
  window.location.hash = hash;
  return render(<App />);
}

const nav = () => screen.getByRole("navigation");
const main = () => screen.getByRole("main");
const footer = () => screen.getByRole("contentinfo");

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
        expect(n.getByRole("link", { name: "JD2CV" }).getAttribute("href")).toBe("#/");
        LABELS[lang].forEach((label, i) => {
          expect(n.getByRole("link", { name: label }).getAttribute("href")).toBe(HREFS[i]);
        });
        expect(n.getByRole("button")).toBeTruthy();
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
    });
    it(`footer on ${route} in Chinese`, () => {
      setup(route, "zh-CN");
      const f = within(footer());
      expect(f.getByRole("link", { name: "隐私" }).getAttribute("href")).toBe("#/privacy");
      expect(f.getByText(/MIT 许可证/)).toBeTruthy();
      const links = Array.from(footer().querySelectorAll("a")).map((a) => a.getAttribute("href"));
      expect(links).toContain(REPO);
    });
  }
});

describe("Home (criteria 3 and 4)", () => {
  it("English text", () => {
    setup("#/");
    const m = within(main());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(m.getByText("Free. No sign-up. We store nothing.")).toBeTruthy();
    expect(m.getByText("Paste a job description and AI tailors your resume to it.")).toBeTruthy();
  });
  it("Chinese text", () => {
    setup("#/", "zh-CN");
    const m = within(main());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(m.getByText("免费 · 无需注册 · 不存你的任何数据。")).toBeTruthy();
    expect(m.getByText("粘贴职位描述，AI 帮你把简历改成这个岗位要的样子。")).toBeTruthy();
  });
  it("unknown hash shows Home", () => {
    setup("#/does-not-exist");
    expect(within(main()).getByText("Free. No sign-up. We store nothing.")).toBeTruthy();
  });
  const copy = {
    en: {
      cta: "Start tailoring",
      values: ["Free", "No sign-up, we store nothing", "Never invents facts"],
      steps: ["Paste your resume", "Paste the job description", "Check and export"],
      tag: "en-US",
    },
    zh: {
      cta: "开始定制",
      values: ["免费", "无需注册，不存数据", "绝不编造事实"],
      steps: ["粘贴你的简历", "粘贴职位描述", "核对并导出"],
      tag: "zh-CN",
    },
  };
  for (const lang of ["en", "zh"] as const) {
    it(`CTA, value points and steps in ${lang}`, () => {
      const c = copy[lang];
      const { container } = setup("#/", c.tag);
      const m = within(main());
      expect(m.getByRole("link", { name: c.cta }).getAttribute("href")).toBe("#/app");
      for (const v of c.values) expect(m.getByText(v)).toBeTruthy();
      const ol = container.querySelector("main ol");
      expect(ol).not.toBeNull();
      const items = Array.from(ol?.querySelectorAll(":scope > li") ?? []).map((li) => li.textContent?.trim());
      expect(items).toHaveLength(3);
      c.steps.forEach((s, i) => expect(items[i]).toContain(s));
    });
  }
});

describe("dictionaries (criteria 5 and 6)", () => {
  it("have identical keys", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(en).length).toBeGreaterThan(10);
  });
  it("have no empty values", () => {
    for (const d of [en, zh]) for (const v of Object.values(d)) expect(String(v).trim()).not.toBe("");
  });
  it("never claim data never leaves the browser", () => {
    for (const d of [en, zh])
      for (const v of Object.values(d)) expect(v).not.toMatch(/never leaves|不会离开/i);
  });
  it("never mention Apple in visible text", () => {
    for (const d of [en, zh]) for (const v of Object.values(d)) expect(v).not.toMatch(/apple/i);
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
    expect(within(nav()).getByRole("link", { name: "工作原理" })).toBeTruthy();
    cleanup();
    setup("#/", "en-US");
    expect(document.documentElement.lang).toBe("en");
  });
  it("switches labels and lang both ways", () => {
    setup("#/", "en-US");
    fireEvent.click(within(nav()).getByRole("button"));
    for (const l of LABELS.zh) expect(within(nav()).getByRole("link", { name: l })).toBeTruthy();
    expect(document.documentElement.lang).toBe("zh-CN");
    fireEvent.click(within(nav()).getByRole("button"));
    for (const l of LABELS.en) expect(within(nav()).getByRole("link", { name: l })).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
  });
  it("keeps language in memory only", () => {
    setup("#/", "en-US");
    fireEvent.click(within(nav()).getByRole("button"));
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
