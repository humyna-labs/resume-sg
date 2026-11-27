// Shared helpers for resume-sg#30 (tailor flow) tests and for the route-level editor tests that now
// reach the editor through "Edit result".
//
// Updated for resume-sg#41 (five-step wizard, brief v6). Test hooks the builder must provide on the Start route (#/app):
//  - wizard: data-testid="wizard-progress" (five <li data-step="1".."5" data-state="done|current|todo">; done nodes hold a
//    button, the current node has aria-current="step"), data-testid="step-heading" (the focused heading of the current
//    step, tabindex -1), data-testid="step-footer" holding the Back button (steps 2 to 4) and the primary button
//    data-testid="step-next" (named after the next step; on step 4 it is "Generate tailored resume"),
//    data-testid="generate-hint" under the primary button holding one [data-hint] element per missing item.
//    Step 1 shows only the resume textarea, step 2 only the JD textarea, step 3 the template, language and mode,
//    step 4 the summary, the key row, the model select and Generate.
//  - data-testid="key-row" around the key row of step 4 (compact row or key field)
//  - labelled textareas: "你的原始简历 / Your current resume" (step 1) and "职位描述（JD）/ Job description" (step 2)
//  - key input labelled "Anthropic API key" ("Anthropic API key（密钥）") when no key; a compact row with a
//    "修改 / Change" button when a key exists; the model <select> named "模型 / Model" (both states)
//  - template cards, output language and mode as radio, tab, button or option controls inside <main>
//  - data-testid="generate-hint" holding one element with data-hint="resume" | "jd" | "key" per missing item
//  - data-testid="tailor-progress" (progress card, replaces data-testid="tailor-options"),
//    data-testid="tailor-spinner", the four steps as <li data-state="done|now|todo"> inside the progress card
//  - cancel dialog: role="alertdialog" or "dialog"; confirm button data-testid="cancel-confirm"
//  - result: data-testid="tailor-result" (left column), tabs role="tab", findings as
//    [data-finding-id="<Finding.id>"] with buttons 删掉这处 / Remove it and 我确认原简历遗漏了，保留 / Keep, my original left it out;
//    amber findings have a button data-testid="finding-add"; list data-testid="original-lines" (criterion 8a);
//    toolbar data-testid="tailor-toolbar" (template switch, page count, export buttons),
//    A4 preview data-testid="resume-preview" (with data-template); "编辑结果 / Edit result" opens the editor
//    (data-testid="resume-editor", and then exactly one data-testid="resume-preview").
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, vi } from "vitest";
import { App } from "../../src/App.tsx";
import { clearKey, setKey } from "../../src/security/keyStore.ts";
import { FAKE_KEY, JD_EN, ORIGINAL_EN, apiOutput, emptyOutput } from "../fixtures/tailor-flow.ts";

export type L = "en" | "zh";
export const TAG = { en: "en-US", zh: "zh-CN" } as const;
export const norm = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

export const TXT = {
  en: {
    resume: "Your current resume",
    jd: "Job description",
    generate: "Generate tailored resume",
    keyLabel: "Anthropic API key",
    modelSelect: "Model",
    change: "Change",
    cancel: "Cancel",
    keepWaiting: "Keep waiting",
    editResult: "Edit result",
    editInput: "Edit input and regenerate",
    remove: "Remove it",
    keep: "Keep, my original left it out",
    exportPdf: /export pdf/i,
    exportMd: /export markdown/i,
  },
  zh: {
    resume: "你的原始简历",
    jd: "职位描述（JD）",
    generate: "生成定制简历",
    keyLabel: "Anthropic API key（密钥）",
    modelSelect: "模型",
    change: "修改",
    cancel: "取消生成",
    keepWaiting: "继续等待",
    editResult: "编辑结果",
    editInput: "修改输入后重新生成",
    remove: "删掉这处",
    keep: "我确认原简历遗漏了，保留",
    exportPdf: /导出 ?PDF/i,
    exportMd: /导出 ?Markdown/i,
  },
} as const;

export const main = () => screen.getByRole("main");
export const mainText = () => norm(main().textContent ?? "");

export function renderApp(lang: L, hash = "#/app") {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(TAG[lang]);
  window.location.hash = hash;
  return render(<App />);
}

export const resumeBox = (lang: L) => within(main()).getByLabelText(TXT[lang].resume) as HTMLTextAreaElement;
export const jdBox = (lang: L) => within(main()).getByLabelText(TXT[lang].jd) as HTMLTextAreaElement;
export const typeInto = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
export const generateBtn = (lang: L) =>
  within(main()).getByRole("button", { name: TXT[lang].generate }) as HTMLButtonElement;

export const stepNext = () => screen.getByTestId("step-next") as HTMLButtonElement;
export const stepHeading = () => screen.getByTestId("step-heading");
export const NEXT = {
  en: ["Next: Job description →", "Next: Template & mode →", "Next: Generate →"],
  zh: ["下一步：职位描述 →", "下一步：模板与方式 →", "下一步：生成 →"],
} as const;
export const BACK = { en: "← Back", zh: "← 上一步" } as const;
export const backBtn = (lang: L) => within(screen.getByTestId("step-footer")).getByRole("button", { name: BACK[lang] });
export const goNext = () => {
  expect(stepNext().disabled).toBe(false);
  fireEvent.click(stepNext());
};
/** From step 1 of a fresh Start route: fill the two texts and walk to step `to` (default 4). */
export function walkTo(lang: L, to: 1 | 2 | 3 | 4 = 4, original = ORIGINAL_EN, jd = JD_EN) {
  typeInto(resumeBox(lang), original);
  if (to === 1) return;
  goNext();
  typeInto(jdBox(lang), jd);
  if (to === 2) return;
  goNext();
  if (to === 3) return;
  goNext();
}

/** A radio, tab, button or option inside <main> (templates, output language, mode, template switch). */
export function control(name: RegExp | string, root: HTMLElement = main()): HTMLElement {
  for (const role of ["radio", "tab", "button", "option"] as const) {
    const hit = within(root).queryAllByRole(role, { name }).find((e) => !e.closest("[data-template]"));
    if (hit) return hit;
  }
  throw new Error(`no control named ${String(name)}`);
}
export function activate(el: HTMLElement) {
  if (el.tagName === "OPTION") {
    const sel = el.closest("select") as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: (el as HTMLOptionElement).value } });
  } else fireEvent.click(el);
}
export const isSelected = (el: HTMLElement) =>
  el.getAttribute("aria-checked") === "true" ||
  el.getAttribute("aria-pressed") === "true" ||
  el.getAttribute("aria-selected") === "true" ||
  (el as HTMLInputElement).checked === true ||
  (el as HTMLOptionElement).selected === true;

export interface FakeApi {
  fetch: ReturnType<typeof vi.fn>;
  /** each call: url, init, parsed body, and the settle functions */
  calls: { url: string; init: RequestInit; body: { model: string; system: string; messages: { content: string }[]; tools?: unknown } }[];
  respond: (i: number, r: Response) => void;
}
/** A fake fetch that answers only when the test says so; it rejects with an AbortError on abort. */
export function deferredApi(): FakeApi {
  const calls: FakeApi["calls"] = [];
  const settle: ((r: Response) => void)[] = [];
  const fetch = vi.fn((url: unknown, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      calls.push({ url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body ?? "{}")) });
      settle.push(resolve);
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, calls, respond: (i, r) => settle[i]?.(r) };
}
/** A fake fetch that answers each call at once from a list of factories (the last one repeats). */
export function scriptedApi(answers: (() => Response)[]): FakeApi {
  const calls: FakeApi["calls"] = [];
  const fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body ?? "{}")) });
    const f = answers[Math.min(calls.length - 1, answers.length - 1)];
    return (f as () => Response)();
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, calls, respond: () => undefined };
}

export function withKey(key = FAKE_KEY) {
  setKey(key, false);
}
export function resetStores() {
  localStorage.clear();
  sessionStorage.clear();
  clearKey();
  window.location.hash = "";
}

/** Render the Start route with a key, fill both texts and walk to step 4 (or `stopAt`), ready to click Generate. */
export function startFlow(lang: L, opts: { original?: string; jd?: string; key?: string | null; stopAt?: 1 | 2 | 3 | 4 } = {}) {
  if (opts.key !== null) withKey(opts.key ?? FAKE_KEY);
  const view = renderApp(lang);
  walkTo(lang, opts.stopAt ?? 4, opts.original ?? ORIGINAL_EN, opts.jd ?? JD_EN);
  return view;
}

export const resultView = () => screen.findByTestId("tailor-result", undefined, { timeout: 4000 });

/** Click Generate with a fake API that answers at once, and wait for the result state. */
export async function generateResult(lang: L, output: ReturnType<typeof emptyOutput>, opts: Parameters<typeof startFlow>[1] = {}) {
  const api = scriptedApi([() => apiOutput(output)]);
  startFlow(lang, opts);
  fireEvent.click(generateBtn(lang));
  await resultView();
  return api;
}

/** For the route-level editor tests: reach the structured editor through the flow ("Edit result"). */
export async function openEditor(lang: L = "en") {
  localStorage.clear();
  sessionStorage.clear();
  await generateResult(lang, emptyOutput(), { original: "Sam Sample", jd: "Any job" });
  fireEvent.click(within(main()).getByRole("button", { name: TXT[lang].editResult }));
  await waitFor(() => expect(screen.getByTestId("resume-editor")).toBeTruthy());
}

export async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}
