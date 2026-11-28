/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// resume-sg#47 criterion 4 (D: two result groups, an action on every card) and criterion 8 (H: export hint).
//
// DOM contract for the Check tab (the issue leaves the markup open, so these hooks are fixed here):
//  - the amber item cards and found-elsewhere cards sit in one group: data-testid="finding-group-notfound"
//    (heading "原简历里没有找到" / "Not found in your original");
//  - the amber coverage cards sit in another: data-testid="finding-group-missing" (heading "可能遗漏" / "Possibly missing");
//  - cards keep [data-finding-id]; red cards are outside both groups, above them;
//  - the toolbar data-testid="tailor-toolbar" holds both export buttons and the hint text.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { factCheck } from "../../src/ai/factCheck.ts";
import type { Finding, TailorOutput } from "../../src/ai/types.ts";
import { mdEnOutput, mdOriginal } from "../fixtures/markdown-resume.ts";
import { clone } from "../fixtures/fact-check-cases.ts";
import { apiOutput, redOutput, validOutput, ORIGINAL_EN } from "../fixtures/tailor-flow.ts";
import { TXT, activate, control, generateBtn, generateResult, goNext, main, mainText, norm, resetStores, resultView, scriptedApi, startFlow } from "./flow-helpers.tsx";
import type { L } from "./flow-helpers.tsx";

beforeEach(() => resetStores());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetStores();
});

const T = {
  en: {
    notFound: "Not found in your original",
    missing: "Possibly missing",
    elsewhere: "found elsewhere in your resume; confirm it belongs here",
    remove: "Remove it",
    keep: "Keep",
    redKeep: "Keep, my original left it out",
    hint: "Export coming soon",
  },
  zh: {
    notFound: "原简历里没有找到",
    missing: "可能遗漏",
    elsewhere: "在原简历的其他位置找到，请确认它属于这里",
    remove: "删掉这处",
    keep: "保留",
    redKeep: "我确认原简历遗漏了，保留",
    hint: "导出即将上线",
  },
} as const;

const card = (id: string) => Array.from(document.querySelectorAll<HTMLElement>("[data-finding-id]")).find((e) => e.dataset.findingId === id) as HTMLElement;
const group = (name: "notfound" | "missing") => screen.queryByTestId(`finding-group-${name}`);
const buttons = (el: HTMLElement) => within(el).queryAllByRole("button").map((b) => (b.textContent ?? "").trim());

/** zh original, English output with one finding of each kind (see the expectations in the test). */
function mixedOutput(): { out: TailorOutput; findings: Finding[] } {
  const out = clone(mdEnOutput());
  out.resume.skills[0]!.items.push("Rule engine"); // item amber (a multi-word Latin item in a zh -> en result)
  out.resume.experience[0]!.start = "2013-09"; // occurs only in the education line, far from this entry: amber, found elsewhere
  out.resume.experience[1]!.bullets[0]!.text += " Served 7 teams."; // 7 occurs nowhere: red
  out.notIncluded = out.notIncluded.filter((n) => !n.source.startsWith("Java")); // an uncovered line: amber coverage
  return { out, findings: factCheck(mdOriginal, out, { outputLang: "en" }) };
}

async function openCross(ui: L, out: TailorOutput, original: string, outLang: "English" | "中文") {
  scriptedApi([() => apiOutput(out)]);
  startFlow(ui, { original, stopAt: 3 });
  activate(control(outLang));
  goNext();
  fireEvent.click(generateBtn(ui));
  await resultView();
}

for (const ui of ["en", "zh"] as const) {
  const t = T[ui];

  describe(`criterion 4 (D): result groups, UI ${ui}`, () => {
    it("the fixture gives the expected findings (guards the next tests)", () => {
      const { findings } = mixedOutput();
      const by = (level: string, kind: string) => findings.filter((f) => f.level === level && f.kind === kind);
      expect(by("red", "number").map((f) => f.value)).toEqual(["7"]);
      expect(by("amber", "item").map((f) => f.value)).toEqual(["Rule engine"]);
      expect(by("amber", "date").map((f) => f.where)).toEqual(["experience[0].start"]);
      expect(by("amber", "basics")).toHaveLength(1);
      expect(by("amber", "coverage").map((f) => f.value)).toEqual(["Java、Kafka、LiteFlow、Docker"]);
    });

    it("two separate groups: 'Not found in your original' and 'Possibly missing', with the cards in the right one", async () => {
      const { out, findings } = mixedOutput();
      await openCross(ui, out, mdOriginal, "English");
      const nf = group("notfound");
      const miss = group("missing");
      expect(nf, "group not found in your original").toBeTruthy();
      expect(miss, "group possibly missing").toBeTruthy();
      expect(nf).not.toBe(miss);
      expect(nf!.contains(miss!) || miss!.contains(nf!)).toBe(false);
      expect(within(nf!).getByRole("heading", { name: t.notFound })).toBeTruthy();
      expect(within(miss!).getByRole("heading", { name: t.missing })).toBeTruthy();
      const idsIn = (g: HTMLElement) => Array.from(g.querySelectorAll<HTMLElement>("[data-finding-id]")).map((e) => e.dataset.findingId);
      const id = (kind: string, level = "amber") => findings.find((f) => f.kind === kind && f.level === level)!.id;
      expect(idsIn(nf!).sort()).toEqual([id("item"), id("date"), id("basics")].sort());
      expect(idsIn(miss!)).toEqual([id("coverage")]);
      const red = card(id("number", "red"));
      expect(red, "the red card").toBeTruthy();
      expect(nf!.contains(red) || miss!.contains(red)).toBe(false);
    });

    it("item and found-elsewhere cards have Remove it and Keep; the name card has Keep only; the coverage card has Add it back", async () => {
      const { out, findings } = mixedOutput();
      await openCross(ui, out, mdOriginal, "English");
      const c = (kind: string) => card(findings.find((f) => f.kind === kind && f.level === "amber")!.id);
      expect(buttons(c("item"))).toEqual([t.remove, t.keep]);
      expect(buttons(c("date"))).toEqual([t.remove, t.keep]);
      expect(buttons(c("basics"))).toEqual([t.keep]);
      expect(within(c("coverage")).getAllByTestId("finding-add")).toHaveLength(1);
      expect(within(c("coverage")).queryByRole("button", { name: t.remove })).toBeNull();
    });

    it("a found-elsewhere card carries the sentence 'found elsewhere in your resume; confirm it belongs here'", async () => {
      const { out, findings } = mixedOutput();
      await openCross(ui, out, mdOriginal, "English");
      const el = card(findings.find((f) => f.kind === "date" && f.level === "amber")!.id);
      expect(norm(el.textContent ?? "")).toContain(t.elsewhere);
      expect(el.textContent).toContain("2013");
    });

    it("every red and amber card has at least one action", async () => {
      const { out, findings } = mixedOutput();
      await openCross(ui, out, mdOriginal, "English");
      const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-finding-id]"));
      expect(cards).toHaveLength(findings.length);
      for (const el of cards) expect(within(el).getAllByRole("button").length, el.textContent ?? "").toBeGreaterThan(0);
      const red = cards.find((e) => e.dataset.findingId === findings.find((f) => f.level === "red")!.id)!;
      expect(buttons(red)).toEqual([t.remove, t.redKeep]);
    });

    it("Keep on an item card marks it handled; Remove it takes the item out of the preview", async () => {
      const { out, findings } = mixedOutput();
      await openCross(ui, out, mdOriginal, "English");
      const item = findings.find((f) => f.kind === "item")!;
      const preview = () => screen.getByTestId("resume-preview");
      expect(preview().textContent).toContain("Rule engine");
      fireEvent.click(within(card(item.id)).getByRole("button", { name: t.remove }));
      expect(preview().textContent).not.toContain("Rule engine");
      const name = findings.find((f) => f.kind === "basics")!;
      fireEvent.click(within(card(name.id)).getByRole("button", { name: t.keep }));
      expect(card(name.id).classList.contains("done")).toBe(true);
      expect(preview().textContent).toContain("Chen Hai");
    });

    it("Keep on a found-elsewhere date leaves it in the preview and marks the card handled", async () => {
      const { out, findings } = mixedOutput();
      await openCross(ui, out, mdOriginal, "English");
      const date = findings.find((f) => f.kind === "date" && f.level === "amber")!;
      const expText = () => screen.getByTestId("resume-preview").querySelector('[data-section="experience"]')!.textContent ?? "";
      expect(expText()).toContain("2013");
      fireEvent.click(within(card(date.id)).getByRole("button", { name: t.keep }));
      expect(card(date.id).classList.contains("done")).toBe(true);
      expect(expText()).toContain("2013");
    });
    it("Remove it on a found-elsewhere date clears that date from the preview", async () => {
      const { out, findings } = mixedOutput();
      await openCross(ui, out, mdOriginal, "English");
      const date = findings.find((f) => f.kind === "date" && f.level === "amber")!;
      const expText = () => screen.getByTestId("resume-preview").querySelector('[data-section="experience"]')!.textContent ?? "";
      expect(expText()).toContain("2013");
      fireEvent.click(within(card(date.id)).getByRole("button", { name: t.remove }));
      expect(expText()).not.toContain("2013");
    });

    it("a faithful result has no group at all", async () => {
      await generateResult(ui, validOutput(), { outputLang: "English" });
      expect(group("notfound")).toBeNull();
      expect(group("missing")).toBeNull();
    });
  });

  describe(`criterion 8 (H), changed by resume-sg#12: export is enabled once no red item is open, no hint, UI ${ui}`, () => {
    const exportBtns = () => [
      within(main()).getByRole("button", { name: TXT[ui].exportPdf }) as HTMLButtonElement,
      within(main()).getByRole("button", { name: TXT[ui].exportMd }) as HTMLButtonElement,
    ];
    const toolbar = () => norm(screen.getByTestId("tailor-toolbar").textContent ?? "");

    it("a faithful result with no open item: both buttons enabled and no 'coming soon' hint", async () => {
      await generateResult(ui, validOutput(), { outputLang: "English" });
      for (const b of exportBtns()) expect(b.disabled).toBe(false);
      expect(toolbar()).not.toContain(t.hint);
    });
    it("a result with a red item: disabled, and enabled once the item is handled; the hint never shows", async () => {
      const out = redOutput();
      const red = factCheck(ORIGINAL_EN, out, { outputLang: "en" }).find((f) => f.level === "red")!;
      await generateResult(ui, out, { outputLang: "English" });
      for (const b of exportBtns()) expect(b.disabled).toBe(true);
      expect(toolbar()).not.toContain(t.hint);
      fireEvent.click(within(card(red.id)).getByRole("button", { name: TXT[ui].keep }));
      await waitFor(() => expect(mainText()).toContain(norm(ui === "en" ? "All dates, numbers and sources were found in your original" : "日期、数字和出处都能在原简历里找到")));
      for (const b of exportBtns()) expect(b.disabled).toBe(false);
      expect(toolbar()).not.toContain(t.hint);
    });
    it("clicking a disabled export button (red item open) does nothing: no print, no download, no navigation", async () => {
      const print = vi.fn();
      vi.stubGlobal("print", print);
      const create = vi.fn(() => "blob:x");
      Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: create });
      await generateResult(ui, redOutput(), { outputLang: "English" });
      const before = window.location.hash;
      for (const b of exportBtns()) fireEvent.click(b);
      expect(window.location.hash).toBe(before);
      expect(print).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });
  });
}
