import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";
import { FAQ, STEPS } from "./info-pages-fixtures.ts";

type Dict = Record<string, string>;
const pick = (m: Record<string, unknown>, name: string): Dict => (m.default ?? m[name]) as Dict;
const en = pick(enMod, "en");
const zh = pick(zhMod, "zh");

const TAG = { en: "en-US", zh: "zh-CN" } as const;
type L = "en" | "zh";
const norm = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

function setup(hash: string, lang: L) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(TAG[lang]);
  window.location.hash = hash;
  return render(<App />);
}
const main = () => screen.getByRole("main");
const mainText = () => norm(main().textContent ?? "");

beforeEach(() => {
  window.location.hash = "";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("criterion 1: FAQ exact text and order", () => {
  for (const lang of ["en", "zh"] as const) {
    it(`every question and answer in order, ${lang}`, () => {
      setup("#/faq", lang);
      const text = mainText();
      let pos = -1;
      for (const qa of FAQ) {
        const q = norm(lang === "en" ? qa.enQ : qa.zhQ);
        const a = norm(lang === "en" ? qa.enA : qa.zhA);
        const qi = text.indexOf(q, pos + 1);
        expect(qi, `question missing or out of order: ${q}`).toBeGreaterThan(pos);
        const ai = text.indexOf(a, qi + q.length);
        expect(ai, `answer missing or out of order: ${a}`).toBeGreaterThanOrEqual(qi + q.length);
        pos = ai;
      }
    });
    it(`each question is a heading, summary or button, ${lang}`, () => {
      setup("#/faq", lang);
      const els = Array.from(main().querySelectorAll("h2, h3, summary, button, [role=button]"));
      const texts = els.map((e) => norm(e.textContent ?? ""));
      for (const qa of FAQ) {
        const q = norm(lang === "en" ? qa.enQ : qa.zhQ);
        expect(
          texts.some((t) => t.includes(q)),
          `no heading/summary/button for: ${q}`,
        ).toBe(true);
      }
    });
    it(`FAQ controls are keyboard reachable, ${lang}`, () => {
      setup("#/faq", lang);
      expect(main().querySelectorAll("[tabindex='-1']").length).toBe(0);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    });
  }
});

describe("criterion 2: How it works", () => {
  for (const lang of ["en", "zh"] as const) {
    it(`h1 and six ordered steps, ${lang}`, () => {
      setup("#/how-it-works", lang);
      expect(screen.getByRole("heading", { level: 1 }).textContent?.trim()).toBe(
        lang === "en" ? "How it works" : "工作原理",
      );
      const ol = main().querySelector("ol");
      expect(ol).not.toBeNull();
      const items = Array.from(ol?.querySelectorAll(":scope > li") ?? []).map((li) => norm(li.textContent ?? ""));
      expect(items).toHaveLength(6);
      STEPS[lang].forEach(([title, line], i) => {
        const item = items[i] ?? "";
        expect(item).toContain(norm(title ?? ""));
        expect(item).toContain(norm(line ?? ""));
        expect(item.indexOf(norm(title ?? ""))).toBeLessThan(item.indexOf(norm(line ?? "")));
      });
    });
    it(`diagram without image file, ${lang}`, () => {
      setup("#/how-it-works", lang);
      const t = mainText();
      const parts =
        lang === "en"
          ? ["Your browser", "Anthropic (with your key)", "JD2CV server: none"]
          : ["你的浏览器", "Anthropic（使用你的 key）", "JD2CV 服务器：没有"];
      for (const p of parts) expect(t).toContain(p);
      expect(t).toContain("⇄");
      expect(main().querySelectorAll("img").length).toBe(0);
    });
    it(`AI does and AI never lists, ${lang}`, () => {
      setup("#/how-it-works", lang);
      const headingText = lang === "en" ? ["The AI does", "The AI never"] : ["AI 会做", "AI 不会做"];
      const lists = headingText.map((h) => {
        const heading = Array.from(main().querySelectorAll("h2, h3, h4, p, strong")).find(
          (e) => norm(e.textContent ?? "") === h,
        );
        expect(heading, `heading ${h}`).toBeTruthy();
        let node: Element | null = heading as Element;
        let ul: Element | null = null;
        while (node && !ul) {
          const sib: Element | null = node.nextElementSibling;
          ul = sib ? (sib.matches("ul") ? sib : sib.querySelector("ul")) : null;
          if (!ul) node = node.parentElement && node.parentElement !== main() ? node.parentElement : null;
        }
        expect(ul, `list after ${h}`).toBeTruthy();
        return Array.from(ul?.querySelectorAll(":scope > li") ?? []).map((li) => norm(li.textContent ?? "").toLowerCase());
      });
      const first = lists[0] ?? [];
      const second = lists[1] ?? [];
      if (lang === "en") {
        const does = first.join(" | ");
        for (const w of ["rephrase", "reorder", "merge", "translate", "match the jd's wording to skills you already have"])
          expect(does).toContain(w);
        const never = second.join(" | ");
        expect(never).toContain("add employers, titles, dates, degrees, numbers or skills");
        expect(never).toContain("drop anything without listing it");
      } else {
        expect(first.length).toBeGreaterThanOrEqual(2);
        expect(second.length).toBeGreaterThanOrEqual(2);
      }
    });
  }
});

describe("criterion 3: Contact", () => {
  const T = {
    en: {
      h1: "Contact us",
      line: "Questions, ideas or a bug? Email us and we will reply as soon as we can.",
      btn: "Send an email",
      include: ["what you did", "what happened", "your browser and device", "a screenshot with personal details hidden"],
      note: "Please do not email your API key or your full resume.",
      faq: "FAQ",
      how: "How it works",
    },
    zh: {
      h1: "联系我们",
      line: "有问题、建议或发现了 bug，都欢迎发邮件告诉我们，我们会尽快回复。",
      btn: "发送邮件",
      include: ["你做了什么", "发生了什么", "浏览器和设备", "截图（请遮住个人信息）"],
      note: "请不要在邮件里发送你的 API key 或完整简历。",
      faq: "常见问题",
      how: "工作原理",
    },
  };
  for (const lang of ["en", "zh"] as const) {
    it(`content, ${lang}`, () => {
      const c = T[lang];
      setup("#/contact", lang);
      expect(screen.getByRole("heading", { level: 1 }).textContent?.trim()).toBe(c.h1);
      const m = within(main());
      expect(m.getByText(c.line)).toBeTruthy();
      expect(m.getByRole("link", { name: c.btn }).getAttribute("href")).toBe(
        "mailto:jd2cv.admin@gmail.com?subject=JD2CV%20feedback",
      );
      expect(mainText()).toContain("jd2cv.admin@gmail.com");
      const t = mainText().toLowerCase();
      for (const i of c.include) expect(t).toContain(i.toLowerCase());
      expect(m.getByText(c.note)).toBeTruthy();
      expect(m.getByRole("link", { name: c.faq }).getAttribute("href")).toBe("#/faq");
      expect(m.getByRole("link", { name: c.how }).getAttribute("href")).toBe("#/how-it-works");
      expect(main().querySelectorAll("form, input, textarea").length).toBe(0);
    });
    it(`the four helpful items are list items, ${lang}`, () => {
      setup("#/contact", lang);
      const lis = Array.from(main().querySelectorAll("li")).map((l) => norm(l.textContent ?? "").toLowerCase());
      for (const i of T[lang].include) expect(lis.some((l) => l.includes(i.toLowerCase()))).toBe(true);
    });
  }
});

describe("criterion 4: Contact page reads CONTACT_EMAIL only", () => {
  it("source references the constant, not a literal address", () => {
    const src = readFileSync("src/pages/Contact.tsx", "utf8");
    expect(src).toMatch(/CONTACT_EMAIL/);
    expect(src).not.toMatch(/jd2cv\.admin@gmail\.com/);
    expect(src).not.toMatch(/example\.com/);
  });
});

describe("criterion 6: Privacy", () => {
  const P = {
    en: [
      "We have no server, no database, no account system, no analytics and no ads, and we set no cookies.",
      "What you type stays in this page's memory unless you choose to save a draft or your key in this browser; \"Delete all my data\" removes both.",
      "When you use an AI action, your resume and the job description are sent from your browser to Anthropic with your API key,",
      "Hosting: Cloudflare Pages serves the site's files.",
      "Contact:",
    ],
    zh: [
      "我们没有服务器、没有数据库、没有账号系统、没有统计工具、没有广告，也不设置任何 Cookie。",
      "你输入的内容只保存在当前页面的内存里，除非你选择在这个浏览器里保存草稿或 key；\"删除我的所有数据\"会把两者一并删除。",
      "当你使用 AI 功能时，你的简历和职位描述会连同你的 API key 一起从你的浏览器发送给 Anthropic，适用 Anthropic 的",
      "托管：网站文件由 Cloudflare Pages 提供。",
      "联系方式：",
    ],
  };
  for (const lang of ["en", "zh"] as const) {
    it(`text and links, ${lang}`, () => {
      setup("#/privacy", lang);
      const t = mainText();
      for (const s of P[lang]) expect(t).toContain(norm(s));
      const a = main().querySelector('a[href="https://www.anthropic.com/legal/privacy"]');
      expect(a).not.toBeNull();
      const rel = (a?.getAttribute("rel") ?? "").split(/\s+/);
      expect(rel).toContain("noopener");
      expect(rel).toContain("noreferrer");
      expect(main().querySelector('a[href="#/contact"]')).not.toBeNull();
    });
  }
});

describe("criterion 7: dictionaries", () => {
  it("never claim data never leaves the browser", () => {
    for (const d of [en, zh]) for (const v of Object.values(d)) expect(v).not.toMatch(/never leaves|不会离开/i);
  });
  it("same keys in en and zh, none empty", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    for (const d of [en, zh]) for (const v of Object.values(d)) expect(String(v).trim()).not.toBe("");
  });
  it("rendered info pages never claim it either", () => {
    for (const lang of ["en", "zh"] as const)
      for (const h of ["#/how-it-works", "#/faq", "#/contact", "#/privacy"]) {
        setup(h, lang);
        expect(document.body.textContent ?? "").not.toMatch(/never leaves|不会离开/i);
        cleanup();
      }
  });
  it("FAQ texts live in the dictionaries", () => {
    const enAll = Object.values(en).map(norm).join("\n");
    const zhAll = Object.values(zh).map(norm).join("\n");
    for (const qa of FAQ) {
      expect(enAll).toContain(norm(qa.enQ));
      expect(enAll).toContain(norm(qa.enA));
      expect(zhAll).toContain(norm(qa.zhQ));
      expect(zhAll).toContain(norm(qa.zhA));
    }
  });
});
