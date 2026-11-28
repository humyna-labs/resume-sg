// resume-sg#31 (session-autosave) criteria 2, 3, 4, 8a and 9 end to end. Synthetic data, fake keys.
// Screenshots go to test-results/. Hooks: see tests/unit/session-autosave.test.tsx (Clear all control,
// data-testid="clear-key-confirm" / "clear-key-keep" in the remembered-key dialog) and tests/unit/flow-helpers.tsx.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { JD_EN, ORIGINAL_EN, apiBody, redOutput } from "../fixtures/tailor-flow.ts";

const API = "https://api.anthropic.com/v1/messages";
const KEY = "test-key-not-real";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};
const INTERRUPTED = "The last generation was interrupted; your input is still here, please generate again.";
const NOTE = "Your input and result are kept in this tab so a refresh loses nothing; closing the tab clears them.";
const next = (page: Page) => page.getByTestId("step-next");
const currentStep = (page: Page) => page.locator('[data-testid="wizard-progress"] [data-state="current"]').getAttribute("data-step");

/** Fulfil the API with the red-item fixture; `gate` holds the answer. Counts POSTs. */
async function fakeApi(page: Page, posts: string[], gate?: Promise<void>) {
  await page.route(API, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    posts.push(req.url());
    if (gate) await gate;
    return route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "text/event-stream" },
      body: apiBody(JSON.stringify(redOutput())),
    });
  });
}
async function toStep4(page: Page, key = KEY) {
  await page.getByLabel(/^Your current resume/).fill(ORIGINAL_EN);
  await next(page).click();
  await page.getByLabel(/^Job description/).fill(JD_EN);
  await next(page).click();
  await next(page).click();
  if (key) await page.getByLabel(/^Anthropic API key/).fill(key);
}
const sessionValues = (page: Page) =>
  page.evaluate(() => ({ session: JSON.stringify({ ...sessionStorage }), local: JSON.stringify({ ...localStorage }), cookie: document.cookie }));
/** The page has saved a session with `step` (autosave is debounced to one second). */
const savedStep = (page: Page, step: number) =>
  expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("jd2cv.session") ?? "{}").step), { timeout: 4000 }).toBe(step);

test.describe("session autosave e2e", () => {
  test.use({ locale: "en-US" });

  test("criteria 2, 4, 8a, 9: paste, generate, decide one red item, reload: the same state; screenshot; no foreign request", async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
    const urls: string[] = [];
    page.on("request", (q) => urls.push(q.url()));
    const posts: string[] = [];
    await fakeApi(page, posts);
    await page.goto("/#/app");
    await toStep4(page);
    await page.getByRole("button", { name: "Generate tailored resume" }).click();
    await expect(page.getByTestId("tailor-result")).toBeVisible();
    const red = page.locator("[data-finding-id]").filter({ has: page.getByRole("button", { name: "Remove it" }) }).first();
    await red.getByRole("button", { name: "Remove it" }).click();
    await expect(page.getByTestId("resume-preview")).not.toContainText("30%");
    const exportPdf = page.getByRole("button", { name: /save as pdf/i });
    await expect(exportPdf).toBeEnabled();
    await savedStep(page, 5);
    await expect
      .poll(() => page.evaluate(() => JSON.stringify(JSON.parse(sessionStorage.getItem("jd2cv.session") ?? "{}").result?.decisions ?? {})))
      .toContain("removed");

    await page.reload();
    await expect(page.getByTestId("tailor-result")).toBeVisible();
    expect(await currentStep(page)).toBe("5");
    await expect(page.getByTestId("resume-preview")).not.toContainText("30%");
    await expect(page.getByRole("button", { name: /save as pdf/i })).toBeEnabled();
    await expect(page.getByRole("tab").first()).toBeVisible();
    await page.screenshot({ path: "test-results/session-restored-result.png", fullPage: true });

    // back to the input: the texts and the options are still there (step 8a: the wizard stepper still works after a restore)
    await page.getByTestId("wizard-progress").getByRole("button").first().click();
    await expect(page.getByLabel(/^Your current resume/)).toHaveValue(ORIGINAL_EN);

    // criterion 4: never the key
    const v = await sessionValues(page);
    expect(v.session).not.toContain(KEY);
    expect(v.local).not.toContain(KEY);
    expect(v.local).toBe("{}");
    expect(v.cookie).toBe("");
    expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
    expect(posts).toHaveLength(1); // the restore sent nothing
    // criterion 9: nothing left the origin while saving and restoring
    for (const u of urls) {
      if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith(API)) continue;
      expect(new URL(u).origin, u).toBe(origin);
    }
  });

  test("criterion 8a: a reload on step 3 returns to step 3 with the options kept", async ({ page }) => {
    await page.goto("/#/app");
    await page.getByLabel(/^Your current resume/).fill(ORIGINAL_EN);
    await next(page).click();
    await page.getByLabel(/^Job description/).fill(JD_EN);
    await next(page).click();
    await page.getByRole("radio", { name: /^modern/i }).click();
    await page.getByRole("radio", { name: "中文" }).click();
    await savedStep(page, 3);
    await page.waitForTimeout(1200);
    await page.reload();
    expect(await currentStep(page)).toBe("3");
    await expect(page.getByRole("radio", { name: /^modern/i })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: "中文" })).toHaveAttribute("aria-checked", "true");
  });

  test("criterion 3 and 8a: a reload while a request runs shows the interrupted message on step 4 and resends nothing", async ({ page }) => {
    page.on("dialog", (d) => void d.accept()); // the leave-page warning
    const posts: string[] = [];
    await fakeApi(page, posts, new Promise<void>(() => undefined)); // never answered
    await page.goto("/#/app");
    await toStep4(page);
    await page.getByRole("button", { name: "Generate tailored resume" }).click();
    await expect(page.getByTestId("tailor-progress")).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("jd2cv.session") ?? "{}").pending), { timeout: 4000 }).toBe(true);
    await page.reload();
    await expect(page.getByRole("main")).toContainText(INTERRUPTED);
    expect(await currentStep(page)).toBe("4");
    await expect(page.getByTestId("tailor-progress")).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(posts).toHaveLength(1);
    await page.getByTestId("wizard-progress").getByRole("button").first().click();
    await expect(page.getByLabel(/^Your current resume/)).toHaveValue(ORIGINAL_EN);
  });

  test("criterion 9: the autosave note and the Clear all confirmation, screenshots", async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
    const urls: string[] = [];
    page.on("request", (q) => urls.push(q.url()));
    await page.goto("/#/app");
    await page.evaluate((k) => localStorage.setItem("jd2cv.apiKey", k), KEY); // a remembered key (the existing slot)
    await page.reload();
    await page.getByLabel(/^Your current resume/).fill(ORIGINAL_EN);
    await expect(page.getByRole("main")).toContainText(NOTE);
    await savedStep(page, 1);
    const clear = page.getByRole("main").getByRole("button", { name: /^Clear all$/ }).or(page.getByRole("main").getByRole("link", { name: /^Clear all$/ }));
    await clear.first().click();
    const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await expect(dialog).toContainText("Also delete the key remembered on this device?");
    await page.screenshot({ path: "test-results/session-clear-all-confirm.png", fullPage: true });
    await dialog.getByTestId("clear-key-keep").click();
    await expect(page.getByLabel(/^Your current resume/)).toHaveValue("");
    expect(await page.evaluate(() => sessionStorage.getItem("jd2cv.session"))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("jd2cv.apiKey"))).toBe(KEY);
    await page.getByLabel(/^Your current resume/).fill(ORIGINAL_EN);
    await clear.first().click();
    await dialog.getByTestId("clear-key-confirm").click();
    expect(await page.evaluate(() => localStorage.getItem("jd2cv.apiKey"))).toBeNull();
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("jd2cv.")))).toEqual([]);
    for (const u of urls) {
      if (u.startsWith("data:") || u.startsWith("blob:")) continue;
      expect(new URL(u).origin, u).toBe(origin);
    }
  });
});
