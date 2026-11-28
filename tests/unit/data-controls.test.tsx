// resume-sg#54 (data-controls, brief v8 section 3): "Delete all my data" in the AI settings panel, privacy texts that match
// what is stored, and a key input that keeps the key out of the DOM. Fake keys and synthetic data only.
//
// Test hooks the builder must provide (the issue names the texts, not the hooks):
//  - the button "删除我的所有数据" / "Delete all my data" inside the region "AI 设置" / "AI settings" (the full panel on step 4)
//  - its confirm dialog: role="alertdialog" or "dialog", with data-testid="delete-all-confirm" (Confirm) and
//    data-testid="delete-all-cancel" (Cancel). The remembered-key question of Clear all keeps its own testids.
//  - the step-1 heading is data-testid="step-heading" (tests/unit/flow-helpers.tsx)
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";
import { getKey, isRemembered, setKey } from "../../src/security/keyStore.ts";
import { FAKE_KEY } from "../fixtures/tailor-flow.ts";
import { SESSION_EN, SESSION_ZH } from "./info-pages-fixtures.ts";
import { main, norm, resetStores, resumeBox, startFlow, TXT } from "./flow-helpers.tsx";
import type { L } from "./flow-helpers.tsx";

type Dict = Record<string, string>;
const pick = (m: Record<string, unknown>, name: string): Dict => (m.default ?? m[name]) as Dict;
const dict = { en: pick(enMod, "en"), zh: pick(zhMod, "zh") };

const SLOT = "jd2cv.session";
const KEY_SLOT = "jd2cv.apiKey";
const LANGS = ["en", "zh"] as const;
const T = {
  en: { del: /^Delete all my data$/, panel: "AI settings", cancel: /^Cancel$/ },
  zh: { del: /^删除我的所有数据$/, panel: "AI 设置", cancel: /^取消$/ },
} as const;

const panel = (lang: L) => within(screen.getByRole("region", { name: T[lang].panel }));
const delBtn = (lang: L) => panel(lang).getByRole("button", { name: T[lang].del }) as HTMLButtonElement;
const dialog = () => (screen.queryByRole("alertdialog") ?? screen.queryByRole("dialog")) as HTMLElement | null;
const currentStep = () =>
  document.querySelector('[data-testid="wizard-progress"] [data-state="current"]')?.getAttribute("data-step");
const keyInput = (lang: L) => within(main()).getByLabelText(TXT[lang].keyLabel) as HTMLInputElement;
const appKeys = (s: Storage) => Object.keys(s).filter((k) => k.startsWith("jd2cv"));

/** Walk to step 4 with the full panel showing: a remembered key (full panel by design), or no key at all. */
async function toPanel(lang: L, mode: "remembered" | "none" = "remembered") {
  if (mode === "remembered") setKey(FAKE_KEY, true);
  startFlow(lang, { key: null, stopAt: 4 });
  await waitFor(() => expect(sessionStorage.getItem(SLOT)).not.toBeNull(), { timeout: 3000 });
}
const open = (lang: L) => fireEvent.click(delBtn(lang));
const confirm = () => fireEvent.click(within(dialog() as HTMLElement).getByTestId("delete-all-confirm"));

beforeEach(() => resetStores());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetStores();
});

for (const lang of LANGS) {
  describe(`criterion 1: Delete all my data, ${lang}`, () => {
    it("the AI settings panel has the button, and no dialog is open yet", async () => {
      await toPanel(lang);
      expect(delBtn(lang)).toBeTruthy();
      expect(dialog()).toBeNull();
    });
    it("it is in the panel when there is no key too", async () => {
      startFlow(lang, { key: null, stopAt: 4 });
      expect(delBtn(lang)).toBeTruthy();
    });
    it("it opens a confirm dialog with Confirm and Cancel", async () => {
      await toPanel(lang);
      open(lang);
      const d = dialog();
      expect(d).not.toBeNull();
      expect(within(d as HTMLElement).getByTestId("delete-all-confirm")).toBeTruthy();
      expect(within(d as HTMLElement).getByTestId("delete-all-cancel")).toBeTruthy();
    });
    it("Cancel changes nothing", async () => {
      await toPanel(lang);
      const before = sessionStorage.getItem(SLOT);
      open(lang);
      fireEvent.click(within(dialog() as HTMLElement).getByTestId("delete-all-cancel"));
      expect(dialog()).toBeNull();
      expect(getKey()).toBe(FAKE_KEY);
      expect(isRemembered()).toBe(true);
      expect(localStorage.getItem(KEY_SLOT)).toBe(FAKE_KEY);
      expect(sessionStorage.getItem(SLOT)).toBe(before);
      expect(currentStep()).toBe("4");
      expect(keyInput(lang).value).toBe(FAKE_KEY);
    });
    it("Confirm clears the key in memory and the remembered copy", async () => {
      await toPanel(lang);
      open(lang);
      confirm();
      expect(dialog()).toBeNull();
      expect(getKey()).toBe("");
      expect(isRemembered()).toBe(false);
      expect(localStorage.getItem(KEY_SLOT)).toBeNull();
    });
    it("Confirm clears a key that was never remembered (memory only)", async () => {
      setKey(FAKE_KEY, false);
      startFlow(lang, { key: null, stopAt: 4 });
      // compact key row to the full panel; scoped to the key row, the summary rows have Change buttons too
      fireEvent.click(within(screen.getByTestId("key-row")).getByRole("button", { name: TXT[lang].change }));
      open(lang);
      confirm();
      expect(getKey()).toBe("");
    });
    it("Confirm removes the session draft and any other jd2cv. entry of the tab", async () => {
      await toPanel(lang);
      sessionStorage.setItem("jd2cv.other", "x");
      open(lang);
      confirm();
      expect(sessionStorage.getItem(SLOT)).toBeNull();
      expect(sessionStorage.getItem("jd2cv.other")).toBeNull();
    });
    it("Confirm resets the flow to step 1, empties the inputs and moves focus to the step-1 heading", async () => {
      await toPanel(lang);
      open(lang);
      confirm();
      await waitFor(() => expect(currentStep()).toBe("1"));
      expect(resumeBox(lang).value).toBe("");
      const h = screen.getByTestId("step-heading");
      await waitFor(() => expect(document.activeElement).toBe(h));
    });
    it("Confirm with no key and an empty store still resets to step 1", async () => {
      startFlow(lang, { key: null, stopAt: 3 });
      fireEvent.click(screen.getByTestId("step-next"));
      open(lang);
      confirm();
      await waitFor(() => expect(currentStep()).toBe("1"));
      expect(resumeBox(lang).value).toBe("");
    });
  });

  describe(`criterion 2: nothing of the app remains, ${lang}`, () => {
    it("localStorage and sessionStorage hold no jd2cv entry after Confirm", async () => {
      await toPanel(lang);
      sessionStorage.setItem("jd2cv.other", "x");
      open(lang);
      confirm();
      expect(appKeys(localStorage)).toEqual([]);
      expect(appKeys(sessionStorage)).toEqual([]);
      expect(localStorage.length).toBe(0);
    });
    it("the emptied page is not written back by the autosave", async () => {
      await toPanel(lang);
      open(lang);
      confirm();
      vi.useFakeTimers();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(appKeys(sessionStorage)).toEqual([]);
      expect(appKeys(localStorage)).toEqual([]);
    });
  });

  describe(`criterion 3: the privacy texts match what is stored, ${lang}`, () => {
    const d = dict[lang];
    const ids = ["faq.6.a", "faq.17.a", "privacy.1"] as const;
    const button = lang === "en" ? "Delete all my data" : "删除我的所有数据";
    const session = lang === "en" ? SESSION_EN : SESSION_ZH;
    for (const id of ids) {
      it(`${id} names the new button, says the session lives in this tab and is gone when it closes`, () => {
        const v = norm(d[id] as string);
        expect(v).toContain(button);
        if (lang === "en") {
          expect(v).toMatch(/\btab\b/i);
          expect(v).toMatch(/clos/i);
        } else {
          expect(v).toContain("标签页");
          expect(v).toContain("关闭");
        }
      });
      it(`${id}: no draft saved by choice`, () => {
        const v = norm(d[id] as string);
        expect(v).not.toMatch(/choose to save|save a draft|save it|if you choose to save/i);
        expect(v).not.toContain("保存草稿");
        expect(v).not.toMatch(/你选择.{0,12}保存/);
      });
    }
    it("faq.6.a and privacy.1 keep the #31 sentence as their last sentence", () => {
      for (const id of ["faq.6.a", "privacy.1"] as const) expect(norm(d[id] as string).endsWith(norm(session))).toBe(true);
    });
    it("faq.17.a says what the button removes: the key (memory and remembered copy) and this tab's saved input", () => {
      const v = norm(d["faq.17.a"] as string);
      expect(v).toMatch(lang === "en" ? /key/i : /key/i);
      expect(v).toMatch(lang === "en" ? /tab/i : /标签页/);
    });
    it("no text of the dictionary says a draft is saved by choice", () => {
      for (const [k, v] of Object.entries(d)) {
        if (k.startsWith("faq.") || k.startsWith("privacy.")) {
          expect(norm(v), k).not.toMatch(/choose to save a draft|save a draft/i);
          expect(v, k).not.toContain("保存草稿");
        }
      }
    });
  });

  describe(`criterion 4: the key input is uncontrolled and the key stays out of the DOM, ${lang}`, () => {
    it("has no value attribute at mount and the privacy attributes", () => {
      startFlow(lang, { key: null, stopAt: 4 });
      const k = keyInput(lang);
      expect(k.getAttribute("value")).toBeNull();
      expect(k.getAttribute("autocomplete")).toBe("off");
      expect(k.hasAttribute("data-1p-ignore")).toBe(true);
      expect(k.getAttribute("data-lpignore")).toBe("true");
    });
    it("after typing a fake key its outerHTML does not contain it, and its value property does", () => {
      startFlow(lang, { key: null, stopAt: 4 });
      fireEvent.change(keyInput(lang), { target: { value: FAKE_KEY } });
      expect(keyInput(lang).value).toBe(FAKE_KEY);
      expect(keyInput(lang).outerHTML).not.toContain(FAKE_KEY);
      expect(keyInput(lang).getAttribute("value")).toBeNull();
      expect(main().innerHTML).not.toContain(FAKE_KEY);
    });
    it("also while shown as text, and after another keystroke", () => {
      startFlow(lang, { key: null, stopAt: 4 });
      fireEvent.change(keyInput(lang), { target: { value: FAKE_KEY } });
      fireEvent.click(within(main()).getByRole("button", { name: lang === "en" ? /show/i : /显示|show/i }));
      expect(keyInput(lang).type).toBe("text");
      fireEvent.change(keyInput(lang), { target: { value: FAKE_KEY + "x" } });
      expect(keyInput(lang).outerHTML).not.toContain(FAKE_KEY);
      expect(document.body.innerHTML).not.toContain(FAKE_KEY);
    });
    it("is set once from the store on mount (value property), still not in the markup", () => {
      setKey(FAKE_KEY, true);
      startFlow(lang, { key: null, stopAt: 4 });
      expect(keyInput(lang).value).toBe(FAKE_KEY);
      expect(keyInput(lang).outerHTML).not.toContain(FAKE_KEY);
      expect(document.body.innerHTML).not.toContain(FAKE_KEY);
    });
    it("typing reaches the store, and remember still stores it", () => {
      startFlow(lang, { key: null, stopAt: 4 });
      fireEvent.change(keyInput(lang), { target: { value: FAKE_KEY } });
      expect(getKey()).toBe(FAKE_KEY);
      expect(localStorage.getItem(KEY_SLOT)).toBeNull();
      fireEvent.click(within(main()).getByLabelText(lang === "en" ? "Remember on this device" : "在这台设备上记住"));
      expect(localStorage.getItem(KEY_SLOT)).toBe(FAKE_KEY);
    });
    it("Test connection still sends the typed key", async () => {
      const f = vi.fn(async () => new Response("{}", { status: 401, headers: { "content-type": "application/json" } }));
      vi.stubGlobal("fetch", f);
      startFlow(lang, { key: null, stopAt: 4 });
      fireEvent.change(keyInput(lang), { target: { value: FAKE_KEY } });
      fireEvent.click(within(main()).getByRole("button", { name: lang === "en" ? "Test connection" : "测试连接" }));
      await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
      const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
      expect(JSON.stringify(init.headers)).toContain(FAKE_KEY);
    });
  });

  describe(`criterion 5: keyboard, ${lang}`, () => {
    it("the button is a real, enabled, tabbable button", async () => {
      await toPanel(lang);
      const b = delBtn(lang);
      expect(b.tagName).toBe("BUTTON");
      expect(b.disabled).toBe(false);
      expect(b.tabIndex).toBeGreaterThanOrEqual(0);
    });
    it("opening moves focus into the dialog, whose buttons are reachable", async () => {
      await toPanel(lang);
      delBtn(lang).focus();
      open(lang);
      const d = dialog() as HTMLElement;
      expect(d.contains(document.activeElement)).toBe(true);
      for (const id of ["delete-all-confirm", "delete-all-cancel"]) {
        const el = within(d).getByTestId(id) as HTMLButtonElement;
        expect(el.disabled).toBe(false);
        expect(el.tabIndex).toBeGreaterThanOrEqual(0);
      }
    });
    it("Esc closes the dialog, changes nothing, and focus is back on the button", async () => {
      await toPanel(lang);
      delBtn(lang).focus();
      open(lang);
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape", code: "Escape" });
      expect(dialog()).toBeNull();
      expect(getKey()).toBe(FAKE_KEY);
      expect(sessionStorage.getItem(SLOT)).not.toBeNull();
      expect(currentStep()).toBe("4");
      await waitFor(() => expect(document.activeElement).toBe(delBtn(lang)));
    });
    it("Cancel also returns focus to the button", async () => {
      await toPanel(lang);
      delBtn(lang).focus();
      open(lang);
      fireEvent.click(within(dialog() as HTMLElement).getByTestId("delete-all-cancel"));
      await waitFor(() => expect(document.activeElement).toBe(delBtn(lang)));
    });
  });
}
