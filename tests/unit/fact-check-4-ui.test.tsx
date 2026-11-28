/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// resume-sg#52 (brief v8 section 1) in the result view: the green line per mode, the "Translated" group, and the two
// exploits showing findings and no green line.
//
// DOM contract (the issue leaves the markup open, so these hooks are fixed here, as #47 did for its groups):
//  - the cross-language amber lines (kind "translated") sit in one group: data-testid="finding-group-translated",
//    heading "换了语言，请对照原文" (UI zh) / "Translated: compare with your original" (UI en); the existing
//    data-testid="original-lines" panel is shown in a cross-language run, as before;
//  - cards keep [data-finding-id] and have at least one button;
//  - the amber "source too short" card shows "出处太短，无法核对" (UI zh) / "Source too short to check" (UI en);
//  - the green line is shown when no red item is open and the check found nothing else except the translated lines
//    (and, cross-language, the name note); it is flow.green in a same-language run and flow.greenCross in a
//    cross-language run. An output with open amber source or coverage findings shows neither.
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { factCheck } from "../../src/ai/factCheck.ts";
import type { TailorOutput } from "../../src/ai/types.ts";
import { emptySourced } from "../fixtures/fact-check-cases.ts";
import { ORIGINAL_EN, ORIGINAL_ZH, apiOutput, crossEnOutput, crossZhOutput, validOutput } from "../fixtures/tailor-flow.ts";
import { activate, control, generateBtn, generateResult, goNext, mainText, norm, resetStores, resultView, scriptedApi, startFlow } from "./flow-helpers.tsx";
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
    green: "All dates, numbers and sources were found in your original",
    greenCross: "All dates and numbers were found in your original. Titles, degrees and names are in another language, so compare them with the original.",
    translated: "Translated: compare with your original",
    tooShort: "Source too short to check",
  },
  zh: {
    green: "日期、数字和出处都能在原简历里找到",
    greenCross: "日期和数字都能在原简历里找到。职位、学历和名称换了语言，请对照原文看一遍。",
    translated: "换了语言，请对照原文",
    tooShort: "出处太短，无法核对",
  },
} as const;

const card = (id: string) => Array.from(document.querySelectorAll<HTMLElement>("[data-finding-id]")).find((e) => e.dataset.findingId === id) as HTMLElement;
const idsIn = (g: HTMLElement) => Array.from(g.querySelectorAll<HTMLElement>("[data-finding-id]")).map((e) => e.dataset.findingId);

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

  describe(`the green line per mode, UI ${ui}`, () => {
    it("a faithful same-language run shows flow.green and not flow.greenCross", async () => {
      await generateResult(ui, validOutput());
      expect(mainText()).toContain(norm(t.green));
      expect(mainText()).not.toContain(norm(t.greenCross));
      expect(screen.queryByTestId("finding-group-translated")).toBeNull();
    });

    it("a faithful English -> Chinese run shows flow.greenCross, not flow.green, and the Translated group", async () => {
      const out = crossZhOutput();
      const findings = factCheck(ORIGINAL_EN, out, { outputLang: "zh" });
      expect(findings.filter((f) => f.level === "red")).toEqual([]);
      expect(findings.every((f) => (f.kind as string) === "translated")).toBe(true); // the fixture: nothing but the Translated lines
      await openCross(ui, out, ORIGINAL_EN, "中文");
      expect(mainText()).toContain(norm(t.greenCross));
      expect(mainText()).not.toContain(norm(t.green));
    });

    it("English -> Chinese: one card per title and degree in the Translated group, with an action each; the original lines show", async () => {
      const out = crossZhOutput();
      const translated = factCheck(ORIGINAL_EN, out, { outputLang: "zh" }).filter((f) => (f.kind as string) === "translated");
      expect(translated.map((f) => f.where).sort()).toEqual(["education[0].degree", "experience[0].title", "experience[1].title", "experience[2].title"]);
      await openCross(ui, out, ORIGINAL_EN, "中文");
      const g = screen.getByTestId("finding-group-translated");
      expect(within(g).getByRole("heading", { name: t.translated })).toBeTruthy();
      expect(idsIn(g).sort()).toEqual(translated.map((f) => f.id).sort());
      for (const f of translated) {
        expect(card(f.id).textContent).toContain(f.value);
        expect(within(card(f.id)).getAllByRole("button").length).toBeGreaterThan(0);
      }
      expect(screen.getByTestId("original-lines")).toBeTruthy();
      expect(screen.queryByTestId("finding-group-notfound")).toBeNull();
      expect(screen.queryByTestId("finding-group-missing")).toBeNull();
    });

    it("Chinese -> English: the Translated group lists the titles and the degree too", async () => {
      const out = crossEnOutput();
      const findings = factCheck(ORIGINAL_ZH, out, { outputLang: "en" });
      const translated = findings.filter((f) => (f.kind as string) === "translated");
      expect(translated).toHaveLength(3);
      await openCross(ui, out, ORIGINAL_ZH, "English");
      const g = screen.getByTestId("finding-group-translated");
      expect(idsIn(g).sort()).toEqual(translated.map((f) => f.id).sort());
      const nf = screen.queryByTestId("finding-group-notfound");
      if (nf) for (const f of translated) expect(nf.contains(card(f.id))).toBe(false);
    });

    it("a same-language run never shows the Translated group", async () => {
      await generateResult(ui, validOutput());
      expect(screen.queryByTestId("finding-group-translated")).toBeNull();
    });
  });

  describe(`the exploits show findings and no green line, UI ${ui}`, () => {
    it("(a) an empty resume with notIncluded sources 'e' and 'i': amber cards, no green line of either kind", async () => {
      const out: TailorOutput = { resume: emptySourced(), changes: [], notIncluded: [{ source: "e" }, { source: "i" }] };
      const findings = factCheck(ORIGINAL_EN, out, { outputLang: "en" });
      expect(findings.length).toBeGreaterThan(0);
      scriptedApi([() => apiOutput(out)]);
      startFlow(ui, { stopAt: 3 });
      activate(control("English"));
      goNext();
      fireEvent.click(generateBtn(ui));
      await resultView();
      expect(mainText()).not.toContain(norm(t.green));
      expect(mainText()).not.toContain(norm(t.greenCross));
      const weak = findings.filter((f) => f.kind === "source" && f.level === "amber");
      expect(weak).toHaveLength(2);
      for (const f of weak) expect(norm(card(f.id).textContent ?? "")).toContain(t.tooShort);
      expect(document.querySelectorAll("[data-finding-id]")).toHaveLength(findings.length);
    });

    it("(b) a bullet whose source is the whole original: a red number card, export waits, no green line", async () => {
      const out = validOutput();
      out.resume.experience[0]!.bullets[0] = { text: "Led a team of 5 engineers.", source: ORIGINAL_EN };
      const red = factCheck(ORIGINAL_EN, out, { outputLang: "en" }).filter((f) => f.level === "red");
      expect(red.map((f) => [f.kind, f.value])).toEqual([["number", "5"]]);
      await generateResult(ui, out);
      expect(card(red[0]!.id)).toBeTruthy();
      expect(mainText()).not.toContain(norm(t.green));
    });
  });
}
