/* eslint-disable @typescript-eslint/no-non-null-assertion */
// resume-sg#6 criteria 8 and 9: memory only, keyboard, 360 px, screenshots.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const loadExample = (page: Page) => page.getByRole("button", { name: /^load example$/i }).click();
const nameField = (page: Page) => page.getByTestId("resume-editor").getByLabel(/^name$/i);

test.describe("base resume e2e", () => {
  test.use({ locale: "en-US" });

  test("criterion 8: memory only, a reload starts empty, no cross-origin request", async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
    const urls: string[] = [];
    page.on("request", (q) => urls.push(q.url()));
    await page.goto("/#/app");
    await expect(page.getByTestId("resume-editor")).toBeVisible();
    await nameField(page).fill("Sam Sample");
    await page.getByRole("button", { name: /^add experience$/i }).click();
    await loadExample(page);
    await nameField(page).fill("Sam Sample");
    await expect(page.getByTestId("resume-preview")).toContainText("Sam Sample");

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

    await page.reload();
    await expect(page.getByTestId("resume-editor")).toBeVisible();
    await expect(nameField(page)).toHaveValue("");
    await expect(page.getByTestId("resume-preview")).not.toContainText("Sam Sample");
  });

  test("criterion 9: keyboard reaches every control, each has a name", async ({ page }) => {
    await page.goto("/#/app");
    await loadExample(page);
    const total = await page.evaluate(() => {
      const sel = "main input, main textarea, main select, main button, main a[href]";
      return Array.from(document.querySelectorAll<HTMLElement>(sel)).filter(
        (e) => !(e as HTMLInputElement).disabled && e.tabIndex >= 0 && e.getClientRects().length > 0,
      ).length;
    });
    expect(total).toBeGreaterThan(30);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const seen = new Set<string>();
    for (let i = 0; i < total + 60; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || !el.closest("main")) return null;
        const labelled = (el as HTMLInputElement).labels ? Array.from((el as HTMLInputElement).labels ?? []) : [];
        const name = (
          el.getAttribute("aria-label") ||
          labelled.map((l) => l.textContent).join(" ") ||
          el.textContent ||
          ""
        ).trim();
        const idx = Array.from(document.querySelectorAll("main *")).indexOf(el);
        return { idx, name };
      });
      if (info) {
        expect(info.name, `element #${info.idx} has no accessible name`).not.toBe("");
        seen.add(String(info.idx));
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(total);
  });

  for (const lang of ["en", "zh"] as const) {
    test(`criterion 9: 360 px has no horizontal scroll, screenshot ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto("/#/app");
      await loadExample(page);
      if (lang === "zh") await page.locator("button.lang").click();
      await expect(page.locator("html")).toHaveAttribute("lang", lang === "zh" ? "zh-CN" : "en");
      const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(w.sw).toBeLessThanOrEqual(w.cw);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({ path: `test-results/editor-${lang}.png`, fullPage: true });
    });
  }

  test("criterion 6: preview sits beside the editor on wide screens and below under 720 px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/#/app");
    const box = async () => ({
      e: (await page.getByTestId("resume-editor").boundingBox())!,
      p: (await page.getByTestId("resume-preview").boundingBox())!,
    });
    let b = await box();
    expect(b.p.x).toBeGreaterThanOrEqual(b.e.x + b.e.width - 1);
    await page.setViewportSize({ width: 600, height: 900 });
    b = await box();
    expect(b.p.y).toBeGreaterThanOrEqual(b.e.y + b.e.height - 1);
  });
});
