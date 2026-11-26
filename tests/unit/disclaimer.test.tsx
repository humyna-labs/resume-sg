// resume-sg#24 criteria 1-5 and 7.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";
import { leafValues, shape } from "./dict-helpers.ts";
import { DISCLAIMER } from "./disclaimer-fixtures.ts";

type L = "en" | "zh";
const TAG = { en: "en-US", zh: "zh-CN" } as const;
const norm = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const nows = (s: string) => norm(s).replace(/\s/g, "");
const pick = (m: Record<string, unknown>, name: string) => (m.default ?? m[name]) as Record<string, unknown>;
const en = pick(enMod, "en");
const zh = pick(zhMod, "zh");
const ROUTES = ["#/", "#/app", "#/how-it-works", "#/faq", "#/contact", "#/privacy", "#/disclaimer"];

function setup(hash: string, lang: L) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(TAG[lang]);
  window.location.hash = hash;
  return render(<App />);
}
const main = () => screen.getByRole("main");
const links = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("a")).filter((a) => a.getAttribute("href") === "#/disclaimer");
const consentLineEl = (line: string) =>
  Array.from(main().querySelectorAll("p, small, span, div")).find(
    (e) => norm(e.textContent ?? "") === line && e.querySelector("a"),
  );
const snapshot = () => [JSON.stringify({ ...localStorage }), JSON.stringify({ ...sessionStorage }), document.cookie];

beforeEach(() => {
  window.location.hash = "";
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

for (const lang of ["en", "zh"] as const) {
  const D = DISCLAIMER[lang];
  describe(`disclaimer page, ${lang}`, () => {
    it("criterion 1: h1 is the title", () => {
      setup("#/disclaimer", lang);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 1 }).textContent?.trim()).toBe(D.title);
    });

    it("criterion 1: ordered list of exactly 10 items with exact bold lead and body", () => {
      setup("#/disclaimer", lang);
      const ols = Array.from(main().querySelectorAll("ol"));
      expect(ols).toHaveLength(1);
      const items = Array.from(ols[0]?.querySelectorAll(":scope > li") ?? []);
      expect(items).toHaveLength(10);
      D.items.forEach(([lead, body], i) => {
        const li = items[i] as HTMLElement;
        const bold = li.querySelector("strong, b");
        expect(bold, `bold lead in item ${i + 1}`).not.toBeNull();
        expect(nows(bold?.textContent ?? ""), `lead ${i + 1}`).toBe(nows(lead));
        expect(nows(li.textContent ?? ""), `item ${i + 1}`).toBe(nows(lead + body));
      });
    });

    it("criterion 1: last-updated line", () => {
      setup("#/disclaimer", lang);
      expect(norm(main().textContent ?? "")).toContain(D.updated);
    });

    it("criterion 2: same structure, 10 items each with lead and body", () => {
      setup("#/disclaimer", lang);
      const items = Array.from(main().querySelectorAll("ol > li"));
      expect(items).toHaveLength(10);
      for (const li of items) {
        const bold = li.querySelector("strong, b");
        expect(bold).not.toBeNull();
        expect((li.textContent ?? "").length).toBeGreaterThan((bold?.textContent ?? "").length + 5);
      }
    });

    it("criterion 3: footer link and agreement line on every route", () => {
      for (const r of ROUTES) {
        setup(r, lang);
        const f = screen.getByRole("contentinfo");
        const ls = links(f);
        expect(ls.length, `${r}: footer links to #/disclaimer`).toBeGreaterThanOrEqual(2);
        expect(ls.some((a) => a.textContent?.trim() === D.linkName), `${r}: plain link`).toBe(true);
        expect(norm(f.textContent ?? ""), r).toContain(D.footerLine);
        const inLine = ls.find(
          (a) =>
            (a.textContent ?? "").includes(D.linkName) &&
            norm(a.closest("p, span, div, li")?.textContent ?? "").includes(D.footerLine),
        );
        expect(inLine, `${r}: title in the line is the link`).toBeTruthy();
        cleanup();
      }
    });

    it("criterion 4: consent line directly under Test connection, linking to the disclaimer, no checkbox", () => {
      setup("#/app", lang);
      const name = lang === "en" ? "Test connection" : "测试连接";
      const btn = within(main()).getByRole("button", { name });
      const lineEl = consentLineEl(D.consentLine) as Element;
      expect(lineEl, "consent line element").toBeTruthy();
      const a = lineEl.querySelector("a") as HTMLAnchorElement;
      expect(a.getAttribute("href")).toBe("#/disclaimer");
      expect(a.textContent).toContain(D.linkName);
      expect(btn.compareDocumentPosition(lineEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const between = Array.from(main().querySelectorAll("button, input, select, textarea, a")).filter(
        (e) =>
          e !== btn &&
          !lineEl.contains(e) &&
          btn.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING &&
          lineEl.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING,
      );
      expect(between).toHaveLength(0);
      expect(lineEl.querySelector("input[type=checkbox]")).toBeNull();
    });

    it("criterion 4: nothing is stored after rendering and clicking", () => {
      const before = snapshot();
      setup("#/app", lang);
      const lineEl = consentLineEl(D.consentLine);
      expect(lineEl).toBeTruthy();
      fireEvent.click(lineEl?.querySelector("a") as HTMLAnchorElement);
      expect(snapshot()).toEqual(before);
    });

    it("criterion 5: Privacy page ends with a link to the disclaimer", () => {
      setup("#/privacy", lang);
      const ls = links(main());
      expect(ls.length).toBeGreaterThanOrEqual(1);
      const all = Array.from(main().querySelectorAll("a"));
      expect(all[all.length - 1]?.getAttribute("href")).toBe("#/disclaimer");
      expect(ls[0]?.textContent).toContain(D.linkName);
      const blocks = Array.from(main().querySelectorAll("p, li"));
      expect(blocks[blocks.length - 1]?.contains(ls[ls.length - 1] as Element)).toBe(true);
    });

    it("criterion 5: FAQ has no disclaimer link in its content", () => {
      setup("#/faq", lang);
      expect(links(main())).toHaveLength(0);
    });
  });
}

describe("criterion 7: dictionaries", () => {
  it("same shape, no empty string", () => {
    expect(shape(zh)).toEqual(shape(en));
    for (const d of [en, zh]) for (const v of leafValues(d)) expect(v.trim()).not.toBe("");
  });
  it("disclaimer text is stored exactly once per language", () => {
    for (const lang of ["en", "zh"] as const) {
      const leaves = leafValues(lang === "en" ? en : zh).map(norm);
      for (const [lead, body] of DISCLAIMER[lang].items) {
        expect(leaves.filter((v) => v.includes(norm(body))), `${lang} body: ${body.slice(0, 30)}`).toHaveLength(1);
        expect(leaves.some((v) => v.includes(norm(lead))), `${lang} lead: ${lead}`).toBe(true);
      }
      expect(leaves.some((v) => v.includes(DISCLAIMER[lang].updated.replace(/^[^：:]+[：:]\s*/, "")))).toBe(true);
    }
  });
});
