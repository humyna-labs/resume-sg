/* eslint-disable @typescript-eslint/no-non-null-assertion */
// resume-sg#13 criteria 3 to 7 in a browser, on #/templates (referenceSample).
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

type Tpl = "classic" | "modern";
type L = "en" | "zh";

const TPL_NAME: Record<Tpl, RegExp> = { classic: /^classic$/i, modern: /^modern$/i };
const LANG_NAME: Record<L, RegExp> = { en: /^(english|en)$/i, zh: /^(中文|简体中文|chinese|zh)$/i };

const ctl = (page: Page, name: RegExp): Locator =>
  page.getByRole("radio", { name }).or(page.getByRole("tab", { name })).or(page.getByRole("button", { name })).first();

async function show(page: Page, tpl: Tpl, lang: L): Promise<Locator> {
  await page.goto("/#/templates");
  await ctl(page, TPL_NAME[tpl]).click();
  await ctl(page, LANG_NAME[lang]).click();
  const root = page.locator(`[data-template="${tpl}"]`);
  await expect(root).toHaveCount(1);
  await expect(root).toContainText(lang === "en" ? "Jamie Lin" : "林嘉明");
  return root;
}

/** First element whose own text matches, searching headings first. */
const byText = (root: Locator, re: RegExp) => root.getByText(re).first();
const props = (loc: Locator, p: string[]) =>
  loc.evaluate((el, ps) => Object.fromEntries(ps.map((x) => [x, getComputedStyle(el).getPropertyValue(x)])), p);

test.describe("templates e2e", () => {
  test.use({ locale: "en-US", viewport: { width: 1280, height: 1000 } });

  test("criterion 3: Classic computed styles", async ({ page }) => {
    const root = await show(page, "classic", "en");
    const name = await props(root.getByText("Jamie Lin", { exact: true }).first(), ["font-size", "font-weight"]);
    expect(name["font-size"]).toBe("30px");
    expect(name["font-weight"]).toBe("700");

    const h = root.getByRole("heading", { name: /^summary$/i });
    const hs = await props(h, ["font-size", "text-transform", "border-bottom-width", "border-bottom-style", "border-bottom-color", "letter-spacing"]);
    expect(hs["font-size"]).toBe("12px");
    expect(hs["text-transform"]).toBe("uppercase");
    expect(hs["border-bottom-width"]).toBe("1px");
    expect(hs["border-bottom-style"]).toBe("solid");
    expect(hs["border-bottom-color"]).toBe("rgb(29, 29, 31)");
    const enSpacing = parseFloat(hs["letter-spacing"]!);

    await ctl(page, LANG_NAME.zh).click();
    const hz = await props(root.getByRole("heading", { name: "个人简介" }), ["letter-spacing", "text-transform"]);
    expect(parseFloat(hz["letter-spacing"]!)).toBeGreaterThan(enSpacing);
    expect(hz["text-transform"]).toBe("none");

    for (const l of ["en", "zh"] as const) {
      await ctl(page, LANG_NAME[l]).click();
      const accent = await root.evaluate((el) => {
        const hits: string[] = [];
        for (const e of [el, ...Array.from(el.querySelectorAll("*"))]) {
          const s = getComputedStyle(e);
          for (const p of ["color", "background-color", "border-top-color", "border-bottom-color", "border-left-color", "border-right-color"]) {
            if (s.getPropertyValue(p).replace(/\s/g, "") === "rgb(10,110,138)") hits.push(`${e.tagName}.${p}`);
          }
        }
        return hits;
      });
      expect(accent).toEqual([]);
    }
  });

  test("criterion 3: Modern computed styles", async ({ page }) => {
    const root = await show(page, "modern", "en");
    const header = root.locator("header").first();
    const hs = await props(header, ["background-color", "border-bottom-width", "border-bottom-color", "width"]);
    expect(hs["background-color"]).toBe("rgb(245, 245, 247)");
    expect(hs["border-bottom-width"]).toBe("3px");
    expect(hs["border-bottom-color"]).toBe("rgb(10, 110, 138)");
    expect(parseFloat(hs["width"]!)).toBeCloseTo(794, 0);

    const headline = await props(byText(root, /^Senior Backend Engineer · Payments$/), ["color"]);
    expect(headline["color"]).toBe("rgb(10, 110, 138)");

    const pill = byText(root, /^jamie\.lin@example\.com$/);
    const pc = await pill.evaluate((el) => {
      let e: HTMLElement | null = el as HTMLElement;
      // the pill may be the element itself or a parent; take the first with a radius
      while (e && parseFloat(getComputedStyle(e).borderTopLeftRadius) < 1) e = e.parentElement;
      return e ? parseFloat(getComputedStyle(e).borderTopLeftRadius) : 0;
    });
    expect(pc).toBeGreaterThanOrEqual(999);

    const chip = await pill.page().evaluate(() => {
      const root = document.querySelector("[data-template=modern]")!;
      const all = Array.from(root.querySelectorAll<HTMLElement>("*"));
      const java = all.filter((e) => e.children.length === 0 && e.textContent === "Java");
      return java.map((e) => getComputedStyle(e).backgroundColor);
    });
    expect(chip).toContain("rgb(238, 246, 248)");
  });

  for (const tpl of ["classic", "modern"] as const) {
    for (const lang of ["en", "zh"] as const) {
      test(`criterion 4: screenshot ${tpl} ${lang}`, async ({ page }) => {
        const root = await show(page, tpl, lang);
        const box = await root.boundingBox();
        expect(Math.round(box!.width)).toBe(794);
        expect(Math.round(box!.height)).toBeGreaterThanOrEqual(1123 - 1);
        await root.screenshot({ path: `test-results/template-${tpl}-${lang}.png` });
      });
    }
  }

  for (const tpl of ["classic", "modern"] as const) {
    test(`criterion 5: ${tpl} print media shows only the template root, A4, at most two pages`, async ({ page }) => {
      const root = await show(page, tpl, "en");
      await page.emulateMedia({ media: "print" });
      const stray = await root.evaluate((r) => {
        const out: string[] = [];
        for (const e of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
          if (r.contains(e) || e.contains(r)) continue;
          const s = getComputedStyle(e);
          const b = e.getBoundingClientRect();
          if (s.display !== "none" && s.visibility !== "hidden" && b.width * b.height > 0) out.push(e.tagName + "." + e.className);
        }
        return out;
      });
      expect(stray).toEqual([]);
      await expect(root).toBeVisible();

      if (tpl === "modern") {
        const p = await props(root.locator("header").first(), ["print-color-adjust", "background-color"]);
        expect(p["print-color-adjust"]).toBe("exact");
        expect(p["background-color"]).toBe("rgb(245, 245, 247)");
      }

      const pdf = await page.pdf({ preferCSSPageSize: true });
      const txt = pdf.toString("latin1");
      const m = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(txt);
      expect(m, "PDF has a MediaBox").not.toBeNull();
      expect(Math.abs(parseFloat(m![1]!) - 595)).toBeLessThanOrEqual(1);
      expect(Math.abs(parseFloat(m![2]!) - 842)).toBeLessThanOrEqual(1);
      const pages = (txt.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      expect(pages).toBeGreaterThanOrEqual(1);
      expect(pages).toBeLessThanOrEqual(2);
    });

    test(`criterion 6: ${tpl} keeps each role's title row with its first bullet; a 6x6 resume flows to page 2`, async ({ page }) => {
      const root = await show(page, tpl, "en");
      await page.emulateMedia({ media: "print" });
      const result = await root.evaluate(() => {
        const rootEl = document.querySelector("[data-template]")!;
        const lca = (a: Element, b: Element) => {
          let n: Element | null = a;
          while (n && !n.contains(b)) n = n.parentElement;
          return n!;
        };
        // exact text first, so "Software Engineer" is not found inside "Senior Software Engineer"; substring as fallback
        const leaf = (t: string) => {
          const all = Array.from(rootEl.querySelectorAll("*")).filter((e) => e.children.length === 0);
          return all.find((e) => (e.textContent ?? "").trim() === t) ?? all.find((e) => (e.textContent ?? "").includes(t))!;
        };
        const avoid = (e: Element) => ["avoid", "avoid-page"].includes(getComputedStyle(e).getPropertyValue("break-inside"));
        const wrappers = [
          ["Lead Backend Engineer", "Led the redesign"],
          ["Senior Software Engineer", "Designed the risk-rule"],
          ["Software Engineer", "Built reconciliation"],
        ].map(([title, bullet]) => {
          const t = leaf(title!);
          const b = leaf(bullet!);
          const w = lca(t, b);
          return { avoid: avoid(w), isRoot: w === rootEl };
        });

        // grow to 6 roles x 6 bullets by cloning the first role's block
        const first = leaf("Led the redesign").closest("li")!;
        const entry = (() => {
          let n: Element = leaf("Lead Backend Engineer");
          while (n.parentElement && !n.parentElement.textContent!.includes("Designed the risk-rule")) n = n.parentElement;
          return n;
        })();
        const list = first.parentElement!;
        for (let i = list.children.length; i < 6; i++) list.appendChild(first.cloneNode(true));
        for (let i = 0; i < 5; i++) entry.parentElement!.insertBefore(entry.cloneNode(true), entry.nextSibling);
        const lis = Array.from(rootEl.querySelectorAll("li"));
        for (const l of lis) if (l.parentElement && l.parentElement.children.length < 6 && l.closest("section")?.textContent?.includes("Led the redesign")) l.parentElement.appendChild(l.cloneNode(true));
        return { wrappers, height: rootEl.getBoundingClientRect().height };
      });
      for (const w of result.wrappers) {
        expect(w.isRoot).toBe(false);
        expect(w.avoid, "wrapper of title row plus first bullet has break-inside: avoid").toBe(true);
      }
      expect(result.height).toBeGreaterThan(1123); // long resume needs page 2
      const pdf = await page.pdf({ preferCSSPageSize: true });
      const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      expect(pages).toBeGreaterThanOrEqual(2);
    });

    test(`criterion 7: ${tpl} has no img, svg, canvas, background-image or fixed position; contact in the body`, async ({ page }) => {
      const root = await show(page, tpl, "en");
      const bad = await root.evaluate((r) => {
        const out: string[] = [];
        for (const e of [r, ...Array.from(r.querySelectorAll("*"))]) {
          const s = getComputedStyle(e);
          if (["IMG", "SVG", "CANVAS", "PICTURE"].includes(e.tagName.toUpperCase())) out.push(e.tagName);
          if (s.backgroundImage !== "none") out.push(`bg:${e.tagName}`);
          if (s.position === "fixed") out.push(`fixed:${e.tagName}`);
        }
        return out;
      });
      expect(bad).toEqual([]);
      const text = (await root.textContent()) ?? "";
      expect(text.indexOf("jamie.lin@example.com")).toBeGreaterThan(-1);
      expect(text.indexOf("jamie.lin@example.com")).toBeLessThan(text.search(/summary/i));
    });
  }
});
