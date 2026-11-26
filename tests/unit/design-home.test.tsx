import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";

// Criterion 3 and 4 of #19: exact Home texts from the design reference, both languages.
// Class names are free; everything is found by role, tag and text. Synthetic sample only (Jamie Lin / 林嘉明).

type L = "en" | "zh";
const TAG = { en: "en-US", zh: "zh-CN" } as const;
const REPO = "https://github.com/humyna-labs/resume-sg";

const T = {
  zh: {
    start: "开始定制",
    eyebrow: ["免费", "无需注册", "不存你的任何数据"],
    h1Plain: "简历，",
    h1Muted: "对准这个岗位。",
    sub: "粘贴职位描述，AI 帮你把简历改成这个岗位要的样子：1 到 2 页，中文或英文，不编造任何经历。",
    how: "了解工作原理 ›",
    jdTag: "职位描述",
    jdT: "高级后端工程师 · 支付平台",
    jd: ["负责支付清算核心系统的设计与演进", "有高并发交易系统经验，熟悉 Kafka", "能带领小团队，推动工程质量"],
    marks: ["支付清算", "高并发", "Kafka"],
    cvTag: "定制后的简历",
    cvT: "林嘉明 · 高级后端工程师",
    cv: [
      "主导清算服务重构，日终批处理从 4 小时缩短到 35 分钟",
      "幂等支付接口峰值每秒 1,200 笔交易",
      "14 个服务迁移到 Kafka 事件架构，零停机",
    ],
    bolds: ["清算服务", "Kafka"],
    badge: "公司、日期、数字已逐项核对",
    note: "原简历里没有的内容会标红，处理之前不能导出。",
    s1: "放心用，是因为这三点",
    s1l: "不注册、不收费、不存数据，AI 也不替你编造经历。",
    f: [
      ["完全免费", "没有付费功能，没有广告，也不用注册。AI 用你自己的 Anthropic key，按实际用量向 Anthropic 付费。"],
      ["数据安全", "我们没有服务器，不存任何数据。key 默认只在当前页面的内存里，只发给 Anthropic。"],
      ["绝不编造", "AI 只改写、调整顺序、合并和翻译。公司、职位、日期、学历和数字由程序逐项核对。"],
    ],
    s2: "三步完成",
    s2l: "每个岗位一份简历，几分钟就够。",
    st: [
      ["放入原简历", "粘贴原简历的文字让 AI 整理，或者逐项填写。"],
      ["粘贴职位描述", "选择中文或英文，以及定制方式：均衡、突出成果或转行。"],
      ["核对并导出", "看改动清单和标红项，选模板，导出 PDF 或 Markdown。"],
    ],
    band: "为下一个岗位，准备一份对的简历。",
    foot: ["隐私", "MIT 许可证", "源代码", "联系我们"],
    footL: "JD2CV · 独立开源项目",
  },
  en: {
    start: "Start",
    eyebrow: ["Free", "No sign-up", "We store nothing"],
    h1Plain: "Your resume,",
    h1Muted: "aimed at this job.",
    sub: "Paste a job description and AI tailors your resume to it: one or two pages, in English or Chinese, with nothing made up.",
    how: "How it works ›",
    jdTag: "Job description",
    jdT: "Senior Backend Engineer · Payments",
    jd: [
      "Own the design of the core settlement platform",
      "Experience with high-throughput systems and Kafka",
      "Lead a small team and raise engineering quality",
    ],
    marks: ["settlement", "high-throughput", "Kafka"],
    cvTag: "Tailored resume",
    cvT: "Jamie Lin · Senior Backend Engineer",
    cv: [
      "Led the settlement service redesign; end-of-day batch from 4 hours to 35 minutes",
      "Idempotent payment API handling 1,200 transactions per second at peak",
      "Moved 14 services to Kafka events with zero downtime",
    ],
    bolds: ["settlement service", "Kafka"],
    badge: "Employers, dates and numbers checked",
    note: "Anything not in your original is highlighted, and export waits until you deal with it.",
    s1: "Three reasons you can trust it",
    s1l: "No account, no fee, no stored data, and the AI never invents your experience.",
    f: [
      ["Free", "No paid features, no ads, no sign-up. The AI runs on your own Anthropic key; you pay Anthropic only for what you use."],
      ["Your data stays yours", "We have no server and store nothing. Your key lives in this page's memory by default and goes only to Anthropic."],
      ["Never invents facts", "The AI only rephrases, reorders, merges and translates. Employers, titles, dates, degrees and numbers are checked by code."],
    ],
    s2: "Three steps",
    s2l: "One resume per job, in a few minutes.",
    st: [
      ["Add your resume", "Paste your resume text for the AI to organise, or fill in the form."],
      ["Paste the job description", "Pick English or Chinese and a mode: Balanced, Results-first or Career switch."],
      ["Check and export", "Review what changed and anything in red, pick a template, export PDF or Markdown."],
    ],
    band: "Get the right resume for your next job.",
    foot: ["Privacy", "MIT licence", "Source code", "Contact"],
    footL: "JD2CV · an independent open-source project",
  },
} as const;

const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

function setup(lang: L) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(TAG[lang]);
  window.location.hash = "#/";
  return render(<App />);
}
const main = () => screen.getByRole("main");
const footer = () => screen.getAllByRole("contentinfo")[0] as HTMLElement;

/** Elements under root whose whole normalised text equals `text`. */
function withText(root: Element, text: string, selector = "*"): Element[] {
  return Array.from(root.querySelectorAll(selector)).filter((e) => norm(e.textContent) === text);
}
function expectText(root: Element, text: string, selector = "*") {
  expect(withText(root, text, selector).length, `missing element with text: ${text}`).toBeGreaterThan(0);
}
/** Largest ancestor of `el` (inside root) that does not contain any of the `others` texts. */
function cardOf(root: Element, el: Element, others: string[]): Element {
  let node = el;
  while (node.parentElement && node.parentElement !== root) {
    const p = node.parentElement;
    if (others.some((o) => norm(p.textContent).includes(o))) break;
    node = p;
  }
  return node;
}

beforeEach(() => {
  window.location.hash = "";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

for (const lang of ["en", "zh"] as const) {
  const c = T[lang];
  describe(`Home design-spec v1 texts, ${lang}`, () => {
    it("eyebrow pill carries the three claims", () => {
      setup(lang);
      expectText(main(), c.eyebrow.join(" · "));
    });

    it("h1 has the plain half and a separate muted second-half element", () => {
      setup(lang);
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(norm(h1.textContent)).toBe(`${c.h1Plain}${lang === "en" ? " " : ""}${c.h1Muted}`);
      const muted = Array.from(h1.children).filter((e) => norm(e.textContent) === c.h1Muted);
      expect(muted.length, "second half must be its own child element").toBe(1);
      expect(norm(h1.firstChild?.textContent)).toBe(c.h1Plain);
    });

    it("sub line, primary button to #/app and ghost link to #/how-it-works", () => {
      setup(lang);
      const m = within(main());
      expectText(main(), c.sub);
      const starts = m.getAllByRole("link", { name: c.start });
      expect(starts.length).toBeGreaterThanOrEqual(2); // hero and closing band
      for (const a of starts) expect(a.getAttribute("href")).toBe("#/app");
      expect(m.getByRole("link", { name: c.how }).getAttribute("href")).toBe("#/how-it-works");
    });

    it("JD to AI to tailored resume visual: two cards and the arrow, from HTML and CSS", () => {
      setup(lang);
      const m = main();
      for (const s of [c.jdTag, c.jdT, c.cvTag, c.cvT, c.badge, "AI →"]) expectText(m, s);
      for (const s of c.jd) expectText(m, s);
      for (const s of c.cv) expectText(m, s);
      expect(m.querySelectorAll("img").length).toBe(0);
      // order in the document: JD card, arrow, resume card
      const text = norm(m.textContent);
      expect(text.indexOf(c.jdT)).toBeLessThan(text.indexOf("AI →"));
      expect(text.indexOf("AI →")).toBeLessThan(text.indexOf(c.cvT));
    });

    it("JD keywords are in mark elements, bold phrases in b elements, as React elements", () => {
      setup(lang);
      const marks = Array.from(main().querySelectorAll("mark")).map((e) => norm(e.textContent));
      expect(marks).toEqual([...c.marks]);
      const bolds = Array.from(main().querySelectorAll("b")).map((e) => norm(e.textContent));
      expect(bolds).toEqual([...c.bolds]);
      // no raw tag text leaked into the page
      expect(main().textContent ?? "").not.toMatch(/<\/?(span|mark|b)>/);
    });

    it("note under the visual", () => {
      setup(lang);
      expectText(main(), c.note);
    });

    it("three reason cards with icons, then the lead", () => {
      setup(lang);
      const m = main();
      expect(within(m).getByRole("heading", { level: 2, name: c.s1 })).toBeTruthy();
      expectText(m, c.s1l);
      const titles = c.f.map((f) => f[0]);
      c.f.forEach(([title, body], i) => {
        const h3 = within(m).getByRole("heading", { level: 3, name: title });
        const card = cardOf(m, h3, titles.filter((_, j) => j !== i));
        expect(norm(card.textContent)).toContain(body);
        expect(card.querySelector("svg"), `icon in card ${title}`).not.toBeNull();
      });
    });

    it("three step cards numbered 1 to 3", () => {
      setup(lang);
      const m = main();
      expect(within(m).getByRole("heading", { level: 2, name: c.s2 })).toBeTruthy();
      expectText(m, c.s2l);
      const titles = c.st.map((s) => s[0]);
      c.st.forEach(([title, body], i) => {
        const h3 = within(m).getByRole("heading", { level: 3, name: title });
        const card = cardOf(m, h3, titles.filter((_, j) => j !== i));
        const text = norm(card.textContent);
        expect(text).toContain(body);
        expect(text.startsWith(String(i + 1)), `step number ${i + 1} before the title`).toBe(true);
      });
    });

    it("closing band with a heading and a button to #/app", () => {
      setup(lang);
      const h2 = within(main()).getByRole("heading", { level: 2, name: c.band });
      const band = cardOf(main(), h2, [c.s2, c.s1]);
      const btn = within(band as HTMLElement).getByRole("link", { name: c.start });
      expect(btn.getAttribute("href")).toBe("#/app");
    });

    it("footer: project line left, four links right", () => {
      setup(lang);
      const f = within(footer());
      expect(norm(footer().textContent)).toContain(c.footL);
      expect(f.getByRole("link", { name: c.foot[0] }).getAttribute("href")).toBe("#/privacy");
      expect(norm(footer().textContent)).toContain(c.foot[1]);
      expect(f.getByRole("link", { name: c.foot[2] }).getAttribute("href")).toBe(REPO);
      expect(f.getByRole("link", { name: c.foot[3] }).getAttribute("href")).toBe("#/contact");
      const text = norm(footer().textContent);
      expect(text.indexOf(c.footL)).toBeLessThan(text.indexOf(c.foot[0]));
    });

    it("exactly one h1 and no template leftovers; sample data is synthetic", () => {
      setup(lang);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(document.body.textContent ?? "").toContain(lang === "en" ? "Jamie Lin" : "林嘉明");
    });
  });
}
