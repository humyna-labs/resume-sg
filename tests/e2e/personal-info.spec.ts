// resume-sg#14 criterion 9: nothing is stored or sent while the checks run; screenshot of the list.
import { expect, test } from "@playwright/test";

test.describe("personal-info checks e2e", () => {
  test.use({ locale: "en-US" });

  test("criterion 9: no storage, no cross-origin request, list screenshot", async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
    const urls: string[] = [];
    page.on("request", (q) => urls.push(q.url()));
    await page.goto("/#/app");
    const editor = page.getByTestId("resume-editor");
    await expect(page.getByTestId("personal-info-list")).toHaveCount(0);
    await editor.getByLabel(/^summary$/i).fill("Age: 32. Photo attached. NRIC S0000000Z. Married. Religion: none.");
    const list = page.getByTestId("personal-info-list");
    await expect(list).toBeVisible();
    await expect(list).toContainText("Before you send it");
    await expect(list.getByRole("listitem")).toHaveCount(5);
    await page.screenshot({ path: "test-results/personal-info.png", fullPage: true });

    const stores = await page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookie: document.cookie,
      idb: (await indexedDB.databases()).length,
    }));
    expect(stores).toEqual({ local: 0, session: 0, cookie: "", idb: 0 });
    for (const u of urls) {
      if (u.startsWith("data:") || u.startsWith("blob:")) continue;
      expect(new URL(u).origin, u).toBe(origin);
    }
    await list.getByRole("button", { name: /^ignore/i }).first().click();
    await expect(list.getByRole("listitem")).toHaveCount(4);
  });
});
