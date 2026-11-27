// resume-sg#41 (flow-wizard, brief v6 sections 1, 3 and 4): criteria 1, 3, 4, 5, 6, 8, 9, 10 and 13.
// Fake fetch, fake key, synthetic data. Test hooks: see tests/unit/flow-helpers.tsx
// (wizard-progress, step-heading, step-footer, step-next, generate-hint, key-row), plus:
//  - counters data-testid="resume-counter" (step 1) and "jd-counter" (step 2); over the limit they carry data-over="true"
//  - step 4 summary data-testid="step4-summary" with rows data-row="resume" | "jd" | "options", each with an
//    "修改 / Edit" button
//  - RESUME_MAX_CHARS and JD_MAX_CHARS exported from a module in src/features/tailor/ (found by name, any file)
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../src/i18n/en.ts";
import zh from "../../src/i18n/zh.ts";
import { FAKE_KEY, JD_EN, ORIGINAL_EN, apiOutput, validOutput } from "../fixtures/tailor-flow.ts";
import { FAQ } from "./info-pages-fixtures.ts";
import { leafValues, shape } from "./dict-helpers.ts";
import {
  NEXT, TXT, activate, backBtn, control, deferredApi, generateBtn, goNext, isSelected, jdBox, main, mainText, norm,
  renderApp, resetStores, resumeBox, startFlow, stepHeading, stepNext, typeInto, walkTo, withKey,
} from "./flow-helpers.tsx";
import type { L } from "./flow-helpers.tsx";

const LANGS = ["en", "zh"] as const;
const click = (el: HTMLElement) => fireEvent.click(el);
const fmt = (n: number) => n.toLocaleString("en-US");
const hints = () => Array.from(document.querySelectorAll<HTMLElement>("[data-testid=generate-hint] [data-hint]"));
const hintText = () => norm(screen.getByTestId("generate-hint").textContent ?? "");
const nodes = () => Array.from(screen.getByTestId("wizard-progress").querySelectorAll<HTMLElement>("li"));
const heading = () => norm(stepHeading().textContent ?? "");

const limits = import.meta.glob("../../src/features/tailor/*.{ts,tsx}", { eager: true }) as Record<string, Record<string, unknown>>;
const exported = (name: string): unknown => Object.values(limits).map((m) => m[name]).find((v) => v !== undefined);

beforeEach(() => {
  resetStores();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetStores();
});

const T = {
  en: {
    steps: ["Your resume", "Job description", "Template & mode", "Generate", "Result"],
    over: (n: string) => `Over ${n} characters; remove parts that are not about your work`,
    counter: (n: number, max: string) => `${fmt(n)} / ${max} characters`,
    edit: "Edit",
    modes: [/^balanced$/i, /^results-first$/i, /^career switch$/i],
    desc: [
      "Keeps your resume's emphasis and order, brings forward what matches the job, and stays neutral. Right for most cases.",
      "Leads each role with measurable results: numbers, scale, impact. Duties come after. Uses only numbers from your resume.",
      "For changing direction: transferable skills, projects and achievements come first, and past work is described in the target job's terms, without inventing experience.",
    ],
    tpls: [/^classic/i, /^modern/i],
    summary: "Classic · English · Balanced",
  },
  zh: {
    steps: ["你的简历", "职位描述", "模板与方式", "生成", "结果"],
    over: (n: string) => `超出 ${n} 字，请删去与求职无关的内容`,
    counter: (n: number, max: string) => `${fmt(n)} / ${max} 字`,
    edit: "修改",
    modes: [/^均衡$/, /^突出成果$/, /^转行$/],
    desc: [
      "保留原简历的重点和顺序，把和职位最相关的内容往前放，语气客观。适合大多数情况。",
      "每段经历先写能量化的成果：数字、规模、效果，职责往后放。只用原简历里有的数字。",
      "换方向求职时用：可迁移的技能、项目和成就放到前面，用目标职位的说法描述过去的工作，不虚构经验。",
    ],
    tpls: [/^经典/, /^清新/],
    summary: "经典 · 中文 · 均衡",
  },
} as const;

for (const lang of LANGS) {
  const c = TXT[lang];
  const t = T[lang];

  describe(`criterion 1: progress bar, ${lang}`, () => {
    it("five nodes with the step names, in order, on every step", () => {
      renderApp(lang);
      expect(nodes()).toHaveLength(5);
      nodes().forEach((li, i) => expect(norm(li.textContent ?? "")).toContain(t.steps[i] as string));
    });
    it("step 1: the current node has aria-current=step; the future nodes are not buttons, not focusable, not clickable", () => {
      renderApp(lang);
      const li = nodes();
      expect(li[0]?.querySelector("[aria-current=step]") ?? (li[0]?.getAttribute("aria-current") === "step" ? li[0] : null)).toBeTruthy();
      expect(screen.getByTestId("wizard-progress").querySelectorAll("[aria-current=step]")).toHaveLength(1);
      for (const f of li.slice(1)) {
        expect(f.querySelector("button, a[href], input, [tabindex]:not([tabindex='-1'])")).toBeNull();
        expect(f.hasAttribute("aria-current")).toBe(false);
        fireEvent.click(f);
        fireEvent.click(f.firstElementChild ?? f);
      }
      expect(resumeBox(lang)).toBeTruthy();
      expect(li.map((x) => x.dataset.state)).toEqual(["current", "todo", "todo", "todo", "todo"]);
    });
    it("done nodes show a tick and are buttons that go back to their step; the current one moves", () => {
      startFlow(lang, { stopAt: 3 });
      expect(nodes().map((x) => x.dataset.state)).toEqual(["done", "done", "current", "todo", "todo"]);
      expect(screen.getByTestId("wizard-progress").querySelectorAll("[aria-current=step]")).toHaveLength(1);
      expect(norm(nodes()[0]?.textContent ?? "")).toContain("✓");
      expect(norm(nodes()[1]?.textContent ?? "")).toContain("✓");
      expect(norm(nodes()[2]?.textContent ?? "")).not.toContain("✓");
      expect(nodes()[3]?.querySelector("button")).toBeNull();
      click(within(nodes()[1] as HTMLElement).getByRole("button"));
      expect(jdBox(lang).value).toBe(JD_EN);
      expect(nodes().map((x) => x.dataset.state)).toEqual(["done", "current", "todo", "todo", "todo"]);
      click(within(nodes()[0] as HTMLElement).getByRole("button"));
      expect(resumeBox(lang).value).toBe(ORIGINAL_EN);
    });
    it("a future node stays unreachable after going back: no jump forward by clicking", () => {
      startFlow(lang, { stopAt: 3 });
      click(within(nodes()[0] as HTMLElement).getByRole("button"));
      expect(nodes()[2]?.querySelector("button")).toBeNull();
      fireEvent.click(nodes()[2] as HTMLElement);
      expect(resumeBox(lang)).toBeTruthy();
    });
  });

  describe(`criterion 3: card footer, ${lang}`, () => {
    it("step 1: no Back; the primary button is named after step 2 and sits in the footer", () => {
      renderApp(lang);
      const foot = screen.getByTestId("step-footer");
      expect(within(foot).queryByRole("button", { name: /^(← Back|← 上一步)$/ })).toBeNull();
      expect(norm(stepNext().textContent ?? "")).toBe(NEXT[lang][0]);
      expect(foot.contains(stepNext())).toBe(true);
    });
    it("steps 2 to 4: Back on the left, the primary button on the right, named after the next step", () => {
      startFlow(lang, { stopAt: 2 });
      for (const [i, name] of [[1, NEXT[lang][1]], [2, NEXT[lang][2]]] as const) {
        const back = backBtn(lang);
        expect(back.compareDocumentPosition(stepNext()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(norm(stepNext().textContent ?? ""), `step ${i + 1}`).toBe(name);
        goNext();
      }
      expect(backBtn(lang)).toBeTruthy();
      expect(norm(stepNext().textContent ?? "")).toBe(norm(c.generate));
      expect(stepNext()).toBe(generateBtn(lang));
    });
    it("step 1 is disabled until there is text, with a plain hint under the button; whitespace is empty", () => {
      renderApp(lang);
      expect(stepNext().disabled).toBe(true);
      expect(hints().map((h) => h.dataset.hint)).toEqual(["resume"]);
      expect(hintText()).not.toBe("");
      typeInto(resumeBox(lang), " \n ");
      expect(stepNext().disabled).toBe(true);
      typeInto(resumeBox(lang), ORIGINAL_EN);
      expect(stepNext().disabled).toBe(false);
      expect(hints()).toHaveLength(0);
    });
    it("step 2 is disabled until the JD has text, with its own hint", () => {
      startFlow(lang, { stopAt: 1 });
      goNext();
      expect(stepNext().disabled).toBe(true);
      expect(hints().map((h) => h.dataset.hint)).toEqual(["jd"]);
      typeInto(jdBox(lang), JD_EN);
      expect(stepNext().disabled).toBe(false);
    });
    it("step 3 can always be passed; step 4 is disabled without a key and says so", () => {
      startFlow(lang, { key: null, stopAt: 3 });
      expect(stepNext().disabled).toBe(false);
      goNext();
      expect(generateBtn(lang).disabled).toBe(true);
      expect(hints().map((h) => h.dataset.hint)).toEqual(["key"]);
    });
    it("Enter inside a textarea inserts a line and never advances", () => {
      renderApp(lang);
      typeInto(resumeBox(lang), ORIGINAL_EN);
      const before = heading();
      for (const type of ["keyDown", "keyPress", "keyUp"] as const) {
        fireEvent[type](resumeBox(lang), { key: "Enter", code: "Enter", charCode: 13 });
      }
      fireEvent.submit(resumeBox(lang));
      expect(resumeBox(lang)).toBeTruthy();
      expect(heading()).toBe(before);
      goNext();
      typeInto(jdBox(lang), JD_EN);
      fireEvent.keyDown(jdBox(lang), { key: "Enter", code: "Enter" });
      expect(jdBox(lang)).toBeTruthy();
    });
  });

  describe(`criterion 4: steps 1 and 2 and their counters, ${lang}`, () => {
    it("step 1: only the resume textarea and its counter with a thousands separator", () => {
      renderApp(lang);
      expect(within(main()).queryByLabelText(c.jd)).toBeNull();
      typeInto(resumeBox(lang), "x".repeat(1286));
      expect(norm(screen.getByTestId("resume-counter").textContent ?? "")).toBe(t.counter(1286, "30,000"));
    });
    it("step 2: only the JD textarea and its counter", () => {
      startFlow(lang, { stopAt: 1 });
      goNext();
      expect(within(main()).queryByLabelText(c.resume)).toBeNull();
      typeInto(jdBox(lang), "y".repeat(412));
      expect(norm(screen.getByTestId("jd-counter").textContent ?? "")).toBe(t.counter(412, "20,000"));
    });
  });

  describe(`criterion 5: input limits, ${lang}`, () => {
    it("30,000 characters of resume is fine; 30,001 turns the counter red, disables Next and says why", () => {
      renderApp(lang);
      typeInto(resumeBox(lang), "x".repeat(30000));
      expect(stepNext().disabled).toBe(false);
      expect(screen.getByTestId("resume-counter").getAttribute("data-over")).not.toBe("true");
      typeInto(resumeBox(lang), "x".repeat(30001));
      expect(resumeBox(lang).value).toHaveLength(30001);
      expect(screen.getByTestId("resume-counter").getAttribute("data-over")).toBe("true");
      expect(norm(screen.getByTestId("resume-counter").textContent ?? "")).toBe(t.counter(30001, "30,000"));
      expect(stepNext().disabled).toBe(true);
      expect(hintText()).toBe(norm(t.over("30,000")));
      typeInto(resumeBox(lang), "x".repeat(30000));
      expect(stepNext().disabled).toBe(false);
    });
    it("20,000 characters of JD is fine; 20,001 behaves the same with its own hint", () => {
      startFlow(lang, { stopAt: 1 });
      goNext();
      typeInto(jdBox(lang), "y".repeat(20000));
      expect(stepNext().disabled).toBe(false);
      typeInto(jdBox(lang), "y".repeat(20001));
      expect(jdBox(lang).value).toHaveLength(20001);
      expect(screen.getByTestId("jd-counter").getAttribute("data-over")).toBe("true");
      expect(stepNext().disabled).toBe(true);
      expect(hintText()).toBe(norm(t.over("20,000")));
    });
    it("no textarea has a maxLength attribute (a paste is never cut)", () => {
      renderApp(lang);
      expect(resumeBox(lang).hasAttribute("maxlength")).toBe(false);
      typeInto(resumeBox(lang), ORIGINAL_EN);
      goNext();
      expect(jdBox(lang).hasAttribute("maxlength")).toBe(false);
      expect(document.querySelectorAll("[maxlength]")).toHaveLength(0);
    });
    it("the FAQ answer about pasting the resume ends with the two limits", () => {
      resetStores();
      cleanup();
      renderApp(lang, "#/faq");
      const qa = FAQ[11];
      const next = FAQ[12];
      expect(qa && next).toBeTruthy();
      const text = norm(main().textContent ?? "");
      const from = text.indexOf(norm(lang === "en" ? (qa as { enQ: string }).enQ : (qa as { zhQ: string }).zhQ));
      const to = text.indexOf(norm(lang === "en" ? (next as { enQ: string }).enQ : (next as { zhQ: string }).zhQ));
      expect(from).toBeGreaterThanOrEqual(0);
      const answer = text.slice(from, to);
      const tail = lang === "en"
        ? "You can paste up to 30,000 characters of resume and 20,000 characters of job description."
        : "原简历最多 30,000 字，职位描述最多 20,000 字。";
      expect(answer.endsWith(tail)).toBe(true);
      expect(answer).toContain(norm(lang === "en" ? (qa as { enA: string }).enA : (qa as { zhA: string }).zhA));
    });
  });

  describe(`criterion 6: step 3, ${lang}`, () => {
    it("template cards (Classic is the default), output language and the three modes as radios", () => {
      startFlow(lang, { stopAt: 3 });
      expect(isSelected(control(t.tpls[0] as RegExp))).toBe(true);
      expect(isSelected(control(t.tpls[1] as RegExp))).toBe(false);
      for (const n of ["中文", "English"]) expect(control(n)).toBeTruthy();
      for (const m of t.modes) expect(within(main()).getByRole("radio", { name: m })).toBeTruthy();
      activate(control(t.tpls[1] as RegExp));
      expect(isSelected(control(t.tpls[1] as RegExp))).toBe(true);
    });
    it("the exact mode descriptions, each tied to its radio card", () => {
      startFlow(lang, { stopAt: 3 });
      const text = mainText();
      for (const d of t.desc) expect(text).toContain(norm(d));
      t.modes.forEach((m, i) => {
        const radio = within(main()).getByRole("radio", { name: m });
        const card = radio.closest("label, [role=radio], [data-mode], li, div") as HTMLElement;
        const described = (radio.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ");
        expect(norm(`${card.textContent ?? ""} ${described}`)).toContain(norm(t.desc[i] as string));
      });
    });
    it("the modes are one radio group; arrow keys move the choice", () => {
      startFlow(lang, { stopAt: 3 });
      const mode = (i: number) => within(main()).getByRole("radio", { name: t.modes[i] as RegExp });
      const group = mode(0).closest("[role=radiogroup]") ?? mode(0).closest("fieldset");
      expect(group, "radio group").toBeTruthy();
      expect(group?.contains(mode(2))).toBe(true);
      expect(isSelected(mode(0))).toBe(true);
      mode(0).focus();
      fireEvent.keyDown(mode(0), { key: "ArrowRight" });
      expect(isSelected(mode(1))).toBe(true);
      fireEvent.keyDown(mode(1), { key: "ArrowDown" });
      expect(isSelected(mode(2))).toBe(true);
      fireEvent.keyDown(mode(2), { key: "ArrowLeft" });
      expect(isSelected(mode(1))).toBe(true);
      fireEvent.keyDown(mode(1), { key: "ArrowUp" });
      expect(isSelected(mode(0))).toBe(true);
    });
  });

  describe(`criterion 8: step 4, ${lang}`, () => {
    it("summary rows: resume length, the JD's first line and length, template · language · mode", () => {
      startFlow(lang);
      const sum = screen.getByTestId("step4-summary");
      const row = (k: string) => sum.querySelector<HTMLElement>(`[data-row=${k}]`) as HTMLElement;
      expect(norm(row("resume").textContent ?? "")).toContain(fmt(ORIGINAL_EN.length));
      const jdRow = norm(row("jd").textContent ?? "");
      expect(jdRow).toContain(norm(JD_EN.split("\n")[0] as string));
      expect(jdRow).toContain(fmt(JD_EN.length));
      expect(norm(row("options").textContent ?? "")).toContain(t.summary);
      for (const k of ["resume", "jd", "options"]) expect(within(row(k)).getByRole("button", { name: t.edit })).toBeTruthy();
    });
    it("each Edit jumps to its step and nothing is lost", () => {
      startFlow(lang);
      const edit = (k: string) => {
        const row = screen.getByTestId("step4-summary").querySelector<HTMLElement>(`[data-row=${k}]`) as HTMLElement;
        click(within(row).getByRole("button", { name: t.edit }));
      };
      edit("resume");
      expect(resumeBox(lang).value).toBe(ORIGINAL_EN);
      cleanup();
      resetStores();
      startFlow(lang);
      edit("jd");
      expect(jdBox(lang).value).toBe(JD_EN);
      cleanup();
      resetStores();
      startFlow(lang);
      edit("options");
      expect(isSelected(control(t.tpls[0] as RegExp))).toBe(true);
      expect(within(main()).getAllByRole("radio").length).toBeGreaterThanOrEqual(7);
    });
    it("key row, model select, Generate and the disclaimer line", () => {
      startFlow(lang);
      expect(within(screen.getByTestId("key-row")).getByRole("button", { name: c.change })).toBeTruthy();
      expect(within(main()).getByRole("combobox", { name: c.modelSelect })).toBeTruthy();
      expect(generateBtn(lang)).toBeTruthy();
      expect(main().querySelector(".consent-line a")?.getAttribute("href")).toBe("#/disclaimer");
    });
    it("one request per click: the first Generate button is clicked twice; fake fetch sees one call, key only in x-api-key, no tools", async () => {
      const api = deferredApi();
      startFlow(lang);
      const first = generateBtn(lang); // owner 2026-11-27: keep the first reference; the click replaces step 4 by the waiting card
      click(first);
      click(first);
      fireEvent.doubleClick(first);
      await act(async () => {
        await Promise.resolve();
      });
      expect(api.fetch).toHaveBeenCalledTimes(1);
      const call = api.calls[0];
      expect(call?.url).toBe("https://api.anthropic.com/v1/messages");
      expect((call?.init.headers as Record<string, string>)["x-api-key"]).toBe(FAKE_KEY);
      expect(String(call?.init.body)).not.toContain(FAKE_KEY);
      expect(call?.body.tools).toBeUndefined();
    });
    it("nothing is sent while walking through steps 1 to 4", () => {
      const api = deferredApi();
      startFlow(lang);
      expect(api.fetch).not.toHaveBeenCalled();
    });
  });

  describe(`criterion 9: step 5, ${lang}`, () => {
    it("the waiting card is step 5 (node 5 current); a confirmed cancel returns to step 4 with all input kept", async () => {
      const api = deferredApi();
      startFlow(lang);
      click(generateBtn(lang));
      await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId("tailor-progress")).toBeTruthy();
      expect(nodes().map((x) => x.dataset.state)).toEqual(["done", "done", "done", "done", "current"]);
      click(within(main()).getByRole("button", { name: c.cancel }));
      click(screen.getByTestId("cancel-confirm"));
      await waitFor(() => expect(screen.queryByTestId("tailor-progress")).toBeNull());
      expect(nodes().map((x) => x.dataset.state)).toEqual(["done", "done", "done", "current", "todo"]);
      expect(generateBtn(lang).disabled).toBe(false);
      expect(norm(screen.getByTestId("step4-summary").textContent ?? "")).toContain(t.summary);
      expect(document.activeElement).toBe(stepHeading());
    });
    it("the result view stays on step 5; Edit input and regenerate goes to step 1 with every input kept", async () => {
      const api = deferredApi();
      startFlow(lang, { stopAt: 3 });
      activate(control(t.tpls[1] as RegExp));
      activate(control(t.modes[2] as RegExp, main()));
      goNext();
      click(generateBtn(lang));
      await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1));
      await act(async () => api.respond(0, apiOutput(validOutput())));
      await screen.findByTestId("tailor-result", undefined, { timeout: 4000 });
      expect(nodes().map((x) => x.dataset.state)).toEqual(["done", "done", "done", "done", "current"]);
      click(within(main()).getByRole("button", { name: c.editInput }));
      expect(resumeBox(lang).value).toBe(ORIGINAL_EN);
      expect(document.activeElement).toBe(stepHeading());
      goNext();
      expect(jdBox(lang).value).toBe(JD_EN);
      goNext();
      expect(isSelected(control(t.tpls[1] as RegExp))).toBe(true);
      expect(isSelected(control(t.modes[2] as RegExp))).toBe(true);
    });
  });

  describe(`criterion 10: focus and memory, ${lang}`, () => {
    it("on every step change the focus moves to the step heading, which is a heading with tabindex -1", () => {
      renderApp(lang);
      typeInto(resumeBox(lang), ORIGINAL_EN);
      const seen: string[] = [];
      const check = () => {
        expect(document.activeElement).toBe(stepHeading());
        expect(stepHeading().getAttribute("tabindex")).toBe("-1");
        expect(stepHeading().tagName).toMatch(/^H[1-6]$/);
        seen.push(heading());
      };
      goNext();
      check();
      typeInto(jdBox(lang), JD_EN);
      goNext();
      check();
      goNext();
      check();
      click(backBtn(lang));
      check();
      click(backBtn(lang));
      check();
      click(within(nodes()[0] as HTMLElement).getByRole("button"));
      check();
      expect(new Set(seen).size).toBeGreaterThanOrEqual(3);
    });
    it("going back and forward keeps both texts, the template, the language and the mode", () => {
      withKey();
      renderApp(lang);
      walkTo(lang, 3);
      activate(control(t.tpls[1] as RegExp));
      activate(control(lang === "en" ? "中文" : "English"));
      activate(control(t.modes[1] as RegExp));
      click(backBtn(lang));
      expect(jdBox(lang).value).toBe(JD_EN);
      click(backBtn(lang));
      expect(resumeBox(lang).value).toBe(ORIGINAL_EN);
      goNext();
      goNext();
      expect(isSelected(control(t.tpls[1] as RegExp))).toBe(true);
      expect(isSelected(control(lang === "en" ? "中文" : "English"))).toBe(true);
      expect(isSelected(control(t.modes[1] as RegExp))).toBe(true);
      goNext();
      expect(norm(screen.getByTestId("step4-summary").textContent ?? "")).toContain(lang === "en" ? "Modern · 中文 · Results-first" : "清新 · English · 突出成果");
    });
  });
}

describe("criterion 5 and 13: exported limits and dictionaries", () => {
  it("RESUME_MAX_CHARS = 30000 and JD_MAX_CHARS = 20000 are exported from src/features/tailor/", () => {
    expect(exported("RESUME_MAX_CHARS")).toBe(30000);
    expect(exported("JD_MAX_CHARS")).toBe(20000);
  });
  it("en and zh keep the same shape and no empty string", () => {
    expect(shape(zh)).toEqual(shape(en));
    for (const d of [en, zh]) for (const v of leafValues(d)) expect(v.trim()).not.toBe("");
  });
  it("the spec strings exist in their dictionary", () => {
    const wanted: Record<L, string[]> = {
      en: [
        ...T.en.steps, ...NEXT.en, "← Back", ...T.en.desc, "Over 30,000 characters; remove parts that are not about your work",
        "Over 20,000 characters; remove parts that are not about your work",
        "You can paste up to 30,000 characters of resume and 20,000 characters of job description.",
      ],
      zh: [
        ...T.zh.steps, ...NEXT.zh, "← 上一步", ...T.zh.desc, "超出 30,000 字，请删去与求职无关的内容",
        "超出 20,000 字，请删去与求职无关的内容", "原简历最多 30,000 字，职位描述最多 20,000 字。",
      ],
    };
    for (const lang of LANGS) {
      const all = leafValues(lang === "en" ? en : zh).map(norm);
      for (const w of wanted[lang]) expect(all.some((v) => v.includes(norm(w))), `${lang}: ${w}`).toBe(true);
    }
  });
});
