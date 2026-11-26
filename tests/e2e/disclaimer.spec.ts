import { expect, test } from "@playwright/test";

for (const lang of ["en", "zh"] as const) {
  const h1 = lang === "en" ? "Disclaimer" : "免责声明";
  test.describe(`disclaimer ${lang}`, () => {
    test.use({ locale: lang === "zh" ? "zh-CN" : "en-US" });

    test("opens directly and on reload, ten items, no foreign requests", async ({ page, baseURL }) => {
      const urls: string[] = [];
      page.on("request", (q) => urls.push(q.url()));
      await page.goto("/#/disclaimer");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
      await expect(page.locator("main ol > li")).toHaveCount(10);
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
      await expect(page.locator("main ol > li")).toHaveCount(10);
      const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
      for (const u of urls) {
        if (u.startsWith("data:") || u.startsWith("blob:")) continue;
        expect(u.startsWith(origin), u).toBe(true);
      }
    });

    test("no horizontal overflow at 360px", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto("/#/disclaimer");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    });

    for (const w of [1440, 390]) {
      test(`screenshot at ${w}px`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto("/#/disclaimer");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
        await page.screenshot({ path: `test-results/disclaimer-${w}-${lang}.png`, fullPage: true });
      });
    }

    test("footer link opens the disclaimer", async ({ page }) => {
      await page.goto("/#/faq");
      await page.getByRole("contentinfo").locator('a[href="#/disclaimer"]').first().click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
    });
  });
}
