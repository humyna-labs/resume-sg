import { expect, test } from "@playwright/test";

test("home page renders its heading", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("resume-sg");
  await page.screenshot({ path: "test-results/home.png", fullPage: true });
  expect(errors).toEqual([]);
});
