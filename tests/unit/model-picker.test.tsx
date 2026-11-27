// resume-sg#25 criteria 1-6: the model select in the AI settings panel.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import { DEFAULT_MODEL } from "../../src/ai/settings.ts";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";
import { clearKey } from "../../src/security/keyStore.ts";
import { leafValues, shape } from "./dict-helpers.ts";
import { walkTo } from "./flow-helpers.tsx";

type L = "en" | "zh";
const TAG = { en: "en-US", zh: "zh-CN" } as const;
const KEY = "test-key-not-real";
const norm = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const pick = (m: Record<string, unknown>, name: string) => (m.default ?? m[name]) as Record<string, unknown>;
const en = pick(enMod, "en");
const zh = pick(zhMod, "zh");

const T = {
  en: {
    region: "AI settings",
    select: "Model",
    modelId: "Model ID",
    keyLabel: "Anthropic API key",
    test: "Test connection",
    help: "After choosing, click Test connection to check that your account can use this model.",
    options: [
      { label: "Claude Sonnet 5.5 (Recommended)", value: "claude-sonnet-5-5" },
      { label: "Claude Opus 5.5 (Best quality, higher cost)", value: "claude-opus-5-5" },
      { label: "Claude Haiku 5.5 (Fastest, lowest cost)", value: "claude-haiku-5-5" },
      { label: "Other (custom)", value: null },
    ],
  },
  zh: {
    region: "AI 设置",
    select: "模型",
    modelId: "模型 ID",
    keyLabel: "Anthropic API key（密钥）",
    test: "测试连接",
    help: "选好后可以点“测试连接”，确认你的账户能用这个模型。",
    options: [
      { label: "Claude Sonnet 5.5（推荐）", value: "claude-sonnet-5-5" },
      { label: "Claude Opus 5.5（质量最好，费用更高）", value: "claude-opus-5-5" },
      { label: "Claude Haiku 5.5（最快，最便宜）", value: "claude-haiku-5-5" },
      { label: "其他（自定义）", value: null },
    ],
  },
};

function setup(lang: L) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(TAG[lang]);
  window.location.hash = "#/app";
  const view = render(<App />);
  // #41: the AI settings panel (key row and model select) lives on step 4 of the wizard.
  walkTo(lang, 4);
  return view;
}
const panel = (lang: L) => within(screen.getByRole("region", { name: T[lang].region }));
const select = (lang: L) => panel(lang).getByRole("combobox", { name: T[lang].select }) as HTMLSelectElement;
const optionByLabel = (lang: L, label: string) =>
  Array.from(select(lang).options).find((o) => norm(o.textContent ?? "") === norm(label));
const choose = (lang: L, label: string) => {
  const o = optionByLabel(lang, label);
  expect(o, `option ${label}`).toBeTruthy();
  fireEvent.change(select(lang), { target: { value: o?.value } });
};
const customField = (lang: L) => panel(lang).queryByLabelText(T[lang].modelId) as HTMLInputElement | null;
const testBtn = (lang: L) => panel(lang).getByRole("button", { name: T[lang].test }) as HTMLButtonElement;
const typeKey = (lang: L) =>
  fireEvent.change(panel(lang).getByLabelText(T[lang].keyLabel), { target: { value: KEY } });
const OK = JSON.stringify({ content: [{ type: "text", text: "ok" }] });
const okResp = () => new Response(OK, { status: 200, headers: { "content-type": "application/json" } });
const sentModel = (f: ReturnType<typeof vi.fn>, n = 0) =>
  (JSON.parse(String(((f.mock.calls[n] as unknown as [string, RequestInit])[1]).body)) as { model: string }).model;

beforeEach(() => {
  localStorage.clear();
  clearKey();
  window.location.hash = "";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearKey();
  localStorage.clear();
});

for (const lang of ["en", "zh"] as const) {
  const c = T[lang];
  describe(`model picker, ${lang}`, () => {
    it(`criterion 1: the select has exactly four options in order`, () => {
      setup(lang);
      const labels = Array.from(select(lang).options).map((o) => norm(o.textContent ?? ""));
      expect(labels).toEqual(c.options.map((o) => norm(o.label)));
    });

    it.each(c.options.map((o, i) => [i, o] as const))(`criterion 1: option %i label and value`, (i, o) => {
      setup(lang);
      const opt = select(lang).options[i];
      expect(norm(opt?.textContent ?? "")).toBe(norm(o.label));
      if (o.value) expect(opt?.value).toBe(o.value);
    });

    it(`criterion 2: Sonnet is selected by default, the field is hidden and calls use DEFAULT_MODEL`, async () => {
      expect(DEFAULT_MODEL).toBe("claude-sonnet-5-5");
      const f = vi.fn(async () => okResp());
      vi.stubGlobal("fetch", f);
      setup(lang);
      expect(select(lang).value).toBe("claude-sonnet-5-5");
      expect(customField(lang)).toBeNull();
      typeKey(lang);
      fireEvent.click(testBtn(lang));
      await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
      expect(sentModel(f)).toBe("claude-sonnet-5-5");
    });

    it.each(["claude-opus-5-5", "claude-haiku-5-5"])(`criterion 3: choosing %s sends it`, async (id) => {
      const f = vi.fn(async () => okResp());
      vi.stubGlobal("fetch", f);
      setup(lang);
      typeKey(lang);
      const label = c.options.find((o) => o.value === id)?.label ?? "";
      choose(lang, label);
      expect(select(lang).value).toBe(id);
      expect(customField(lang)).toBeNull();
      fireEvent.click(testBtn(lang));
      await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
      expect(sentModel(f)).toBe(id);
    });

    it(`criterion 4: Other reveals the field; invalid id shows an error and disables Test; valid id is sent; a listed model hides it`, async () => {
      const f = vi.fn(async () => okResp());
      vi.stubGlobal("fetch", f);
      setup(lang);
      typeKey(lang);
      expect(customField(lang)).toBeNull();
      choose(lang, c.options[3]?.label ?? "");
      const field = customField(lang);
      expect(field, "model id field").not.toBeNull();
      fireEvent.change(field as HTMLInputElement, { target: { value: "Bad Id!" } });
      expect(testBtn(lang).disabled).toBe(true);
      const region = screen.getByRole("region", { name: c.region });
      const flagged = (customField(lang) as HTMLInputElement).getAttribute("aria-invalid") === "true" || region.querySelector("[role=alert]") !== null;
      expect(flagged, "inline error").toBe(true);
      fireEvent.change(customField(lang) as HTMLInputElement, { target: { value: "my-model-1" } });
      expect(testBtn(lang).disabled).toBe(false);
      fireEvent.click(testBtn(lang));
      await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
      expect(sentModel(f)).toBe("my-model-1");
      choose(lang, c.options[1]?.label ?? "");
      expect(customField(lang)).toBeNull();
      expect(testBtn(lang).disabled).toBe(false);
    });

    it(`criterion 5: the exact helper text is shown in the AI settings panel`, () => {
      setup(lang);
      expect(norm(screen.getByRole("region", { name: c.region }).textContent ?? "")).toContain(norm(c.help));
    });

    it(`criterion 6: no prices or currency in the select, options and helper text`, () => {
      setup(lang);
      const region = screen.getByRole("region", { name: c.region });
      const texts = [
        c.help,
        ...Array.from(select(lang).options).map((o) => o.textContent ?? ""),
        region.querySelector(`label[for="${select(lang).id}"]`)?.textContent ?? c.select,
      ];
      for (const t of texts) {
        expect(t).not.toMatch(/[$¥元]|USD|\d\s*\/\s*M\b|\d\s*per\b/i);
      }
    });

    it(`criterion 6: each label exists in its dictionary`, () => {
      const all = leafValues(lang === "en" ? en : zh).map(norm).join("\n");
      for (const o of c.options) expect(all, o.label).toContain(norm(o.label));
      expect(all).toContain(norm(c.help));
    });
  });
}

describe("criterion 6: dictionaries", () => {
  it("en and zh have the same shape", () => {
    expect(shape(zh)).toEqual(shape(en));
  });
});
