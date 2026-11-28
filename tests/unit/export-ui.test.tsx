/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// resume-sg#12 criteria 3, 4, 5, 7, 9, 10 (unit part) and 11 (FAQ): the export buttons of the result state.
//
// Hooks: the buttons are in data-testid="tailor-toolbar", named "Save as PDF" / "另存为 PDF" and
// "Download Markdown" / "下载 Markdown" (the old "Export PDF" labels are gone). The reason for a disabled button
// ("Resolve the items in red first" / "请先处理标红的内容") may be visible text in the toolbar, a title, or the
// button's accessible description. While red items are open the page also carries the print notice (criterion 10)
// as one element holding exactly "请先处理红色项再导出 / Deal with the red items before exporting"; it is absent
// once nothing is open. @media print rules are checked in tests/e2e/export.spec.ts.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { factCheck } from "../../src/ai/factCheck.ts";
import en from "../../src/i18n/en.ts";
import zh from "../../src/i18n/zh.ts";
import { mdEnOutput, mdOriginal } from "../fixtures/markdown-resume.ts";
import { ORIGINAL_EN, apiOutput, crossZhOutput, emptyOutput, redOutput, validOutput } from "../fixtures/tailor-flow.ts";
import { leafValues } from "./dict-helpers.ts";
import { FAQ } from "./info-pages-fixtures.ts";
import { TXT, activate, control, generateBtn, generateResult, goNext, main, mainText, norm, openEditor, renderApp, resetStores, resultView, scriptedApi, startFlow } from "./flow-helpers.tsx";
import type { L } from "./flow-helpers.tsx";

const REASON = { en: "Resolve the items in red first", zh: "请先处理标红的内容" } as const;
const PRINT_NOTICE = "请先处理红色项再导出 / Deal with the red items before exporting";
const NAME = { en: { pdf: "Save as PDF", md: "Download Markdown" }, zh: { pdf: "另存为 PDF", md: "下载 Markdown" } } as const;

// ---------------------------------------------------------------- stubs
const created: { blob: Blob; url: string }[] = [];
const revoked: string[] = [];
const clicks: { download: string; href: string }[] = [];
const urlKeys = ["createObjectURL", "revokeObjectURL"] as const;

function stubDownload() {
  created.length = 0;
  revoked.length = 0;
  clicks.length = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn((blob: Blob) => {
      const url = `blob:test/${created.length + 1}`;
      created.push({ blob, url });
      return url;
    }),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn((u: string) => void revoked.push(u)) });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push({ download: this.download, href: this.href });
  });
}
const readBlob = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(fr.error);
    fr.readAsText(b);
  });

beforeEach(() => resetStores());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const k of urlKeys) Reflect.deleteProperty(URL, k);
  resetStores();
});

const toolbar = () => screen.getByTestId("tailor-toolbar");
const pdfBtn = (ui: L, root: HTMLElement = main()) => within(root).getByRole("button", { name: TXT[ui].exportPdf }) as HTMLButtonElement;
const mdBtn = (ui: L, root: HTMLElement = main()) => within(root).getByRole("button", { name: TXT[ui].exportMd }) as HTMLButtonElement;
const card = (id: string) => Array.from(document.querySelectorAll<HTMLElement>("[data-finding-id]")).find((e) => e.dataset.findingId === id) as HTMLElement;
const reasonOf = (b: HTMLElement): string => {
  const described = (b.getAttribute("aria-describedby") ?? "").split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "");
  return norm([b.getAttribute("title"), b.getAttribute("aria-description"), b.getAttribute("aria-label"), ...described, toolbar().textContent].join(" "));
};

/** Generate with the output language picked on step 3 (the radio is named after the language). */
async function generateIn(ui: L, out: Parameters<typeof apiOutput>[0], original: string, outLang: "English" | "中文") {
  scriptedApi([() => apiOutput(out)]);
  startFlow(ui, { original, stopAt: 3 });
  activate(control(outLang));
  goNext();
  fireEvent.click(generateBtn(ui));
  await resultView();
}

for (const ui of ["en", "zh"] as const) {
  const t = NAME[ui];

  describe(`criterion 3: Download Markdown, UI ${ui}`, () => {
    it("the buttons carry the new labels in the toolbar", async () => {
      await generateResult(ui, validOutput());
      expect(within(toolbar()).getByRole("button", { name: t.pdf })).toBeTruthy();
      expect(within(toolbar()).getByRole("button", { name: t.md })).toBeTruthy();
    });

    it("creates a text/markdown;charset=utf-8 Blob, downloads it, then revokes the object URL", async () => {
      stubDownload();
      await generateResult(ui, validOutput());
      fireEvent.click(mdBtn(ui));
      expect(created).toHaveLength(1);
      expect(created[0]!.blob.type).toBe("text/markdown;charset=utf-8");
      expect(clicks).toHaveLength(1);
      expect(clicks[0]!.download).toBe(`resume-${ui}.md`);
      expect(clicks[0]!.href).toBe(created[0]!.url);
      await waitFor(() => expect(revoked).toEqual([created[0]!.url]));
      const text = await readBlob(created[0]!.blob);
      expect(text.startsWith("# ")).toBe(true);
      expect(text).toContain(ui === "en" ? "## Experience" : "## 工作经历");
    });

    it("the file name follows the output language, not the page language", async () => {
      stubDownload();
      const other = ui === "en" ? "中文" : "English";
      if (ui === "en") await generateIn(ui, crossZhOutput(), ORIGINAL_EN, other);
      else await generateIn(ui, mdEnOutput(), mdOriginal, other);
      expect(factCheck(ui === "en" ? ORIGINAL_EN : mdOriginal, ui === "en" ? crossZhOutput() : mdEnOutput(), { outputLang: ui === "en" ? "zh" : "en" }).filter((f) => f.level === "red")).toEqual([]);
      fireEvent.click(mdBtn(ui));
      expect(clicks.map((c) => c.download)).toEqual([ui === "en" ? "resume-zh.md" : "resume-en.md"]);
      const text = await readBlob(created[0]!.blob);
      expect(text).toContain(ui === "en" ? "## 工作经历" : "## Experience");
    });

    it("the Markdown holds what the preview shows: the edit decisions apply (a removed red text is not in the file)", async () => {
      stubDownload();
      const out = redOutput();
      const red = factCheck(ORIGINAL_EN, out, { outputLang: "en" }).find((f) => f.level === "red")!;
      await generateResult(ui, out);
      fireEvent.click(within(card(red.id)).getByRole("button", { name: TXT[ui].remove }));
      fireEvent.click(mdBtn(ui));
      const text = await readBlob(created[0]!.blob);
      expect(text).not.toContain("30%");
    });
  });

  describe(`criterion 4: Save as PDF, UI ${ui}`, () => {
    it("calls window.print() exactly once and creates no download", async () => {
      stubDownload();
      const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
      await generateResult(ui, validOutput());
      expect(print).not.toHaveBeenCalled();
      fireEvent.click(pdfBtn(ui));
      expect(print).toHaveBeenCalledTimes(1);
      expect(created).toHaveLength(0);
    });
  });

  describe(`criterion 5: the gate, UI ${ui}`, () => {
    it("both buttons are disabled while a red item is open, with the reason; they enable when it is handled", async () => {
      const out = redOutput();
      const findings = factCheck(ORIGINAL_EN, out, { outputLang: "en" });
      const red = findings.find((f) => f.level === "red")!;
      await generateResult(ui, out);
      for (const b of [pdfBtn(ui), mdBtn(ui)]) {
        expect(b.disabled).toBe(true);
        expect(reasonOf(b)).toContain(REASON[ui]);
      }
      fireEvent.click(within(card(red.id)).getByRole("button", { name: TXT[ui].keep }));
      await waitFor(() => expect(pdfBtn(ui).disabled).toBe(false));
      expect(mdBtn(ui).disabled).toBe(false);
      expect(toolbar().textContent).not.toContain(REASON[ui]);
    });

    it("removing the red text also enables export; Undo closes the gate again", async () => {
      const out = redOutput();
      const red = factCheck(ORIGINAL_EN, out, { outputLang: "en" }).find((f) => f.level === "red")!;
      await generateResult(ui, out);
      fireEvent.click(within(card(red.id)).getByRole("button", { name: TXT[ui].remove }));
      expect(pdfBtn(ui).disabled).toBe(false);
      fireEvent.click(within(card(red.id)).getByRole("button", { name: ui === "en" ? "Undo" : "撤销" }));
      expect(pdfBtn(ui).disabled).toBe(true);
      expect(mdBtn(ui).disabled).toBe(true);
    });

    it("a disabled button does nothing when clicked: no print, no download", async () => {
      stubDownload();
      const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
      await generateResult(ui, redOutput());
      fireEvent.click(pdfBtn(ui));
      fireEvent.click(mdBtn(ui));
      expect(print).not.toHaveBeenCalled();
      expect(created).toHaveLength(0);
    });

    it("amber items do not block export", async () => {
      await generateIn(ui, mdEnOutput(), mdOriginal, "English");
      expect(pdfBtn(ui).disabled).toBe(false);
      expect(mdBtn(ui).disabled).toBe(false);
    });

    it("the old 'coming soon' hint is gone", async () => {
      await generateResult(ui, redOutput());
      expect(mainText()).not.toContain("Export coming soon");
      expect(mainText()).not.toContain("导出即将上线");
    });
  });

  describe(`criterion 10 (unit): the print notice while red items are open, UI ${ui}`, () => {
    const notices = () => Array.from(document.querySelectorAll<HTMLElement>("body *")).filter((e) => e.children.length === 0 && norm(e.textContent ?? "") === PRINT_NOTICE);
    it("is in the page while a red item is open, outside the print root, and gone when none is open", async () => {
      const out = redOutput();
      const red = factCheck(ORIGINAL_EN, out, { outputLang: "en" }).find((f) => f.level === "red")!;
      await generateResult(ui, out);
      expect(notices()).toHaveLength(1);
      expect(notices()[0]!.closest("[data-print-root]")).toBeNull();
      expect(document.querySelectorAll("[data-print-root]").length).toBeGreaterThanOrEqual(1);
      fireEvent.click(within(card(red.id)).getByRole("button", { name: TXT[ui].keep }));
      await waitFor(() => expect(notices()).toHaveLength(0));
    });
    it("is not in the page for a faithful result", async () => {
      await generateResult(ui, validOutput());
      expect(notices()).toHaveLength(0);
    });
  });
}

describe("criterion 7: the base resume (no tailoring) exports without a gate", () => {
  for (const ui of ["en", "zh"] as const) {
    it(`UI ${ui}: in the editor both buttons are enabled with no reason, Save as PDF prints once and Markdown downloads`, async () => {
      stubDownload();
      const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
      await openEditor(ui);
      const ed = main();
      const pdf = pdfBtn(ui, ed);
      const md = mdBtn(ui, ed);
      expect(pdf.disabled).toBe(false);
      expect(md.disabled).toBe(false);
      expect(norm(ed.textContent ?? "")).not.toContain(REASON[ui]);
      fireEvent.click(pdf);
      expect(print).toHaveBeenCalledTimes(1);
      fireEvent.click(md);
      expect(created).toHaveLength(1);
      expect(created[0]!.blob.type).toBe("text/markdown;charset=utf-8");
      expect(clicks[0]!.download).toBe(`resume-${ui}.md`);
    });
  }
  it("an empty-output result still opens an editor whose export has no red-item notice", async () => {
    await generateResult("en", emptyOutput(), { original: "Sam Sample", jd: "Any job" });
    expect(document.body.textContent).not.toContain("Deal with the red items before exporting");
  });
});

describe("criterion 9: new strings in both dictionaries", () => {
  const all = (d: unknown) => leafValues(d).map(norm);
  it("English has the labels, the reason and the print notice; the old hint is gone", () => {
    const v = all(en);
    for (const s of ["Save as PDF", "Download Markdown", REASON.en, "Deal with the red items before exporting"]) expect(v.some((x) => x.includes(s)), s).toBe(true);
    expect(v.some((x) => x.includes("Export coming soon"))).toBe(false);
  });
  it("Chinese has the labels, the reason and the print notice; the old hint is gone", () => {
    const v = all(zh);
    for (const s of ["另存为 PDF", "下载 Markdown", REASON.zh, "请先处理红色项再导出"]) expect(v.some((x) => x.includes(s)), s).toBe(true);
    expect(v.some((x) => x.includes("导出即将上线"))).toBe(false);
  });
  it("the print notice line carries both languages exactly as the brief words it", () => {
    const v = [...all(en), ...all(zh)];
    expect(v.some((x) => x.includes(PRINT_NOTICE)) || (v.some((x) => x.includes("请先处理红色项再导出")) && v.some((x) => x.includes("Deal with the red items before exporting")))).toBe(true);
  });
});

describe("criterion 11: FAQ 11 describes what ships (PDF through the print dialog, Markdown download)", () => {
  const faq11 = FAQ[10]!;
  it("the fixture is the PDF and Markdown answer", () => {
    expect(faq11.enQ).toBe("What can I export?");
  });
  for (const [lang, d] of [["en", en], ["zh", zh]] as const) {
    it(`${lang}: the dictionary answer matches the fixture and names both formats`, () => {
      const a = (d as unknown as Record<string, string>)["faq.11.a"]!;
      expect(norm(a)).toBe(norm(lang === "en" ? faq11.enA : faq11.zhA));
      expect(a).toMatch(/PDF/);
      expect(a).toMatch(/Markdown/);
      expect(a).toMatch(lang === "en" ? /print dialog/i : /打印/);
      expect(a).toMatch(lang === "en" ? /\.md/ : /\.md/);
    });
    it(`${lang}: the FAQ page shows it`, () => {
      renderApp(lang, "#/faq");
      expect(norm(screen.getByRole("main").textContent ?? "")).toContain(norm(lang === "en" ? faq11.enA : faq11.zhA));
    });
  }
});

describe("print.css and its wiring", () => {
  const css = () => readFileSync(join(process.cwd(), "src", "styles", "print.css"), "utf8");
  it("src/styles/print.css hides everything but [data-print-root] in @media print and sets @page { size: A4; margin: 0 }", () => {
    const s = css();
    expect(s).toMatch(/@page\s*\{[^}]*size:\s*A4\s*;[^}]*margin:\s*0\s*;?[^}]*\}/);
    expect(s).toMatch(/@media\s+print/);
    expect(s).toContain("data-print-root");
  });
  it("the stylesheet is imported by the app code (outside src/templates)", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    const files = walk(join(process.cwd(), "src")).filter((p) => /\.(tsx?|css)$/.test(p) && !p.includes(join("src", "templates")));
    const hit = files.filter((p) => /styles\/print\.css|\.\/print\.css/.test(readFileSync(p, "utf8")));
    expect(hit, "a file that imports styles/print.css").not.toEqual([]);
  });
  it("a result page carries exactly one print root", async () => {
    await generateResult("en", validOutput());
    expect(document.querySelectorAll("[data-print-root]")).toHaveLength(1);
  });
});
