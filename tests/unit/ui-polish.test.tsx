import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import { CONTACT_EMAIL } from "../../src/config.ts";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";

// #42 ui-polish (brief v6 sections 5 to 7). Synthetic data only.
type Dict = Record<string, string>;
const pick = (m: Record<string, unknown>, name: string): Dict => (m.default ?? m[name]) as Dict;
const en = pick(enMod, "en");
const zh = pick(zhMod, "zh");

type L = "en" | "zh";
const TAG = { en: "en-US", zh: "zh-CN" } as const;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function setup(hash: string, lang: L) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(TAG[lang]);
  window.location.hash = hash;
  return render(<App />);
}
const main = () => screen.getByRole("main");
const header = () => screen.getByRole("banner");

const SVG_DIR = "src/assets/illustrations";
const HASH = {
  zh: "07c5b7e29b58f106e7abb50762ff619d24e63303c7520cd1a15ba8f5c99d04e9",
  en: "83039c382468e2a4a1234f531809821de7968fe05d9a41f2d099b860aa98fec6",
} as const;

beforeEach(() => {
  window.location.hash = "";
  document.head.querySelectorAll('meta[name="description"]').forEach((m) => m.remove());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "clipboard");
  window.getSelection()?.removeAllRanges();
});

const metaDesc = () => document.head.querySelector('meta[name="description"]')?.getAttribute("content");

describe("criterion 1: header sub-label, title and meta description", () => {
  it("zh header has no sub-label, Layout no longer defines one", () => {
    setup("#/", "zh");
    expect(within(header()).queryByText("对岗简历")).toBeNull();
    expect(header().textContent).not.toContain("对岗简历");
    expect(readFileSync("src/app/Layout.tsx", "utf8")).not.toContain("BRAND_SUB");
  });
  it("zh title and description", () => {
    setup("#/", "zh");
    expect(document.title).toBe("JD2CV · 对岗简历");
    expect(metaDesc()).toBe(`JD2CV · 对岗简历：${zh["home.sub"]}`);
  });
  it("en title and description", () => {
    setup("#/", "en");
    expect(document.title).toBe("JD2CV");
    expect(metaDesc()).toBe(`JD2CV: ${en["home.sub"]}`);
  });
  it("updates when the language changes, and reuses one meta element", () => {
    setup("#/", "en");
    fireEvent.click(within(header()).getByRole("button", { name: /中文/ }));
    expect(document.title).toBe("JD2CV · 对岗简历");
    expect(metaDesc()).toBe(`JD2CV · 对岗简历：${zh["home.sub"]}`);
    fireEvent.click(within(header()).getByRole("button", { name: /EN/ }));
    expect(document.title).toBe("JD2CV");
    expect(metaDesc()).toBe(`JD2CV: ${en["home.sub"]}`);
    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
  });
});

describe("criterion 3: contact fallbacks", () => {
  const T = {
    en: {
      btn: "Send an email",
      copy: /^Copy address/,
      copied: /Copied/,
      gmail: /Write in Gmail/,
      line: "If nothing happens, this computer has no default mail app. Copy the address and write from your usual mailbox.",
    },
    zh: {
      btn: "发送邮件",
      copy: /^复制邮箱/,
      copied: /已复制/,
      gmail: /用 Gmail 网页版写信/,
      line: "如果点按钮没有反应，说明这台电脑没有设置默认邮件应用。可以复制地址，在你常用的邮箱里发送。",
    },
  };
  for (const lang of ["en", "zh"] as const) {
    const c = T[lang];
    it(`mailto button unchanged, ${lang}`, () => {
      setup("#/contact", lang);
      expect(within(main()).getByRole("link", { name: c.btn }).getAttribute("href")).toBe(
        "mailto:jd2cv.admin@gmail.com?subject=JD2CV%20feedback",
      );
    });
    it(`Gmail link, ${lang}`, () => {
      setup("#/contact", lang);
      const a = within(main()).getByRole("link", { name: c.gmail });
      expect(a.getAttribute("href")).toBe(
        "https://mail.google.com/mail/?view=cm&to=jd2cv.admin@gmail.com&su=JD2CV%20feedback",
      );
      expect(a.getAttribute("href")).toContain(`to=${CONTACT_EMAIL}&`);
      expect(a.getAttribute("target")).toBe("_blank");
      expect((a.getAttribute("rel") ?? "").split(/\s+/).sort()).toEqual(["noopener", "noreferrer"]);
    });
    it(`explanation line sits under the buttons, ${lang}`, () => {
      setup("#/contact", lang);
      const m = within(main());
      const line = m.getByText(c.line);
      const mail = m.getByRole("link", { name: c.btn });
      const gmail = m.getByRole("link", { name: c.gmail });
      const copy = m.getByRole("button", { name: c.copy });
      for (const el of [mail, gmail, copy])
        expect(el.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    it(`copy writes CONTACT_EMAIL, label changes for 2 s, then returns, ${lang}`, async () => {
      vi.useFakeTimers();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      setup("#/contact", lang);
      const btn = within(main()).getByRole("button", { name: c.copy });
      const before = btn.textContent;
      await act(async () => {
        fireEvent.click(btn);
      });
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith(CONTACT_EMAIL);
      expect(btn.textContent).toMatch(c.copied);
      await act(async () => {
        vi.advanceTimersByTime(1900);
      });
      expect(btn.textContent).toMatch(c.copied);
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(btn.textContent).toBe(before);
    });
    for (const mode of ["missing", "rejects"] as const) {
      it(`clipboard ${mode}: the address text is selected, ${lang}`, async () => {
        if (mode === "rejects") {
          const writeText = vi.fn().mockRejectedValue(new Error("denied"));
          Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
        }
        setup("#/contact", lang);
        const btn = within(main()).getByRole("button", { name: c.copy });
        await act(async () => {
          fireEvent.click(btn);
        });
        expect(norm(window.getSelection()?.toString() ?? "")).toBe(CONTACT_EMAIL);
        expect(btn.textContent).not.toMatch(c.copied);
      });
    }
  }
  it("Contact still reads the address from CONTACT_EMAIL only", () => {
    const src = readFileSync("src/pages/Contact.tsx", "utf8");
    expect(src).toMatch(/CONTACT_EMAIL/);
    expect(src).not.toMatch(/jd2cv\.admin@gmail\.com/);
  });
});

describe("criterion 4: illustration files", () => {
  for (const lang of ["zh", "en"] as const) {
    const path = `${SVG_DIR}/how-it-works-${lang}.svg`;
    it(`${lang}: byte for byte, no script, href or url(`, () => {
      expect(existsSync(path), `${path} exists`).toBe(true);
      const buf = readFileSync(path);
      expect(createHash("sha256").update(buf).digest("hex")).toBe(HASH[lang]);
      const s = buf.toString("utf8");
      expect(s.endsWith("\n")).toBe(false);
      expect(s.includes("\n")).toBe(false);
      expect(s).not.toContain("<script");
      expect(s).not.toContain("href");
      expect(s).not.toContain("url(");
    });
  }
});

describe("criterion 5: illustration on the How it works page", () => {
  const ALT = {
    zh: "粘贴 → 选择 → AI 改写 → 逐条核对 → 导出",
    en: "Paste → Choose → AI rewrites → Check every line → Export",
  } as const;
  for (const lang of ["zh", "en"] as const) {
    it(`${lang}: img with the site language file, alt text, before the text steps`, () => {
      setup("#/how-it-works", lang);
      const img = within(main()).getByAltText(ALT[lang]) as HTMLImageElement;
      expect(img.tagName).toBe("IMG");
      const src = img.getAttribute("src") ?? "";
      expect(src).toMatch(new RegExp(`how-it-works-${lang}[^/]*\\.svg(\\?.*)?$`));
      expect(src).not.toMatch(/^data:/);
      expect(main().querySelector("svg")).toBeNull();
      const ol = main().querySelector("ol");
      expect(ol).not.toBeNull();
      expect(img.compareDocumentPosition(ol as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(ol?.querySelectorAll(":scope > li").length).toBe(6);
    });
  }
  it("switching language switches the file", () => {
    setup("#/how-it-works", "en");
    fireEvent.click(within(header()).getByRole("button", { name: /中文/ }));
    const img = within(main()).getByAltText(ALT.zh);
    expect(img.getAttribute("src")).toMatch(/how-it-works-zh/);
  });
});

describe("criterion 6: strings in both dictionaries", () => {
  it("new keys exist in en and zh with the same key set", () => {
    const keys = (d: Dict) => Object.keys(d).sort();
    expect(keys(zh)).toEqual(keys(en));
    const all = (d: Dict) => Object.values(d).map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join("\n");
    expect(all(en)).toContain("Copy address");
    expect(all(en)).toContain("Write in Gmail");
    expect(all(zh)).toContain("复制邮箱");
    expect(all(zh)).toContain("用 Gmail 网页版写信");
  });
});
