// resume-sg#54 criterion 2 (e2e): after "Delete all my data" nothing of the app is left in the browser, and the key
// is not in the markup. Fake key, synthetic resume.
// Hooks: the button "Delete all my data" / "删除我的所有数据" in the region "AI settings" / "AI 设置";
// its dialog (alertdialog or dialog) with data-testid="delete-all-confirm".
import { expect, test } from "@playwright/test";

const KEY = ["sk", "ant", "test", "e2e", "data", "controls", "0001"].join("-"); // fake
const RESUME = "Sam Sample, backend engineer. Built a billing service.";

for (const lang of ["en", "zh"] as const) {
  test.describe(`data controls, ${lang}`, () => {
    test.use({ locale: lang === "en" ? "en-US" : "zh-CN" });

    test("Delete all my data empties both stores, resets to step 1 and focuses the heading", async ({ page }) => {
      await page.goto("/#/app");
      await page.evaluate((k) => localStorage.setItem("jd2cv.apiKey", k), KEY); // a remembered key
      await page.reload();
      await page.getByLabel(/^(Your current resume|你的原始简历)/).fill(RESUME);
      await page.getByTestId("step-next").click();
      await page.getByLabel(/^(Job description|职位描述)/).fill("Any backend job");
      await page.getByTestId("step-next").click();
      await page.getByTestId("step-next").click();
      await expect.poll(() => page.evaluate(() => sessionStorage.getItem("jd2cv.session"))).not.toBeNull();

      const input = page.getByLabel(/^Anthropic API key/);
      await expect(input).toHaveValue(KEY);
      expect(await input.evaluate((e) => e.outerHTML)).not.toContain(KEY);
      expect(await page.content()).not.toContain(KEY);

      const region = page.getByRole("region", { name: /^(AI settings|AI 设置)$/ });
      const del = region.getByRole("button", { name: /^(Delete all my data|删除我的所有数据)$/ });
      await del.click();
      const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
      await expect(dialog).toBeVisible();
      await page.screenshot({ path: `test-results/data-controls-confirm-${lang}.png`, fullPage: true });
      await dialog.getByTestId("delete-all-confirm").click();

      await expect(page.getByTestId("step-heading")).toBeFocused();
      await expect(page.getByLabel(/^(Your current resume|你的原始简历)/)).toHaveValue("");
      expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("jd2cv")))).toEqual([]);
      expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("jd2cv")))).toEqual([]);
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
      await page.reload();
      await expect(page.getByLabel(/^(Your current resume|你的原始简历)/)).toHaveValue("");
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    });
  });
}
