// resume-sg#25 criterion 7: keyboard, 360 px, and no request on choosing a model.
import { expect, test } from "@playwright/test";
import { walkToStep4 } from "./flow-helpers.ts";

const API = "https://api.anthropic.com/v1/messages";
const T = {
  en: { region: "AI settings", select: "Model", other: "Other (custom)", opus: "Claude Opus 5.5 (Best quality, higher cost)" },
  zh: { region: "AI 设置", select: "模型", other: "其他（自定义）", opus: "Claude Opus 5.5（质量最好，费用更高）" },
};

for (const lang of ["en", "zh"] as const) {
  test.describe(`model picker ${lang}`, () => {
    test.use({ locale: lang === "zh" ? "zh-CN" : "en-US" });

    test("criterion 7: reachable by Tab, named, no overflow at 360 px, choosing makes no request", async ({ page }) => {
      const c = T[lang];
      await page.setViewportSize({ width: 360, height: 740 });
      const apiHits: string[] = [];
      await page.route(API, (route) => {
        apiHits.push(route.request().method());
        return route.abort();
      });
      await page.goto("/#/app");
      await walkToStep4(page, "Sam Sample", "Any job"); // resume-sg#41: the key row is on step 4
      const region = page.getByRole("region", { name: c.region });
      const select = region.getByRole("combobox", { name: c.select, exact: true });
      await expect(select).toBeVisible();

      await region.getByLabel(lang === "en" ? "Anthropic API key" : "Anthropic API key（密钥）", { exact: true }).focus();
      let reached = false;
      for (let i = 0; i < 15 && !reached; i++) {
        await page.keyboard.press("Tab");
        reached = await select.evaluate((el) => el === document.activeElement);
      }
      expect(reached, "model select reachable with Tab").toBe(true);

      await select.selectOption({ label: c.opus });
      await select.selectOption({ label: c.other });
      await select.selectOption({ label: c.opus });
      expect(apiHits).toHaveLength(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
      await page.screenshot({ path: `test-results/model-picker-360-${lang}.png`, fullPage: true });

      await select.selectOption({ label: c.other });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
      await page.screenshot({ path: `test-results/model-picker-custom-360-${lang}.png`, fullPage: true });
    });
  });
}
