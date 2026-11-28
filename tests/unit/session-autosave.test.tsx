// resume-sg#31 (session-autosave, brief v5.2 section 3 + v6 section 1): the Start route saves to sessionStorage,
// restores on reload, shows the autosave note, and has Clear all. Synthetic data and fake keys only.
//
// Reload is simulated without knowing the stored format: drive the page, read the raw `jd2cv.session` string the
// page wrote, unmount, put the same string back and render again. The shape itself is checked in session-store.test.ts.
//
// Test hooks the builder must provide (the issue names the texts, not the hooks):
//  - the "Clear all" / "清除全部" control: a button or link inside <main> on the input steps (1 to 4)
//  - the remembered-key question: role="alertdialog" or "dialog" containing the question text, with
//    data-testid="clear-key-confirm" (delete the remembered key too) and data-testid="clear-key-keep" (keep it)
//  - the interrupted message is plain text inside <main> (role="alert" is fine)
//  - the wizard hooks of tests/unit/flow-helpers.tsx
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { factCheck } from "../../src/ai/factCheck.ts";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";
import { getKey, isRemembered, setKey } from "../../src/security/keyStore.ts";
import { FAKE_KEY, JD_EN, ORIGINAL_EN, apiOutput, redOutput, validOutput } from "../fixtures/tailor-flow.ts";
import { leafValues } from "./dict-helpers.ts";
import {
  TXT,
  activate,
  backBtn,
  control,
  deferredApi,
  generateBtn,
  generateResult,
  isSelected,
  jdBox,
  main,
  mainText,
  norm,
  renderApp,
  resetStores,
  resultView,
  resumeBox,
  scriptedApi,
  startFlow,
  typeInto,
} from "./flow-helpers.tsx";
import type { L } from "./flow-helpers.tsx";

type Dict = Record<string, string>;
const pick = (m: Record<string, unknown>, name: string): Dict => (m.default ?? m[name]) as Dict;
const en = pick(enMod, "en");
const zh = pick(zhMod, "zh");

const SLOT = "jd2cv.session";
const NOT_REAL = "test-key-not-real";
const LANGS = ["en", "zh"] as const;

const T = {
  en: {
    note: "Your input and result are kept in this tab so a refresh loses nothing; closing the tab clears them.",
    clear: /^Clear all$/,
    interrupted: "The last generation was interrupted; your input is still here, please generate again.",
    keyAsk: "Also delete the key remembered on this device?",
  },
  zh: {
    note: "你的输入和结果会临时保存在这个标签页，刷新不会丢失；关闭标签页即清除。",
    clear: /^清除全部$/,
    interrupted: "上次生成被中断了，你的输入都还在，请重新生成",
    keyAsk: "也删除这台设备上记住的 key？",
  },
} as const;

type Raw = Record<string, unknown>;
const stored = (): Raw | null => {
  const raw = sessionStorage.getItem(SLOT);
  return raw === null ? null : (JSON.parse(raw) as Raw);
};
const wait3 = { timeout: 3000 };
/** Wait until the page has saved a session that satisfies `ok`, and return its raw string. */
async function saved(ok: (s: Raw) => boolean = () => true): Promise<string> {
  await waitFor(() => {
    const s = stored();
    expect(s).not.toBeNull();
    expect(ok(s as Raw)).toBe(true);
  }, wait3);
  return sessionStorage.getItem(SLOT) as string;
}
/** A reload: unmount, keep only the raw session string (a new tab keeps sessionStorage), render the page again. */
function reload(lang: L, raw: string) {
  cleanup();
  sessionStorage.clear();
  sessionStorage.setItem(SLOT, raw);
  return renderApp(lang);
}
const currentStep = () =>
  document.querySelector('[data-testid="wizard-progress"] [data-state="current"]')?.getAttribute("data-step");
const clearCtl = (lang: L) =>
  (within(main()).queryByRole("button", { name: T[lang].clear }) ?? within(main()).getByRole("link", { name: T[lang].clear })) as HTMLElement;
const keyDialog = () => (screen.queryByRole("alertdialog") ?? screen.queryByRole("dialog")) as HTMLElement | null;
const findingId = (out: ReturnType<typeof redOutput>) =>
  (factCheck(ORIGINAL_EN, out, { outputLang: "en" }).filter((f) => f.level === "red")[0] as { id: string }).id;
const card = (id: string) =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-finding-id]")).find((e) => e.dataset.findingId === id) as HTMLElement;
const exportEnabled = (lang: L) =>
  (within(main()).getByRole("button", { name: TXT[lang].exportPdf }) as HTMLButtonElement).disabled === false;

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

for (const lang of LANGS) {
  const t = T[lang];
  const c = TXT[lang];

  describe(`criterion 1: autosave, ${lang}`, () => {
    it("typing in either textarea saves within one second (debounced, fake timers)", () => {
      vi.useFakeTimers();
      renderApp(lang);
      typeInto(resumeBox(lang), ORIGINAL_EN);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(stored()?.original).toBe(ORIGINAL_EN);
      fireEvent.click(screen.getByTestId("step-next"));
      typeInto(jdBox(lang), JD_EN);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(stored()?.jd).toBe(JD_EN);
      expect(stored()?.original).toBe(ORIGINAL_EN);
    });
    it("is debounced: a burst of typing is not written key by key", () => {
      vi.useFakeTimers();
      const spy = vi.spyOn(Storage.prototype, "setItem");
      renderApp(lang);
      for (let i = 1; i <= 20; i++) typeInto(resumeBox(lang), "Sam ".repeat(i));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      const writes = spy.mock.calls.filter(([k]) => k === SLOT).length;
      expect(writes).toBeGreaterThanOrEqual(1);
      expect(writes).toBeLessThan(5);
      expect(stored()?.original).toBe("Sam ".repeat(20));
    });
    it("changing the template, output language or mode saves the options", () => {
      vi.useFakeTimers();
      startFlow(lang, { stopAt: 3 });
      activate(control(lang === "en" ? /^modern/i : /^清新/));
      activate(control("中文"));
      activate(control(lang === "en" ? /^results-first$/i : /^突出成果$/));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(stored()?.options).toMatchObject({ template: "modern", lang: "zh", mode: "results-first" });
    });
    it("a finished result is saved with its decisions; localStorage and cookies stay empty", async () => {
      const out = redOutput();
      await generateResult(lang, out);
      const id = findingId(out);
      fireEvent.click(within(card(id)).getByRole("button", { name: c.remove }));
      const raw = await saved((s) => {
        const r = s.result as Raw | undefined;
        return !!r && (r.decisions as Raw)[id] === "removed";
      });
      const s = JSON.parse(raw) as Raw;
      expect(s.version).toBe(1);
      expect(s.step).toBe(5);
      expect((s.result as Raw).output).toEqual(out);
      expect(s.pending).toBeUndefined();
      expect(localStorage.length).toBe(0);
      expect(document.cookie).toBe("");
    });
    it("pending: true is written while a request runs and removed when it ends", async () => {
      const api = deferredApi();
      startFlow(lang);
      fireEvent.click(generateBtn(lang));
      await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1));
      await saved((s) => s.pending === true && s.step === 5);
      await act(async () => api.respond(0, apiOutput(validOutput())));
      await resultView();
      await saved((s) => s.pending === undefined && !!s.result);
    });
    it("pending is removed when the request is cancelled", async () => {
      const api = deferredApi();
      startFlow(lang);
      fireEvent.click(generateBtn(lang));
      await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1));
      await saved((s) => s.pending === true);
      fireEvent.click(within(main()).getByRole("button", { name: c.cancel }));
      fireEvent.click(screen.getByTestId("cancel-confirm"));
      await saved((s) => s.pending === undefined && s.step === 4);
    });
  });

  describe(`criterion 2 and 8a: restore, ${lang}`, () => {
    it("restores both texts and the current step 1, 2, 3 and 4", async () => {
      for (const step of [1, 2, 3, 4] as const) {
        resetStores();
        startFlow(lang, { stopAt: step });
        const raw = await saved((s) => s.step === step && s.original === ORIGINAL_EN && (step === 1 || s.jd === JD_EN));
        reload(lang, raw);
        expect(currentStep(), `step ${step}`).toBe(String(step));
        if (step === 1) expect(resumeBox(lang).value).toBe(ORIGINAL_EN);
        if (step === 2) expect(jdBox(lang).value).toBe(JD_EN);
        if (step === 4) {
          fireEvent.click(backBtn(lang));
          fireEvent.click(backBtn(lang));
          expect(jdBox(lang).value).toBe(JD_EN);
          fireEvent.click(backBtn(lang));
          expect(resumeBox(lang).value).toBe(ORIGINAL_EN);
        }
        cleanup();
      }
    });
    it("restores the options: template, output language, mode and model", async () => {
      startFlow(lang, { stopAt: 3 });
      activate(control(lang === "en" ? /^modern/i : /^清新/));
      activate(control("English"));
      activate(control(lang === "en" ? /^career switch$/i : /^转行$/));
      fireEvent.click(screen.getByTestId("step-next"));
      const select = within(main()).getByLabelText(c.modelSelect) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "claude-opus-5-5" } });
      const raw = await saved((s) => s.step === 4 && (s.options as Raw | undefined)?.model === "claude-opus-5-5");
      expect(JSON.parse(raw).options).toEqual({ template: "modern", lang: "en", mode: "career-change", model: "claude-opus-5-5" });
      reload(lang, raw);
      expect(currentStep()).toBe("4");
      expect((within(main()).getByLabelText(c.modelSelect) as HTMLSelectElement).value).toBe("claude-opus-5-5");
      fireEvent.click(backBtn(lang));
      expect(isSelected(control(lang === "en" ? /^modern/i : /^清新/))).toBe(true);
      expect(isSelected(control("English"))).toBe(true);
      expect(isSelected(control(lang === "en" ? /^career switch$/i : /^转行$/))).toBe(true);
    });
    it("step 5 with a finished result shows the result with its decision (a removed red item stays removed)", async () => {
      const out = redOutput();
      await generateResult(lang, out);
      const id = findingId(out);
      expect(exportEnabled(lang)).toBe(false);
      fireEvent.click(within(card(id)).getByRole("button", { name: c.remove }));
      const raw = await saved((s) => ((s.result as Raw | undefined)?.decisions as Raw | undefined)?.[id] === "removed");
      reload(lang, raw);
      await resultView();
      expect(currentStep()).toBe("5");
      expect(screen.getByTestId("resume-preview").textContent).not.toContain("30%");
      expect(exportEnabled(lang)).toBe(true);
      expect(within(main()).getAllByRole("tab").length).toBeGreaterThanOrEqual(3);
    });
    it("a kept red item stays kept, an open one stays open", async () => {
      const out = redOutput();
      await generateResult(lang, out);
      const id = findingId(out);
      // open: saved result without a decision
      const open = await saved((s) => !!s.result);
      reload(lang, open);
      await resultView();
      expect(exportEnabled(lang)).toBe(false);
      expect(screen.getByTestId("resume-preview").textContent).toContain("30%");
      // kept
      fireEvent.click(within(card(id)).getByRole("button", { name: c.keep }));
      const raw = await saved((s) => ((s.result as Raw | undefined)?.decisions as Raw | undefined)?.[id] === "kept");
      reload(lang, raw);
      await resultView();
      expect(exportEnabled(lang)).toBe(true);
      expect(screen.getByTestId("resume-preview").textContent).toContain("30%");
    });
  });

  describe(`criterion 3 and 8a: a reload while a request runs, ${lang}`, () => {
    async function interrupted() {
      const api = deferredApi();
      startFlow(lang);
      fireEvent.click(generateBtn(lang));
      await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1));
      const raw = await saved((s) => s.pending === true && s.step === 5);
      const again = deferredApi();
      reload(lang, raw);
      return again;
    }
    it("shows the interrupted message on step 4 with the inputs, and sends no request by itself", async () => {
      const again = await interrupted();
      expect(mainText()).toContain(norm(t.interrupted));
      expect(currentStep()).toBe("4");
      expect(screen.queryByTestId("tailor-progress")).toBeNull();
      await new Promise((r) => setTimeout(r, 300));
      expect(again.fetch).not.toHaveBeenCalled();
      fireEvent.click(backBtn(lang));
      fireEvent.click(backBtn(lang));
      expect(jdBox(lang).value).toBe(JD_EN);
      fireEvent.click(backBtn(lang));
      expect(resumeBox(lang).value).toBe(ORIGINAL_EN);
      expect(again.fetch).not.toHaveBeenCalled();
    });
    it("generating again works, and the leave-page warning is back while it runs", async () => {
      const again = await interrupted();
      setKey(FAKE_KEY, false);
      await waitFor(() => expect(generateBtn(lang).disabled).toBe(false), wait3);
      fireEvent.click(generateBtn(lang));
      await waitFor(() => expect(again.fetch).toHaveBeenCalledTimes(1));
      const ev = new Event("beforeunload", { cancelable: true });
      Object.defineProperty(ev, "returnValue", { value: undefined, writable: true, configurable: true });
      window.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
      await act(async () => again.respond(0, apiOutput(validOutput())));
      await resultView();
    });
  });

  describe(`criterion 4: never the key, ${lang}`, () => {
    it("after typing the key and generating, no sessionStorage or localStorage value contains it", async () => {
      scriptedApi([() => apiOutput(validOutput())]);
      startFlow(lang, { key: null });
      fireEvent.change(within(main()).getByLabelText(c.keyLabel), { target: { value: NOT_REAL } });
      fireEvent.click(generateBtn(lang));
      await resultView();
      await saved((s) => !!s.result);
      expect(getKey()).toBe(NOT_REAL);
      expect(JSON.stringify({ ...sessionStorage })).not.toContain(NOT_REAL);
      expect(JSON.stringify({ ...localStorage })).not.toContain(NOT_REAL);
    });
    it("a resume that happens to equal the key is not saved, and the page does not crash", () => {
      vi.useFakeTimers();
      setKey(NOT_REAL, false);
      renderApp(lang);
      expect(() => {
        typeInto(resumeBox(lang), NOT_REAL);
        act(() => {
          vi.advanceTimersByTime(1500);
        });
      }).not.toThrow();
      expect(sessionStorage.getItem(SLOT) ?? "").not.toContain(NOT_REAL);
    });
  });

  describe(`criterion 5: Clear all, ${lang}`, () => {
    it("removes jd2cv.session and every other jd2cv. entry at once and empties the page", async () => {
      startFlow(lang, { stopAt: 2 });
      await saved((s) => s.jd === JD_EN);
      sessionStorage.setItem("jd2cv.other", "x");
      fireEvent.click(clearCtl(lang));
      expect(keyDialog()).toBeNull(); // no remembered key: no question
      expect(sessionStorage.getItem(SLOT)).toBeNull();
      expect(sessionStorage.getItem("jd2cv.other")).toBeNull();
      expect(currentStep()).toBe("1");
      expect(resumeBox(lang).value).toBe("");
      fireEvent.click(screen.getByTestId("step-next")); // disabled on an empty resume: still step 1
      expect(currentStep()).toBe("1");
    });
    it("the emptied page is not written back by the autosave", async () => {
      vi.useFakeTimers();
      renderApp(lang);
      typeInto(resumeBox(lang), ORIGINAL_EN);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(stored()).not.toBeNull();
      fireEvent.click(clearCtl(lang));
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(sessionStorage.getItem(SLOT)).toBeNull();
    });
    it("with a remembered key it asks, and keeps the key unless the user confirms", async () => {
      setKey(FAKE_KEY, true);
      startFlow(lang, { key: null, stopAt: 1 });
      await saved();
      fireEvent.click(clearCtl(lang));
      const d = keyDialog();
      expect(d).not.toBeNull();
      expect(norm(d?.textContent ?? "")).toContain(norm(t.keyAsk));
      fireEvent.click(within(d as HTMLElement).getByTestId("clear-key-keep"));
      expect(keyDialog()).toBeNull();
      expect(sessionStorage.getItem(SLOT)).toBeNull();
      expect(isRemembered()).toBe(true);
      expect(localStorage.getItem("jd2cv.apiKey")).toBe(FAKE_KEY);
      expect(resumeBox(lang).value).toBe("");
    });
    it("with a remembered key, confirming removes it too (clearKey)", async () => {
      setKey(FAKE_KEY, true);
      startFlow(lang, { key: null, stopAt: 1 });
      await saved();
      fireEvent.click(clearCtl(lang));
      fireEvent.click(within(keyDialog() as HTMLElement).getByTestId("clear-key-confirm"));
      expect(sessionStorage.getItem(SLOT)).toBeNull();
      expect(isRemembered()).toBe(false);
      expect(localStorage.getItem("jd2cv.apiKey")).toBeNull();
      expect(getKey()).toBe("");
      expect(resumeBox(lang).value).toBe("");
    });
  });

  describe(`criterion 6: a corrupt entry starts the page empty without an error, ${lang}`, () => {
    for (const [name, raw] of [
      ["bad JSON", "{oops"],
      ["version 2", JSON.stringify({ version: 2, original: "x", jd: "y", options: {}, step: 1 })],
      ["missing keys", JSON.stringify({ version: 1 })],
      ["wrong types", JSON.stringify({ version: 1, savedAt: 1, original: 5, jd: [], options: "no", step: "one" })],
    ] as const) {
      it(name, () => {
        sessionStorage.setItem(SLOT, raw);
        renderApp(lang);
        expect(currentStep()).toBe("1");
        expect(resumeBox(lang).value).toBe("");
        expect(within(main()).queryByRole("alert")).toBeNull();
        expect(mainText()).not.toContain(norm(t.interrupted));
        expect(sessionStorage.getItem(SLOT)).toBeNull();
      });
    }
  });

  describe(`criterion 8: the autosave note, ${lang}`, () => {
    for (const step of [1, 4] as const) {
      it(`step ${step} shows the note and the Clear all link`, () => {
        startFlow(lang, { stopAt: step });
        expect(mainText()).toContain(norm(t.note));
        expect(clearCtl(lang)).toBeTruthy();
      });
    }
  });
}

describe("criterion 10: strings and dependencies", () => {
  const SENTENCES = [
    ["你的输入和结果会临时保存在这个标签页，刷新不会丢失；关闭标签页即清除。", zh],
    ["Your input and result are kept in this tab so a refresh loses nothing; closing the tab clears them.", en],
    ["上次生成被中断了，你的输入都还在，请重新生成", zh],
    ["The last generation was interrupted; your input is still here, please generate again.", en],
    ["也删除这台设备上记住的 key？", zh],
    ["Also delete the key remembered on this device?", en],
    ["清除全部", zh],
    ["Clear all", en],
  ] as const;
  for (const [s, dict] of SENTENCES) {
    it(`the dictionaries hold: ${s.slice(0, 40)}`, () => {
      expect(leafValues(dict).map(norm).some((v) => v.includes(norm(s)))).toBe(true);
    });
  }
  it("package.json gains no dependency", () => {
    let base: string;
    try {
      base = execSync("git show origin/main:package.json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return; // no origin/main in this checkout: the coordinator's diff check covers it
    }
    const a = JSON.parse(base) as Record<string, unknown>;
    const b = JSON.parse(readFileSync("package.json", "utf8")) as Record<string, unknown>;
    expect(b.dependencies).toEqual(a.dependencies);
    expect(b.devDependencies).toEqual(a.devDependencies);
  });
});
