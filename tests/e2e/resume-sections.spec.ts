/* eslint-disable @typescript-eslint/no-non-null-assertion */
// resume-sg#29 criteria 4, 6, 7 in a browser. Route #/sections renders heavySample(lang) (tests/fixtures/heavy-sample.ts)
// with the same Classic/Modern and English/中文 controls as #/templates. DOM contract: see
// tests/unit/resume-sections-templates.test.tsx, plus: each page of the resume is one [data-page] element inside the
// [data-template] root (794 x 1123 px, stacked vertically, also in print media); footers are [data-part="footer"].
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

type Tpl = "classic" | "modern";
type L = "en" | "zh";

const TPL_NAME: Record<Tpl, RegExp> = { classic: /^classic$/i, modern: /^modern$/i };
const LANG_NAME: Record<L, RegExp> = { en: /^(english|en)$/i, zh: /^(中文|简体中文|chinese|zh)$/i };
const NAME: Record<L, string> = { en: "Jamie Lin", zh: "林嘉明" };
const ctl = (page: Page, name: RegExp): Locator =>
  page.getByRole("radio", { name }).or(page.getByRole("tab", { name })).or(page.getByRole("button", { name })).first();

async function show(page: Page, tpl: Tpl, lang: L, route = "/#/sections"): Promise<Locator> {
  await page.goto(route);
  await ctl(page, TPL_NAME[tpl]).click();
  await ctl(page, LANG_NAME[lang]).click();
  const root = page.locator(`[data-template="${tpl}"]`);
  await expect(root).toHaveCount(1);
  await expect(root).toContainText(NAME[lang]);
  return root;
}

/** Computed style of the first element matching `sel` inside the root. */
const style = (root: Locator, sel: string, props: string[], pseudo?: string) =>
  root.locator(sel).first().evaluate(
    (el, a) => {
      const cs = getComputedStyle(el, a.pseudo ?? null);
      return Object.fromEntries(a.props.map((p) => [p, cs.getPropertyValue(p)]));
    },
    { props, pseudo },
  );

const GREY_DATE = "rgb(110, 110, 115)";

test.describe("resume sections: visual levels (criterion 4)", () => {
  test.use({ locale: "en-US", viewport: { width: 1280, height: 1000 } });

  for (const tpl of ["classic", "modern"] as const) {
    for (const lang of ["en", "zh"] as const) {
      test(`${tpl} ${lang}: company > role > project levels differ in computed style`, async ({ page }) => {
        const root = await show(page, tpl, lang);

        const co = await style(root, '[data-level="company"] [data-part="company"]', ["font-size", "font-weight", "color"]);
        expect(co["font-size"]).toBe(tpl === "classic" ? "15px" : "14.6px");
        expect(co["font-weight"]).toBe("700");
        expect(co["color"]).toBe("rgb(29, 29, 31)");
        const loc = await style(root, '[data-level="company"] [data-part="location"]', ["font-size", "color", "margin-left"]);
        expect(loc["font-size"]).toBe("12px");
        expect(loc["color"]).toBe("rgb(142, 142, 147)");
        expect(loc["margin-left"]).toBe("10px");
        const cd = await style(root, '[data-level="company"] [data-part="dates"]', ["font-weight", "color", "white-space"]);
        expect(cd["font-weight"]).toBe("600");
        expect(cd["color"]).toBe("rgb(66, 66, 69)");
        expect(cd["white-space"]).toBe("nowrap");

        const role = await style(root, '[data-level="role"] [data-part="title"]', ["font-size", "font-weight", "color"]);
        expect(role["font-size"]).toBe("13.2px");
        expect(role["font-weight"]).toBe(tpl === "classic" ? "500" : "600");
        expect(role["color"]).toBe(tpl === "classic" ? "rgb(72, 72, 74)" : "rgb(10, 110, 138)");
        const rd = await style(root, '[data-level="role"] [data-part="dates"]', ["font-size", "color"]);
        expect(rd["font-size"]).toBe("11.8px");
        expect(rd["color"]).toBe(GREY_DATE);
        const dash = await style(root, '[data-level="role"] [data-part="title"]', ["content", "width", "height", "background-color"], "::before");
        if (tpl === "classic") {
          expect(dash["content"]).not.toBe("none");
          expect(dash["width"]).toBe("8px");
          expect(dash["height"]).toBe("1.5px");
          expect(dash["background-color"]).toBe(GREY_DATE);
        }

        const tag = await style(root, '[data-level="project"] [data-part="tag"]', ["font-size", "font-weight", "background-color", "color", "border-top-left-radius"]);
        expect(tag["font-size"]).toBe("10.5px");
        expect(tag["font-weight"]).toBe("600");
        expect(tag["border-top-left-radius"]).toBe("4px");
        expect(tag["background-color"]).toBe(tpl === "classic" ? "rgb(236, 236, 240)" : "rgb(10, 110, 138)");
        expect(tag["color"]).toBe(tpl === "classic" ? "rgb(58, 58, 60)" : "rgb(255, 255, 255)");
        const pn = await style(root, '[data-level="project"] [data-part="name"]', ["font-size", "font-weight"]);
        expect(pn["font-size"]).toBe("12.8px");
        expect(pn["font-weight"]).toBe("600");
        const pd = await style(root, '[data-level="project"] [data-part="dates"]', ["font-size"]);
        expect(pd["font-size"]).toBe("11.5px");
        const nest = await style(root, "[data-nest]", ["border-left-width", "border-left-style", "border-left-color", "margin-left", "padding-left"]);
        expect(nest["border-left-width"]).toBe("2px");
        expect(nest["border-left-style"]).toBe("solid");
        expect(nest["border-left-color"]).toBe(tpl === "classic" ? "rgb(227, 227, 232)" : "rgb(191, 224, 232)");
        expect(nest["margin-left"]).toBe("14px");
        expect(nest["padding-left"]).toBe("12px");
        // the project's bullets stay inside the rule
        const inside = await root.locator("[data-nest]").first().evaluate((n) => n.querySelectorAll("li").length);
        expect(inside).toBeGreaterThanOrEqual(2);

        const pj = await style(root, '[data-level="project-standalone"] [data-part="name"]', ["font-size", "font-weight"]);
        expect(pj["font-size"]).toBe("14px");
        expect(pj["font-weight"]).toBe("700");
        const meta = await style(root, '[data-level="project-standalone"] [data-part="meta"]', ["font-size", "color", "margin-left"]);
        expect(meta["font-size"]).toBe("12.3px");
        expect(meta["color"]).toBe(GREY_DATE);
        expect(meta["margin-left"]).toBe("10px");
        const tl = await style(root, '[data-part="tech"] [data-part="tech-label"]', ["font-size", "color"]);
        expect(tl["font-size"]).toBe("11.5px");
        expect(tl["color"]).toBe(GREY_DATE);
        const tk = await style(root, '[data-part="tech"] [data-part="tech-tag"]', ["font-size", "background-color", "color", "border-top-left-radius"]);
        expect(tk["font-size"]).toBe("11.3px");
        expect(tk["border-top-left-radius"]).toBe("4px");
        expect(tk["background-color"]).toBe(tpl === "classic" ? "rgb(242, 242, 245)" : "rgb(238, 246, 248)");
        expect(tk["color"]).toBe(tpl === "classic" ? "rgb(66, 66, 69)" : "rgb(11, 85, 104)");

        const school = await style(root, '[data-level="education"] [data-part="school"]', ["font-size", "font-weight"]);
        expect(school["font-size"]).toBe("14px");
        expect(school["font-weight"]).toBe("700");
        const deg = await style(root, '[data-level="education"] [data-part="degree"]', ["font-size", "color", "margin-left"]);
        expect(deg["font-size"]).toBe("13px");
        expect(deg["color"]).toBe("rgb(66, 66, 69)");
        expect(deg["margin-left"]).toBe("10px");
        const det = await style(root, '[data-part="details"]', ["color"]);
        expect(det["color"]).toBe("rgb(81, 81, 84)");
      });
    }
  }

  test("Classic stays monochrome: no accent colour anywhere; Modern uses it on role titles and the project tag", async ({ page }) => {
    const accentHits = (root: Locator) =>
      root.evaluate((el) => {
        const hits: string[] = [];
        for (const e of [el, ...Array.from(el.querySelectorAll("*"))]) {
          const s = getComputedStyle(e);
          for (const p of ["color", "background-color", "border-left-color", "border-bottom-color"])
            if (s.getPropertyValue(p).replace(/\s/g, "") === "rgb(10,110,138)") hits.push(`${(e as HTMLElement).dataset.part ?? e.tagName}`);
        }
        return hits;
      });
    expect(await accentHits(await show(page, "classic", "en"))).toEqual([]);
    const modern = await accentHits(await show(page, "modern", "en"));
    expect(modern).toContain("title");
    expect(modern).toContain("tag");
  });
});

/** Runs in the page: per [data-page], the last and first text-bearing blocks. */
function analyse() {
  const root = document.querySelector("[data-template]")!;
  const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-page]"));
  const hasOwnText = (e: Element) => Array.from(e.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
  const content = (p: Element) =>
    Array.from(p.querySelectorAll("*")).filter((e) => hasOwnText(e) && !e.closest('[data-part="footer"]')) as HTMLElement[];
  const strandedSel = 'h2, [data-level], [data-part="tech"]';
  return pages.map((p, i) => {
    const els = content(p);
    const last = els[els.length - 1];
    const first = els[0];
    const li = first?.closest("li") ?? null;
    const list = li?.parentElement ?? null;
    const lis = list ? Array.from(list.children).filter((c) => c.tagName === "LI") : [];
    const pr = p.getBoundingClientRect();
    return {
      index: i,
      lastStranded: last ? (last.closest(strandedSel)?.outerHTML.slice(0, 80) ?? null) : null,
      loneLastBullet: i > 0 && !!li && lis.length >= 2 && lis[lis.length - 1] === li,
      clipped: els.filter((e) => e.getBoundingClientRect().bottom > pr.bottom + 1).map((e) => (e.textContent ?? "").slice(0, 40)),
      height: Math.round(pr.height),
      width: Math.round(pr.width),
      text: (p.textContent ?? ""),
    };
  });
}

test.describe("resume sections: layout rules in print media (criteria 6 and 7)", () => {
  test.use({ locale: "en-US", viewport: { width: 1280, height: 1000 } });

  for (const tpl of ["classic", "modern"] as const) {
    for (const lang of ["en", "zh"] as const) {
      test(`${tpl} ${lang}: no stranded heading, entry line or lone last bullet; at most 2 pages; footer; dates`, async ({ page }) => {
        const root = await show(page, tpl, lang);

        // screenshots (screen media), one per page, for the owner and the reviewer
        const screenPages = root.locator("[data-page]");
        const n = await screenPages.count();
        expect(n).toBeGreaterThanOrEqual(1);
        for (let i = 0; i < n; i++) await screenPages.nth(i).screenshot({ path: `test-results/sections-${tpl}-${lang}-p${i + 1}.png` });

        await page.emulateMedia({ media: "print" });
        const pages = await page.evaluate(analyse);
        expect(pages.length, "at most 2 pages").toBeLessThanOrEqual(2);
        expect(pages.length).toBeGreaterThanOrEqual(1);
        for (const p of pages) {
          expect(p.width).toBe(794);
          expect(p.height).toBe(1123);
          expect(p.clipped, `page ${p.index + 1}: text cut off`).toEqual([]);
          expect(p.lastStranded, `page ${p.index + 1} ends with a heading or an entry line`).toBeNull();
          expect(p.loneLastBullet, `page ${p.index + 1} starts with the lone last bullet of an entry`).toBe(false);
        }
        const pdf = await page.pdf({ preferCSSPageSize: true });
        const pdfPages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
        expect(pdfPages).toBeLessThanOrEqual(2);
        expect(pdfPages).toBe(pages.length);

        // footer "name · n/N" on two-page resumes; none on one page; header not repeated on page 2
        const footers = await page.locator('[data-template] [data-part="footer"]').allTextContents();
        if (pages.length === 2) {
          expect(footers.map((f) => f.replace(/\s+/g, " ").trim())).toEqual([`${NAME[lang]} · 1/2`, `${NAME[lang]} · 2/2`]);
          expect(pages[1]!.text).not.toContain("jamie.lin@example.com");
          expect(pages[1]!.text).not.toContain(lang === "en" ? "Senior Backend Engineer · Payments" : "高级后端工程师 · 支付与清算");
        } else {
          expect(footers).toEqual([]);
        }
        expect(await page.locator("[data-template] h1, [data-template] header").count()).toBeLessThanOrEqual(1);

        // dates never wrap or shrink
        const bad = await page.evaluate(() => {
          const out: string[] = [];
          const all = Array.from(document.querySelectorAll<HTMLElement>('[data-template] [data-part="dates"]'));
          for (const d of all) {
            const cs = getComputedStyle(d);
            const r = document.createRange();
            r.selectNodeContents(d);
            const natural = r.getBoundingClientRect().width;
            const box = d.getBoundingClientRect();
            if (cs.whiteSpace !== "nowrap") out.push(`white-space ${d.textContent}`);
            if (d.getClientRects().length !== 1) out.push(`line boxes ${d.textContent}`);
            if (box.width < natural - 0.5) out.push(`shrunk ${d.textContent}`);
            if (box.height > parseFloat(cs.lineHeight === "normal" ? `${parseFloat(cs.fontSize) * 1.6}` : cs.lineHeight) * 1.5) out.push(`tall ${d.textContent}`);
          }
          return { count: all.length, out };
        });
        expect(bad.count).toBeGreaterThan(10);
        expect(bad.out).toEqual([]);
      });
    }
  }

  for (const tpl of ["classic", "modern"] as const) {
    test(`${tpl}: a very long company name wraps on the left; the dates stay on one line at the right`, async ({ page }) => {
      const root = await show(page, tpl, "en");
      await page.emulateMedia({ media: "print" });
      const before = await root.locator('[data-level="company"]').first().evaluate((row) => {
        const d = row.querySelector<HTMLElement>('[data-part="dates"]')!.getBoundingClientRect();
        return { width: d.width, right: d.right };
      });
      const after = await root.locator('[data-level="company"]').first().evaluate((row) => {
        const name = row.querySelector<HTMLElement>('[data-part="company"]')!;
        name.textContent = "Harborline International Payments and Settlement Infrastructure Holdings Group Limited (Asia Pacific Division)";
        const nr = name.getBoundingClientRect();
        const dEl = row.querySelector<HTMLElement>('[data-part="dates"]')!;
        const d = dEl.getBoundingClientRect();
        return {
          nameRects: name.getClientRects().length,
          nameBottom: nr.bottom,
          nameRight: nr.right,
          datesLeft: d.left,
          width: d.width,
          right: d.right,
          datesLines: dEl.getClientRects().length,
        };
      });
      expect(after.nameRects, "the long name wraps onto several lines").toBeGreaterThan(1);
      expect(after.nameRight).toBeLessThanOrEqual(after.datesLeft + 0.5);
      expect(after.width).toBeCloseTo(before.width, 0);
      expect(after.right).toBeCloseTo(before.right, 0);
      expect(after.datesLines).toBe(1);
    });

    test(`${tpl}: a one-page resume has no footer; #/templates reference sample`, async ({ page }) => {
      const root = await show(page, tpl, "en", "/#/templates");
      await page.emulateMedia({ media: "print" });
      const n = await root.locator("[data-page]").count();
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
      const footers = await root.locator('[data-part="footer"]').allTextContents();
      if (n === 1) expect(footers).toEqual([]);
      else expect(footers.map((f) => f.replace(/\s+/g, " ").trim())).toEqual(["Jamie Lin · 1/2", "Jamie Lin · 2/2"]);
    });
  }
});
