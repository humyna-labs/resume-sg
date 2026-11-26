import { expect, test } from "@playwright/test";

test("home page renders its heading and title", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("resume-sg");
  await expect(page).toHaveTitle("JD2CV");
  await page.screenshot({ path: "test-results/home.png", fullPage: true });
  expect(errors).toEqual([]);
});
