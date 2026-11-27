// resume-sg#56 (brief v9): AI output budget. Stream the answer, 32000 output tokens, a cut-off answer is its own error
// with no retry, live progress while it runs, collapsed technical details on errors.
//
// Test hooks the builder must provide (on the wizard's waiting card and step 4 error area):
//  - the waiting card is data-testid="tailor-progress" (as before); progress text is plain text inside it;
//  - the technical details are a native <details> element inside <main> whose <summary> reads
//    "技术细节" / "Technical details"; it is collapsed (no `open` attribute) when the error appears, and its text
//    holds the cause (`max_tokens` or the problem paths) and the output token count.
// Synthetic data only; fake key from the tailor-flow fixture.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runTailor } from "../../src/ai/tailor.ts";
import * as enMod from "../../src/i18n/en.ts";
import * as zhMod from "../../src/i18n/zh.ts";
import { liveSse, sseErrorResponse, sseResponse } from "../fixtures/sse.ts";
import { FAKE_KEY, JD_EN, ORIGINAL_EN, apiOutput, validOutput } from "../fixtures/tailor-flow.ts";
import { leafValues } from "./dict-helpers.ts";
import { TXT, deferredApi, generateBtn, jdBox, backBtn, mainText, norm, resetStores, resumeBox, scriptedApi, startFlow } from "./flow-helpers.tsx";
import type { L } from "./flow-helpers.tsx";

const en = ((enMod as Record<string, unknown>)["en"] ?? (enMod as Record<string, unknown>)["default"]) as object;
const zh = ((zhMod as Record<string, unknown>)["zh"] ?? (zhMod as Record<string, unknown>)["default"]) as object;

beforeEach(() => resetStores());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetStores();
});

const LANGS: L[] = ["en", "zh"];
const T = {
  en: {
    cutoff:
      "The AI's answer was too long and was cut off. Your input is still here. Remove experience that does not matter for this job and try again, or use the Balanced mode.",
    unreadable: "The AI returned something we could not read. Your input is still here.",
    thinking: "The AI is thinking…",
    written: (n: string) => new RegExp(`About ${n} characters written`),
    hint: "Usually takes 1 to 3 minutes",
    details: /technical details/i,
  },
  zh: {
    cutoff: "AI 的回答太长，被截断了。你的输入都还在。可以删掉与这个职位无关的经历后再试，或换用「均衡」方式。",
    unreadable: "AI 返回的内容无法识别，你的输入都还在。",
    thinking: "AI 正在思考…",
    written: (n: string) => new RegExp(`已生成约 ?${n} ?字`),
    hint: "通常需要 1–3 分钟",
    details: /技术细节/,
  },
} as const;

const click = (el: HTMLElement) => fireEvent.click(el);
const main = () => screen.getByRole("main");
const detailsEl = (lang: L) =>
  Array.from(main().querySelectorAll("details")).find((d) => T[lang].details.test(d.querySelector("summary")?.textContent ?? "")) as HTMLDetailsElement | undefined;
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 60))));
const num = (n: number) => new RegExp(String(n).replace(/(\d)(?=(\d{3})+$)/, "$1,?"));

describe("criterion 4: the tailor request", () => {
  it("runTailor sends stream: true, max_tokens 32000 and no thinking, effort or output_config; works with a custom model id", async () => {
    const f = vi.fn(async () => apiOutput(validOutput()));
    vi.stubGlobal("fetch", f);
    await runTailor({ original: ORIGINAL_EN, jd: JD_EN, lang: "en", mode: "balanced", key: FAKE_KEY, model: "my-custom-model-7" });
    expect(f).toHaveBeenCalledTimes(1);
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body["stream"]).toBe(true);
    expect(body["max_tokens"]).toBe(32000);
    expect(body["model"]).toBe("my-custom-model-7");
    for (const k of ["thinking", "effort", "output_config"]) expect(k in body).toBe(false);
    expect(String(init.body)).not.toContain(FAKE_KEY);
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(FAKE_KEY);
  });
  it("runTailor passes onText through, if given", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => apiOutput(validOutput())));
    const seen: number[] = [];
    await runTailor({ original: ORIGINAL_EN, jd: JD_EN, lang: "en", mode: "balanced", key: FAKE_KEY, model: "claude-sonnet-5-5", onText: (n: number) => seen.push(n) } as Parameters<typeof runTailor>[0]);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(JSON.stringify(validOutput()).length);
  });
});

describe("criterion 5 and 6: cut-off versus invalid, at the runTailor level", () => {
  it("stop_reason max_tokens: one call, no retry, rejects with something that is not the unreadable error", async () => {
    const f = vi.fn(async () => sseResponse({ text: '{"resume":{"basics":', stopReason: "max_tokens", outputTokens: 32000 }));
    vi.stubGlobal("fetch", f);
    const err = await runTailor({ original: ORIGINAL_EN, jd: JD_EN, lang: "en", mode: "balanced", key: FAKE_KEY, model: "claude-sonnet-5-5" }).then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(err).toBeInstanceOf(Error);
    expect(err?.name).not.toBe("TailorInvalidError");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("a cut-off answer that happens to be valid JSON is still a cut-off (no result, no retry)", async () => {
    const f = vi.fn(async () => sseResponse({ text: JSON.stringify(validOutput()), stopReason: "max_tokens", outputTokens: 32000 }));
    vi.stubGlobal("fetch", f);
    const out = await runTailor({ original: ORIGINAL_EN, jd: JD_EN, lang: "en", mode: "balanced", key: FAKE_KEY, model: "claude-sonnet-5-5" }).then(
      () => "result",
      () => "error",
    );
    expect(out).toBe("error");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("normal end with invalid JSON: exactly one retry, then TailorInvalidError", async () => {
    const f = vi.fn(async () => sseResponse({ text: "not json", stopReason: "end_turn", outputTokens: 50 }));
    vi.stubGlobal("fetch", f);
    const err = await runTailor({ original: ORIGINAL_EN, jd: JD_EN, lang: "en", mode: "balanced", key: FAKE_KEY, model: "claude-sonnet-5-5" }).then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(err?.name).toBe("TailorInvalidError");
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("first call normal end but invalid, retry succeeds: the result", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (++n === 1 ? sseResponse({ text: "{}" }) : apiOutput(validOutput()))));
    const out = await runTailor({ original: ORIGINAL_EN, jd: JD_EN, lang: "en", mode: "balanced", key: FAKE_KEY, model: "claude-sonnet-5-5" });
    expect(out.resume.basics.name).toBe(validOutput().resume.basics.name);
    expect(n).toBe(2);
  });
});

for (const lang of LANGS) {
  const t = T[lang];
  const c = TXT[lang];

  describe(`criterion 5: cut-off answer in the wizard, ${lang}`, () => {
    it("one request only, the specific message, no unreadable text, input kept, Generate available again", async () => {
      const api = scriptedApi([() => sseResponse({ text: '{"resume":{"basics":{"name":"Alex', stopReason: "max_tokens", outputTokens: 32000 })]);
      startFlow(lang);
      click(generateBtn(lang));
      await waitFor(() => expect(mainText()).toContain(norm(t.cutoff)), { timeout: 4000 });
      await settle();
      expect(api.fetch).toHaveBeenCalledTimes(1);
      expect(mainText()).not.toContain(norm(t.unreadable));
      expect(screen.queryByTestId("tailor-progress")).toBeNull();
      expect(screen.queryByTestId("tailor-result")).toBeNull();
      expect(generateBtn(lang).disabled).toBe(false);
      click(backBtn(lang));
      click(backBtn(lang));
      expect(jdBox(lang).value).toBe(JD_EN);
      click(backBtn(lang));
      expect(resumeBox(lang).value).toBe(ORIGINAL_EN);
    });
  });

  describe(`criterion 6: invalid JSON after a normal end, ${lang}`, () => {
    it("one retry, then the unreadable error, with the problem paths in collapsed details", async () => {
      const bad = validOutput();
      (bad.resume.experience[0] as unknown as Record<string, unknown>)["company"] = 42;
      const api = scriptedApi([
        () => sseResponse({ text: "not json at all", stopReason: "end_turn", outputTokens: 11 }),
        () => sseResponse({ text: JSON.stringify(bad), stopReason: "end_turn", outputTokens: 4321 }),
      ]);
      startFlow(lang);
      click(generateBtn(lang));
      await waitFor(() => expect(mainText()).toContain(norm(t.unreadable)), { timeout: 4000 });
      expect(api.fetch).toHaveBeenCalledTimes(2);
      const d = detailsEl(lang);
      expect(d, "Technical details element").toBeTruthy();
      expect(d?.open).toBe(false);
      const text = d?.textContent ?? "";
      expect(text).toContain("resume.experience[0].company");
      expect(text).toMatch(num(4321));
      expect(text).not.toContain("not json at all");
    });
  });

  describe(`criterion 8: technical details, ${lang}`, () => {
    it("cut-off: collapsed details show max_tokens and the output token count", async () => {
      scriptedApi([() => sseResponse({ text: '{"resume":', stopReason: "max_tokens", outputTokens: 32000 })]);
      startFlow(lang);
      click(generateBtn(lang));
      await waitFor(() => expect(mainText()).toContain(norm(t.cutoff)), { timeout: 4000 });
      const d = detailsEl(lang);
      expect(d, "Technical details element").toBeTruthy();
      expect(d?.open).toBe(false);
      expect(d?.textContent).toContain("max_tokens");
      expect(d?.textContent).toMatch(num(32000));
    });
    it("problem paths: at most 12, each at most 40 characters of [A-Za-z0-9_.[]]; no resume, JD or model text", async () => {
      const MARK_RESUME = "ZZRESUMEMARK";
      const MARK_JD = "ZZJDMARK";
      const MARK_MODEL = "ZZMODELMARK";
      const bad = validOutput() as unknown as Record<string, unknown>;
      const resume = bad["resume"] as Record<string, unknown>;
      // 30 bad entries make far more than 12 problems; the unexpected key and the long text carry markers
      resume["extras"] = Array.from({ length: 30 }, () => ({ id: 5, heading: MARK_MODEL, items: "nope" }));
      resume["summary"] = MARK_MODEL.repeat(1000);
      resume["ZZ-KEY-MARK"] = MARK_MODEL;
      scriptedApi([
        () => sseResponse({ text: JSON.stringify(bad), outputTokens: 9001 }),
        () => sseResponse({ text: JSON.stringify(bad), outputTokens: 9002 }),
      ]);
      startFlow(lang, { original: `${ORIGINAL_EN}\n${MARK_RESUME}`, jd: `${JD_EN}\n${MARK_JD}` });
      click(generateBtn(lang));
      await waitFor(() => expect(mainText()).toContain(norm(t.unreadable)), { timeout: 4000 });
      const d = detailsEl(lang);
      expect(d).toBeTruthy();
      const text = d?.textContent ?? "";
      for (const m of [MARK_RESUME, MARK_JD, MARK_MODEL, "ZZ-KEY-MARK"]) expect(text).not.toContain(m);
      expect(mainText()).not.toContain(MARK_MODEL);
      const paths = text.match(/[A-Za-z_][A-Za-z0-9_.[\]]*\.[A-Za-z0-9_.[\]]+/g) ?? [];
      const resumePaths = paths.filter((p) => p.startsWith("resume") || p.startsWith("output"));
      expect(resumePaths.length).toBeGreaterThan(0);
      expect(resumePaths.length).toBeLessThanOrEqual(12);
      for (const p of resumePaths) expect(p.length).toBeLessThanOrEqual(40);
    });
    it("an error event mid-stream: an error is shown, the fake key and the server text appear nowhere", async () => {
      const api = scriptedApi([() => sseErrorResponse(FAKE_KEY)]);
      startFlow(lang);
      click(generateBtn(lang));
      await waitFor(() => expect(screen.queryByTestId("tailor-progress")).toBeNull(), { timeout: 4000 });
      await settle();
      expect(api.fetch).toHaveBeenCalledTimes(1);
      const all = main().textContent ?? "";
      expect(all).not.toContain(FAKE_KEY);
      expect(all).not.toContain("fakekey");
      expect(all).not.toContain("Overloaded");
      expect(generateBtn(lang).disabled).toBe(false);
    });
  });

  describe(`criterion 7: progress, ${lang}`, () => {
    it("thinking until the first text, then characters of JSON received rounded to hundreds; the time hint", async () => {
      const api = deferredApi();
      const live = liveSse();
      startFlow(lang);
      click(generateBtn(lang));
      await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1));
      const card = screen.getByTestId("tailor-progress");
      expect(card.textContent).toContain(norm(t.hint));
      expect(norm(card.textContent ?? "")).toContain(norm(t.thinking));
      await act(async () => api.respond(0, live.response));
      live.start();
      live.thinking("a long private chain of thought ".repeat(100));
      await settle();
      expect(norm(card.textContent ?? "")).toContain(norm(t.thinking));
      expect(card.textContent).not.toMatch(t.written("\\d+"));
      live.text("x".repeat(340));
      await waitFor(() => expect(card.textContent).toMatch(t.written("300")));
      expect(norm(card.textContent ?? "")).not.toContain(norm(t.thinking));
      live.text("y".repeat(894)); // 1234 in total
      await waitFor(() => expect(card.textContent).toMatch(t.written("1200")));
      live.end("end_turn", 10);
      await settle();
    });
  });

  describe(`criterion 3: abort during the stream, ${lang}`, () => {
    it("a confirmed cancel cancels the read; no result is applied; the input is kept", async () => {
      const api = deferredApi();
      const live = liveSse();
      startFlow(lang);
      click(generateBtn(lang));
      await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(1));
      await act(async () => api.respond(0, live.response));
      live.start();
      live.text("x".repeat(500));
      await settle();
      click(within(main()).getByRole("button", { name: c.cancel }));
      click(screen.getByTestId("cancel-confirm"));
      await waitFor(() => expect(screen.queryByTestId("tailor-progress")).toBeNull());
      await settle();
      expect(live.cancelled()).toBe(true);
      expect(screen.queryByTestId("tailor-result")).toBeNull();
      expect(mainText()).not.toContain(norm(t.unreadable));
      expect(mainText()).not.toContain(norm(t.cutoff));
      expect(api.fetch).toHaveBeenCalledTimes(1);
      expect(generateBtn(lang).disabled).toBe(false);
    });
  });
}

describe("criterion 11: new strings in both dictionaries", () => {
  it("the spec strings exist", () => {
    const wanted: Record<L, string[]> = {
      en: [T.en.cutoff, T.en.thinking, T.en.hint, "Technical details"],
      zh: [T.zh.cutoff, T.zh.thinking, T.zh.hint, "技术细节"],
    };
    for (const lang of LANGS) {
      const all = leafValues(lang === "en" ? en : zh).map(norm).join("\n");
      for (const w of wanted[lang]) expect(all, `${lang}: ${w}`).toContain(norm(w));
    }
    const joined = (d: object) => leafValues(d).join("\n");
    expect(joined(en)).toMatch(/About \{n\} characters written/);
    expect(joined(zh)).toMatch(/已生成约 ?\{n\} ?字/);
  });
});
