import { expect, test } from "@playwright/test";

const PAGES = [
  { hash: "#/how-it-works", name: "how-it-works", h1: { en: "How it works", zh: "工作原理" } },
  { hash: "#/faq", name: "faq", h1: { en: "FAQ", zh: "常见问题" } },
  { hash: "#/contact", name: "contact", h1: { en: "Contact us", zh: "联系我们" } },
  { hash: "#/privacy", name: "privacy", h1: { en: "Privacy", zh: "隐私" } },
];

for (const lang of ["en", "zh"] as const) {
  test.describe(`info pages ${lang}`, () => {
    test.use({ locale: lang === "zh" ? "zh-CN" : "en-US" });
    for (const p of PAGES) {
      test(`${p.hash} opens directly with its h1, no foreign requests`, async ({ page, baseURL }) => {
        const urls: string[] = [];
        page.on("request", (q) => urls.push(q.url()));
        await page.goto(`/${p.hash}`);
        const h1 = page.getByRole("heading", { level: 1 });
        await expect(h1).toHaveCount(1);
        await expect(h1).toContainText(p.h1[lang]);
        await page.screenshot({ path: `test-results/info-${p.name}-${lang}.png`, fullPage: true });
        const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
        for (const u of urls) {
          if (u.startsWith("data:") || u.startsWith("blob:")) continue;
          expect(u.startsWith(origin)).toBe(true);
        }
      });
      test(`${p.hash} has no horizontal scroll at 360px`, async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 740 });
        await page.goto(`/${p.hash}`);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(p.h1[lang]);
        const w = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(w).toBeLessThanOrEqual(360);
      });
    }
  });
}
