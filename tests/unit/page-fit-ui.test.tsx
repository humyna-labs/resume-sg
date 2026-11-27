// resume-sg#11 criteria 4, 5 (count from the rendered height), 6, 8 and the owner's "Put back / Add it back" rule,
// through the tailor flow (#/app) with a fake API. jsdom has no layout, so this file gives every element a height
// that depends only on the bullets (<li data-bullet>) inside it: PX per bullet. The count and the tightening must
// follow whatever the preview measures (offsetHeight, scrollHeight, clientHeight, getBoundingClientRect, or a
// ResizeObserver entry). The margins are wide on purpose: the preview paginates its own way, so no test depends on
// one exact bullet count.
//
// Test hooks the builder must provide (besides those in flow-helpers.tsx):
//  - the page count in data-testid="tailor-toolbar" ("1 page", "2 pages", "N pages" / "1 页", "2 页"...)
//  - when it still exceeds two pages after nothing more can move: the sentence of criterion 4 inside <main>
//  - "Not in this version" tab: one <li> per item inside the tabpanel, each with a button named "Put back..."
//    (the key "Add it back" of an amber "Possibly missing" finding keeps working as in #30)
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../src/i18n/en.ts";
import zh from "../../src/i18n/zh.ts";
import { factCheck } from "../../src/ai/factCheck.ts";
import type { TailorOutput } from "../../src/ai/types.ts";
import { longRoles, shortRoles, synth } from "../fixtures/page-fit.ts";
import { leafValues } from "./dict-helpers.ts";
import { control, generateBtn, main, mainText, resetStores, scriptedApi, startFlow } from "./flow-helpers.tsx";
import { apiOutput } from "../fixtures/tailor-flow.ts";
import type { L } from "./flow-helpers.tsx";

// ---------------------------------------------------------------- fake layout
let PX = 40;
const bulletsIn = (el: Element): number => (el.matches("li[data-bullet]") ? 1 : 0) + el.querySelectorAll("li[data-bullet]").length;
const heightOf = (el: Element): number => bulletsIn(el) * PX;

const saved = new Map<string, PropertyDescriptor | undefined>();
function stubLayout(px: number) {
  PX = px;
  const define = (proto: object, name: string, get: () => unknown, key: string) => {
    saved.set(key, Object.getOwnPropertyDescriptor(proto, name));
    Object.defineProperty(proto, name, { configurable: true, get });
  };
  for (const name of ["offsetHeight", "scrollHeight", "clientHeight"]) {
    define(HTMLElement.prototype, name, function (this: HTMLElement) { return heightOf(this); } as () => unknown, `H.${name}`);
  }
  saved.set("rect", Object.getOwnPropertyDescriptor(Element.prototype, "getBoundingClientRect"));
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const h = heightOf(this);
    return { x: 0, y: 0, top: 0, left: 0, right: 794, bottom: h, width: 794, height: h, toJSON: () => ({}) } as DOMRect;
  };
  class FakeRO {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(el: Element) {
      const h = heightOf(el);
      const entry = { target: el, contentRect: { width: 794, height: h, x: 0, y: 0, top: 0, left: 0, right: 794, bottom: h }, borderBoxSize: [{ blockSize: h, inlineSize: 794 }], contentBoxSize: [{ blockSize: h, inlineSize: 794 }] };
      setTimeout(() => this.cb([entry as unknown as ResizeObserverEntry], this as unknown as ResizeObserver), 0);
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", FakeRO);
}
function restoreLayout() {
  for (const name of ["offsetHeight", "scrollHeight", "clientHeight"]) {
    const d = saved.get(`H.${name}`);
    if (d) Object.defineProperty(HTMLElement.prototype, name, d);
    else Reflect.deleteProperty(HTMLElement.prototype, name);
  }
  const r = saved.get("rect");
  if (r) Object.defineProperty(Element.prototype, "getBoundingClientRect", r);
  saved.clear();
}

vi.setConfig({ testTimeout: 40000 });
beforeEach(() => resetStores());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  restoreLayout();
  resetStores();
});

// ---------------------------------------------------------------- helpers
const preview = () => screen.getByTestId("resume-preview");
const previewBullets = () => Array.from(preview().querySelectorAll<HTMLElement>("li[data-bullet]")).map((e) => (e.textContent ?? "").trim());
const toolbarText = () => (screen.getByTestId("tailor-toolbar").textContent ?? "").replace(/\s+/g, " ");
const PAGES = { en: { one: /(^|\D)1 page(?!s)/, two: /(^|\D)2 pages/, many: /(^|\D)([3-9]|\d\d) pages/ }, zh: { one: /(^|\D)1 页/, two: /(^|\D)2 页/, many: /(^|\D)([3-9]|\d\d) 页/ } };
const WARN = { en: "Still over two pages. Shorten some bullets in your base resume.", zh: "仍超过两页，请精简原简历中的部分要点。" };
const notIncludedTab = () => control(/^Not in this version/);
async function openNotIncluded() {
  fireEvent.click(notIncludedTab());
  return within(screen.getByRole("tabpanel"));
}
const listItems = (panel: ReturnType<typeof within>): HTMLElement[] => panel.queryAllByRole("listitem");
async function run(lang: L, output: TailorOutput, original: string, px: number) {
  stubLayout(px);
  scriptedApi([() => apiOutput(output)]);
  startFlow(lang, { original });
  fireEvent.click(generateBtn(lang));
  await screen.findByTestId("tailor-result", undefined, { timeout: 9000 });
}

// ---------------------------------------------------------------- criterion 5 (count from the rendered height)
describe("criterion 5: the preview shows 1 page when it fits", () => {
  for (const lang of ["en", "zh"] as const) {
    it(`${lang}: a short resume shows 1 page and nothing is moved`, async () => {
      const { original, output } = synth(shortRoles());
      await run(lang, output, original, 100);
      await waitFor(() => expect(toolbarText()).toMatch(PAGES[lang].one));
      expect(previewBullets()).toHaveLength(6);
      expect(mainText()).not.toContain(WARN[lang]);
    });
  }
});

// ---------------------------------------------------------------- criteria 2/5: a long resume is tightened
const longFixture = () => synth(longRoles(6, 5)); // 6 roles x 5 bullets = 30, dates 2008 to now: target 2 pages

describe("criterion 5: a long resume is tightened to at most 2 pages; moved bullets are under Not in this version", () => {
  for (const lang of ["en", "zh"] as const) {
    it(`${lang}: shows 2 pages, keeps every company, no warning`, async () => {
      const { original, output } = longFixture();
      await run(lang, output, original, 100);
      await waitFor(() => expect(toolbarText()).toMatch(PAGES[lang].two), { timeout: 9000 });
      const shown = previewBullets();
      expect(shown.length).toBeLessThan(30);
      expect(shown.length).toBeGreaterThanOrEqual(12); // stopped as soon as it fit; capacity is about 20 to 22 bullets
      expect(mainText()).not.toContain(WARN[lang]);
      const text = preview().textContent ?? "";
      for (const e of output.resume.experience) expect(text).toContain(e.company);
    });
  }

  it("the moved bullets are listed under 'Not in this version' with their count; every one has a Put back button", async () => {
    const { original, output } = longFixture();
    await run("en", output, original, 100);
    await waitFor(() => expect(toolbarText()).toMatch(PAGES.en.two), { timeout: 9000 });
    const shown = previewBullets();
    expect(notIncludedTab().textContent).toContain(String(30 - shown.length));
    const panel = await openNotIncluded();
    expect(listItems(panel)).toHaveLength(30 - shown.length);
    expect(panel.getAllByRole("button", { name: /^Put back/ })).toHaveLength(30 - shown.length);
    const listed = listItems(panel).map((li) => (li.textContent ?? "").replace(/Put back.*$/s, "").trim());
    for (const t of listed) expect(shown).not.toContain(t);
    expect(new Set([...listed, ...shown]).size).toBe(30);
  });

  it("the tightened result still passes the fact-check with no new finding", async () => {
    const { original, output } = longFixture();
    expect(factCheck(original, output)).toEqual([]);
    await run("en", output, original, 100);
    await waitFor(() => expect(toolbarText()).toMatch(PAGES.en.two), { timeout: 9000 });
    // Changed by resume-sg#12: no red item is open, so both export buttons are enabled and the hint is gone
    expect(within(main()).getByRole("button", { name: /save as pdf/i }).hasAttribute("disabled")).toBe(false);
    expect(within(main()).getByRole("button", { name: /download markdown/i }).hasAttribute("disabled")).toBe(false);
    expect(mainText()).not.toContain("Export coming soon");
  });
});

// ---------------------------------------------------------------- owner: Put back on a resume at its target
describe("Put back on a resume at its page target: the line stays and other bullets move instead", () => {
  for (const lang of ["en"] as const) {
    it("Put back: the put-back bullet is in the preview, still 2 pages, no warning, the count of listed items is the same", async () => {
      const { original, output } = longFixture();
      await run(lang, output, original, 100);
      await waitFor(() => expect(toolbarText()).toMatch(PAGES[lang].two), { timeout: 9000 });
      const beforeShown = previewBullets().length;
      const panel = await openNotIncluded();
      const items = listItems(panel);
      const before = items.length;
      const target = items[0] as HTMLElement;
      const line = (target.textContent ?? "").replace(/Put back.*$/s, "").trim();
      expect(previewBullets()).not.toContain(line);
      fireEvent.click(within(target).getByRole("button", { name: /^Put back/ }));
      await waitFor(() => expect(previewBullets()).toContain(line), { timeout: 9000 });
      // tightening ran again with that line fixed: another bullet moved out, so it still meets its target
      await waitFor(() => expect(toolbarText()).toMatch(PAGES[lang].two), { timeout: 9000 });
      expect(mainText()).not.toContain(WARN[lang]);
      expect(previewBullets().length).toBeLessThanOrEqual(beforeShown + 1);
      expect(previewBullets().length).toBeGreaterThanOrEqual(beforeShown - 1);
      const panel2 = await openNotIncluded();
      expect(listItems(panel2).length).toBeGreaterThanOrEqual(before - 1);
      expect(listItems(panel2).length).toBeLessThanOrEqual(before);
      expect(listItems(panel2).map((li) => li.textContent ?? "").join("|")).not.toContain(line);
      // the put-back line is never moved out again, also not after another click elsewhere
      fireEvent.click(control(/^Check/));
      expect(previewBullets()).toContain(line);
    });

    it("Add it back (amber finding): the line stays, the resume still meets its target, no warning", async () => {
      const { original, output } = longFixture();
      const dropped = (output.resume.experience[0]?.bullets.splice(3, 1) ?? [])[0];
      expect(dropped).toBeTruthy();
      await run(lang, output, original, 100);
      await waitFor(() => expect(toolbarText()).toMatch(PAGES[lang].two), { timeout: 9000 });
      const beforeShown = previewBullets().length;
      const add = await screen.findByTestId("finding-add");
      fireEvent.click(add);
      await waitFor(() => expect(previewBullets()).toContain((dropped as { text: string }).text), { timeout: 9000 });
      await waitFor(() => expect(toolbarText()).toMatch(PAGES[lang].two), { timeout: 9000 });
      expect(mainText()).not.toContain(WARN[lang]);
      expect(previewBullets().length).toBeLessThanOrEqual(beforeShown + 1);
      expect(previewBullets().length).toBeGreaterThanOrEqual(beforeShown - 1);
    });

    it("a 1-page target (short career, many bullets): Put back keeps the line and the resume stays at 1 page", async () => {
      // 6 roles in the last 4 years, 5 bullets each: target 1 page
      const roles = longRoles(6, 5, { firstYear: new Date().getFullYear() - 4 });
      const { original, output } = synth(roles);
      await run(lang, output, original, 100);
      await waitFor(() => expect(toolbarText()).toMatch(PAGES[lang].one), { timeout: 9000 });
      const panel = await openNotIncluded();
      const target = listItems(panel)[0] as HTMLElement;
      const line = (target.textContent ?? "").replace(/Put back.*$/s, "").trim();
      fireEvent.click(within(target).getByRole("button", { name: /^Put back/ }));
      await waitFor(() => expect(previewBullets()).toContain(line), { timeout: 9000 });
      await waitFor(() => expect(toolbarText()).toMatch(PAGES[lang].one), { timeout: 9000 });
      expect(mainText()).not.toContain(WARN[lang]);
    });
  }
});

// ---------------------------------------------------------------- criteria 4 and 6: nothing more can move
describe("criteria 4 and 6: still over two pages when nothing can move", () => {
  // 6 roles x 3 bullets, 600 px per bullet: even one bullet per role is 3600 px
  const hard = () => synth(longRoles(6, 3));

  for (const lang of ["en", "zh"] as const) {
    it(`${lang}: shows the real page count, the warning sentence, and export is enabled with no hint (#12)`, async () => {
      const { original, output } = hard();
      await run(lang, output, original, 600);
      await waitFor(() => expect(mainText()).toContain(WARN[lang]), { timeout: 9000 });
      expect(toolbarText()).toMatch(PAGES[lang].many);
      const shown = previewBullets();
      expect(shown).toHaveLength(6); // one bullet per entry is the floor
      const text = preview().textContent ?? "";
      for (const e of output.resume.experience) expect(text).toContain(e.company);
      const exportBtn = within(main()).getByRole("button", { name: lang === "en" ? /save as pdf/i : /另存为 ?PDF/i });
      // Changed by resume-sg#12: export is enabled (no red item) and the hint is gone; the page count stays as #11 shows it
      expect(exportBtn.hasAttribute("disabled")).toBe(false);
      expect(mainText()).not.toContain(lang === "en" ? "Export coming soon" : "导出即将上线");
    });
  }

  it("Put back when it is already over: the line shows, the real count and the warning stay, nothing is moved back out of the user's choice", async () => {
    const { original, output } = hard();
    await run("en", output, original, 600);
    await waitFor(() => expect(mainText()).toContain(WARN.en), { timeout: 9000 });
    const panel = await openNotIncluded();
    const target = listItems(panel)[0] as HTMLElement;
    const line = (target.textContent ?? "").replace(/Put back.*$/s, "").trim();
    fireEvent.click(within(target).getByRole("button", { name: /^Put back/ }));
    await waitFor(() => expect(previewBullets()).toContain(line), { timeout: 9000 });
    expect(toolbarText()).toMatch(PAGES.en.many);
    expect(mainText()).toContain(WARN.en);
    expect(previewBullets()).toContain(line);
  });
});

// ---------------------------------------------------------------- criterion 8
describe("criterion 8: new strings in both dictionaries", () => {
  it("has the over-two-pages sentence in English and in Chinese", () => {
    expect(leafValues(en)).toContain(WARN.en);
    expect(leafValues(zh)).toContain(WARN.zh);
  });
  it("has a Put back label in English", () => {
    expect(leafValues(en).some((v) => /^Put back/.test(v))).toBe(true);
  });
  it("both dictionaries have the same keys", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });
  it("the page labels exist in both languages: '1 page' / '1 页' and '{n} pages' / '{n} 页'", () => {
    expect(leafValues(en).some((v) => /^1 page(?!s)/.test(v))).toBe(true);
    expect(leafValues(en).some((v) => /^\{n\} pages/.test(v))).toBe(true);
    expect(leafValues(zh).some((v) => /^1 页/.test(v))).toBe(true);
    expect(leafValues(zh).some((v) => /^\{n\} 页/.test(v))).toBe(true);
  });
});
