/* eslint-disable @typescript-eslint/no-non-null-assertion */
// resume-sg#44 criteria 1, 2, 3 (unit).
//  1: #/templates and #/sections start with the output language of the site language.
//  2, 3: an extras section with an empty or whitespace heading gets "其他" (zh) / "Other" (en) from the template's
//        own section names, so it follows the resume language, not the site language.
//        Print renders the same units as the screen (data-print-root is the same root), so the DOM check covers both;
//        the print media check is in tests/e2e/templates-polish.spec.ts.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/App.tsx";
import { emptyResume } from "../../src/resume/model.ts";
import type { Resume } from "../../src/resume/model.ts";
import { TEMPLATES } from "../../src/templates/index.ts";
import { HEAVY } from "../fixtures/heavy-sample.ts";
import { REFERENCE } from "../fixtures/reference-sample.ts";

type L = "en" | "zh";
const TAG = { en: "en-US", zh: "zh-CN" } as const;
const OTHER = { en: "Other", zh: "其他" } as const;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = "";
});

const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function open(hash: string, lang: L) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(TAG[lang]);
  window.location.hash = hash;
  return render(<App />);
}
const EN = /^(english|英文|英语)$/i;
const ZH = /^中文$/;
// the page has two radio groups (template, output language); the output language one holds the 中文 radio
const outputSwitch = () => {
  const g = within(screen.getByRole("main"))
    .getAllByRole("radiogroup")
    .find((x) => within(x).queryAllByRole("radio", { name: ZH }).length > 0);
  if (!g) throw new Error("no output language switch with a 中文 radio");
  return g;
};
const radioFor = (l: L) => within(outputSwitch()).getByRole("radio", { name: l === "zh" ? ZH : EN }) as HTMLElement;
const siteButton = () =>
  within(screen.getAllByRole("banner")[0] as HTMLElement).getByText(/^(中文|EN)$/).closest("button") as HTMLButtonElement;
const sample = (hash: string, lang: L) => (hash === "#/sections" ? HEAVY[lang] : REFERENCE[lang]);
const root = () => document.querySelector<HTMLElement>("[data-template]")!;

describe("criterion 1: output language starts in the site language", () => {
  for (const hash of ["#/templates", "#/sections"]) {
    for (const lang of ["en", "zh"] as const) {
      const other: L = lang === "zh" ? "en" : "zh";

      it(`${hash}, site ${lang}: the ${lang === "zh" ? "中文" : "English"} output is selected and the sample is in it`, () => {
        open(hash, lang);
        expect(radioFor(lang).getAttribute("aria-checked")).toBe("true");
        expect(radioFor(other).getAttribute("aria-checked")).toBe("false");
        expect(root().textContent).toContain(sample(hash, lang).basics.name);
        expect(root().textContent).not.toContain(sample(hash, other).basics.name);
      });

      it(`${hash}, site ${lang}: the page's own switch still works, and a site language change switches the sample`, () => {
        open(hash, lang);
        fireEvent.click(radioFor(other));
        expect(radioFor(other).getAttribute("aria-checked")).toBe("true");
        expect(root().textContent).toContain(sample(hash, other).basics.name);
        fireEvent.click(radioFor(lang));
        expect(root().textContent).toContain(sample(hash, lang).basics.name);
        fireEvent.click(siteButton()); // the site language becomes `other`
        expect(radioFor(other).getAttribute("aria-checked")).toBe("true");
        expect(root().textContent).toContain(sample(hash, other).basics.name);
      });
    }
  }
});

function renderT(id: string, resume: Resume, lang: L): HTMLElement {
  const entry = TEMPLATES.find((t) => t.id === id)!;
  const C = entry.component as ComponentType<{ resume: Resume; lang: L }>;
  const { container } = render(<C resume={resume} lang={lang} />);
  return container.querySelector<HTMLElement>("[data-template]")!;
}
const withExtras = (extras: Resume["extras"]): Resume => ({
  ...emptyResume(),
  basics: { ...emptyResume().basics, name: "Sam Sample" },
  summary: "A short summary.",
  extras,
});
const h2s = (r: HTMLElement) => within(r).queryAllByRole("heading", { level: 2 });

describe.each(["classic", "modern"])("criteria 2 and 3: an untitled extras section in %s", (id) => {
  for (const lang of ["en", "zh"] as const) {
    for (const [label, heading] of [
      ["empty", ""],
      ["whitespace only", "   "],
      ["tab and newline", "\t\n "],
    ] as const) {
      it(`${lang}: a ${label} heading is rendered as "${OTHER[lang]}", an h2 styled like the other headings, with its items`, () => {
        vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");
        const r = renderT(id, withExtras([{ id: "x1", heading, items: ["Item one", "Item two"] }]), lang);
        const sec = r.querySelector<HTMLElement>('[data-section="extra"]');
        expect(sec, "the untitled extras section is rendered").not.toBeNull();
        const h = within(sec!).getByRole("heading", { level: 2 });
        expect(txt(h)).toBe(OTHER[lang]);
        expect(h.className).toBe(h2s(r)[0]!.className); // same class as the Summary heading
        expect(Array.from(sec!.querySelectorAll("li")).map(txt)).toEqual(["Item one", "Item two"]);
      });
    }

    it(`${lang}: a non-empty heading is unchanged; an untitled section without items stays hidden`, () => {
      const r = renderT(
        id,
        withExtras([
          { id: "x1", heading: "  Awards ", items: ["A prize"] },
          { id: "x2", heading: "", items: [] },
          { id: "x3", heading: "  ", items: ["", " "] },
        ]),
        lang,
      );
      const names = h2s(r).map(txt);
      expect(names).toContain("Awards");
      expect(names).not.toContain(OTHER[lang]);
      expect(r.querySelectorAll('[data-section="extra"]')).toHaveLength(1);
    });

    it(`${lang}: titled and untitled extras keep their order`, () => {
      const r = renderT(
        id,
        withExtras([
          { id: "x1", heading: "Awards", items: ["A prize"] },
          { id: "x2", heading: "", items: ["Something else"] },
        ]),
        lang,
      );
      const extra = Array.from(r.querySelectorAll<HTMLElement>('[data-section="extra"]')).map((s) => txt(s.querySelector("h2")));
      expect(extra).toEqual(["Awards", OTHER[lang]]);
    });
  }

  it("criterion 3: the resume language decides, not the site language (site en + resume zh, site zh + resume en)", () => {
    for (const [site, resume] of [
      ["en", "zh"],
      ["zh", "en"],
    ] as const) {
      vi.spyOn(window.navigator, "language", "get").mockReturnValue(TAG[site]);
      const r = renderT(id, withExtras([{ id: "x1", heading: "", items: ["Item"] }]), resume);
      expect(txt(r.querySelector('[data-section="extra"] h2'))).toBe(OTHER[resume]);
      cleanup();
    }
  });
});
