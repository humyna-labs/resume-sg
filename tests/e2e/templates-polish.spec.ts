// resume-sg#44 criterion 4 (e2e): screenshots of #/templates and #/sections opened in Chinese, and of a resume with an
// untitled extras section in both templates, in test-results/. No request leaves the page origin (strict).
//
// The untitled-extras resume needs no AI call: the built app is served as usual, and the test rewrites the
// "Awards" / "获奖" heading of the heavy sample (#/sections) to an empty string in the JavaScript asset on its way to the
// page. Every request stays on the page origin; nothing is stubbed on api.anthropic.com.
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

type Tpl = "classic" | "modern";
type L = "en" | "zh";

const TPL_NAME: Record<Tpl, RegExp> = { classic: /^classic$/i, modern: /^modern$/i };
const ctl = (page: Page, name: RegExp): Locator =>
  page.getByRole("radio", { name }).or(page.getByRole("tab", { name })).or(page.getByRole("button", { name })).first();
const NAME: Record<L, string> = { en: "Jamie Lin", zh: "林嘉明" };
const OTHER: Record<L, string> = { en: "Other", zh: "其他" };
const AWARDS: Record<L, string> = { en: "Awards", zh: "获奖" };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Matches the string literal of `s` as written by a minifier: raw, or with \uXXXX escapes. */
const literal = (s: string): string => {
  const esc = Array.from(s)
    .map((c) => (c.charCodeAt(0) > 127 ? `\\\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}` : escapeRe(c)))
    .join("");
  return `(?:${escapeRe(s)}|${esc})`;
};

/** Serves the app with the Awards headings of the heavy sample emptied; returns how many were rewritten. */
async function blankAwards(page: Page): Promise<{ count: () => number }> {
  let hits = 0;
  await page.route(/\/assets\/[^/]+\.js(\?.*)?$/, async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    for (const l of ["en", "zh"] as const) {
      const re = new RegExp(`(heading\\s*:\\s*)(["'\`])${literal(AWARDS[l])}\\2`, "gi");
      body = body.replace(re, (_m, pre: string, q: string) => {
        hits++;
        return `${pre}${q}${q}`;
      });
    }
    await route.fulfill({ response: res, body });
  });
  return { count: () => hits };
}

function watch(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (q) => urls.push(q.url()));
  return urls;
}
function expectSameOrigin(urls: string[], baseURL: string | undefined) {
  const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
  expect(urls.length).toBeGreaterThan(0);
  for (const u of urls) expect(u.startsWith(origin), `request left the origin: ${u}`).toBe(true);
}

test.describe("opened in Chinese (site language zh)", () => {
  test.use({ locale: "zh-CN", viewport: { width: 1280, height: 1000 } });

  for (const route of ["templates", "sections"] as const) {
    test(`#/${route}: 中文 is selected at the start and the sample is Chinese; screenshot`, async ({ page, baseURL }) => {
      const urls = watch(page);
      await page.goto(`/#/${route}`);
      const root = page.locator("[data-template]");
      await expect(root).toHaveCount(1);
      await expect(root).toContainText(NAME.zh);
      await expect(root).not.toContainText(NAME.en);
      await expect(page.getByRole("radio", { name: /^中文$/ }).first()).toHaveAttribute("aria-checked", "true");
      await page.screenshot({ path: `test-results/templates-polish-${route}-zh.png`, fullPage: true });
      expectSameOrigin(urls, baseURL);
    });
  }
});

test.describe("opened in English (site language en)", () => {
  test.use({ locale: "en-US", viewport: { width: 1280, height: 1000 } });

  for (const route of ["templates", "sections"] as const) {
    test(`#/${route}: English is selected at the start and the sample is English`, async ({ page }) => {
      await page.goto(`/#/${route}`);
      const root = page.locator("[data-template]");
      await expect(root).toContainText(NAME.en);
      await expect(page.getByRole("radio", { name: /^english$/i }).first()).toHaveAttribute("aria-checked", "true");
    });
  }
});

test.describe("a resume with an untitled extras section", () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  for (const [locale, lang] of [["zh-CN", "zh"], ["en-US", "en"]] as const) {
    for (const tpl of ["classic", "modern"] as const) {
      test(`${tpl}, ${lang}: the untitled section is headed ${OTHER[lang]} on screen and in print; screenshot`, async ({ browser, baseURL }) => {
        const context = await browser.newContext({ locale, viewport: { width: 1280, height: 1000 } });
        const page = await context.newPage();
        const urls = watch(page);
        const patched = await blankAwards(page);
        await page.goto("/#/sections");
        expect(patched.count(), "the Awards heading was found in the built script and emptied").toBeGreaterThan(0);
        await ctl(page, TPL_NAME[tpl]).click();
        const root = page.locator(`[data-template="${tpl}"]`);
        await expect(root).toHaveCount(1);
        await expect(root).toContainText(NAME[lang]);

        const headings = (loc: Locator) => loc.locator('[data-section="extra"] h2').allTextContents();
        const shown = (await headings(root)).map((s) => s.trim());
        expect(shown[0]).toBe(OTHER[lang]); // Awards was the first extras section
        expect(shown).not.toContain(AWARDS[lang]);
        expect(shown.slice(1)).toHaveLength(3); // the three titled ones are unchanged

        // same level and style as another section heading
        const style = (el: Locator) =>
          el.evaluate((e) => {
            const c = getComputedStyle(e);
            return [c.fontSize, c.fontWeight, c.textTransform, c.letterSpacing, c.borderBottomWidth, c.color].join("|");
          });
        const other = root.locator('[data-section="extra"] h2').first();
        const titled = root.locator('[data-section="extra"] h2').nth(1);
        expect(await style(other)).toBe(await style(titled));

        await page.screenshot({ path: `test-results/templates-polish-untitled-extras-${tpl}-${lang}.png`, fullPage: true });

        await page.emulateMedia({ media: "print" });
        const printed = (await headings(page.locator(`[data-template="${tpl}"]`))).map((s) => s.trim());
        expect(printed[0]).toBe(OTHER[lang]);
        expect(await style(page.locator(`[data-template="${tpl}"] [data-section="extra"] h2`).first())).toBe(
          await style(page.locator(`[data-template="${tpl}"] [data-section="extra"] h2`).nth(1)),
        );

        expectSameOrigin(urls, baseURL);
        await context.close();
      });
    }
  }
});
