// resume-sg#11 criteria 5, 6, 7 (and 4) in a real browser: the page count comes from the rendered height, a long
// resume is tightened to at most 2 pages, dashed guides show on screen only, Put back keeps its line, and nothing
// leaves the page origin except the fake API call. Synthetic data only. Screenshots go to test-results/.
//
// Test hooks: data-testid="tailor-toolbar" (page count text), data-testid="resume-preview" (with the pages as
// [data-page] inside), dashed page-break guides as [data-page-guide] inside the preview (one between two pages,
// none for a 1-page resume, display: none when printing), the "Not in this version" tab with one <li> and a
// "Put back" button per moved bullet, and the warning sentence of criterion 4 in <main>.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { apiBody } from "../fixtures/tailor-flow.ts";
import { longRoles, shortRoles, synth, synthHeavy } from "../fixtures/page-fit.ts";

const API = "https://api.anthropic.com/v1/messages";
const KEY = "sk-ant-fakekey-abcd3f9a";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};
const L = {
  en: { resume: "Your current resume", jd: "Job description", key: "Anthropic API key", generate: "Generate tailored resume", tab: /^Not in this version/, warn: "Still over two pages. Shorten some bullets in your base resume.", two: /\b2 pages/, one: /\b1 page(?!s)/, many: /\b([3-9]|\d\d) pages/, pdf: /export pdf/i },
  zh: { resume: "你的原始简历", jd: "职位描述（JD）", key: "Anthropic API key（密钥）", generate: "生成定制简历", tab: /^本版未放入/, warn: "仍超过两页，请精简原简历中的部分要点。", two: /2 页/, one: /(^|\D)1 页/, many: /([3-9]|\d\d) 页/, pdf: /导出 ?PDF/i },
};

async function generate(page: Page, lang: "en" | "zh", fx: ReturnType<typeof synth>, requests?: string[]) {
  if (requests) page.on("request", (q) => requests.push(q.url()));
  await page.route(API, (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: apiBody(JSON.stringify(fx.output)) });
  });
  const c = L[lang];
  await page.goto("/#/app");
  await page.getByLabel(c.key).fill(KEY);
  await page.getByLabel(c.resume).fill(fx.original);
  await page.getByLabel(c.jd).fill("Senior Engineer, any company. Requirements: delivery, review and rollout work.");
  await page.getByRole("button", { name: c.generate }).click();
  await expect(page.getByTestId("tailor-result")).toBeVisible({ timeout: 30_000 });
}

const toolbar = (page: Page) => page.getByTestId("tailor-toolbar");
const previewPages = (page: Page) => page.getByTestId("resume-preview").locator("[data-page]");
// only the experience bullets: the template also renders every certificate as li[data-bullet]
const bullets = (page: Page) => page.getByTestId("resume-preview").locator("[data-section=\"experience\"] li[data-bullet]");
const panelItems = (page: Page) => page.getByRole("tabpanel").getByRole("listitem");

/** 6 roles x 6 bullets of about three lines each, dates 2008 to now: more than two pages untightened. */
const longFx = () => synth(longRoles(6, 6, { long: true }));

test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

test("criterion 5: a short synthetic resume shows 1 page, nothing moved, no guide", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
  const requests: string[] = [];
  await generate(page, "en", synth(shortRoles()), requests);
  await expect(toolbar(page)).toContainText(L.en.one);
  await expect(previewPages(page)).toHaveCount(1);
  await expect(bullets(page)).toHaveCount(6);
  await expect(page.locator("[data-page-guide]")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: L.en.tab })).toContainText("0");
  await page.screenshot({ path: "test-results/page-fit-1-page.png", fullPage: true });
  // criterion 7: measuring is local; only the (fake) API call leaves the page, and it goes to the API host
  const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith(API));
  expect(foreign).toEqual([]);
});

test("criterion 5: 6 roles x 6 bullets is tightened to at most 2 pages; moved bullets are under Not in this version", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
  const requests: string[] = [];
  const fx = longFx();
  await generate(page, "en", fx, requests);
  await expect(toolbar(page)).toContainText(L.en.two);
  await expect(previewPages(page)).toHaveCount(2);
  await expect(page.getByText(L.en.warn)).toHaveCount(0);
  const shown = await bullets(page).count();
  expect(shown).toBeLessThan(36);
  expect(shown).toBeGreaterThanOrEqual(12);
  // every company is still there
  const text = (await page.getByTestId("resume-preview").textContent()) ?? "";
  for (const e of fx.output.resume.experience) expect(text).toContain(e.company);
  // the moved bullets are listed, with a Put back button each
  await page.getByRole("tab", { name: L.en.tab }).click();
  await expect(panelItems(page)).toHaveCount(36 - shown);
  await expect(page.getByRole("tabpanel").getByRole("button", { name: /^Put back/ })).toHaveCount(36 - shown);
  await page.getByRole("tab", { name: /^Check/ }).click();
  await page.screenshot({ path: "test-results/page-fit-2-pages.png", fullPage: true });
  const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith(API));
  expect(foreign).toEqual([]);
});

test("criterion 5: dashed page-break guides on screen only, one per page break", async ({ page }) => {
  await generate(page, "en", longFx());
  await expect(previewPages(page)).toHaveCount(2);
  const guides = page.locator("[data-testid='resume-preview'] [data-page-guide]");
  expect(await guides.count()).toBeGreaterThanOrEqual(1);
  expect(await guides.count()).toBeLessThanOrEqual(2);
  const style = await guides.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.borderTopStyle, s.borderBottomStyle, s.outlineStyle, s.backgroundImage].join(" ");
  });
  expect(style).toMatch(/dashed|repeating|dash/);
  // the guide sits one A4 page (1123 CSS px) below the top of the first page
  const [pageBox, guideBox] = await Promise.all([previewPages(page).first().boundingBox(), guides.first().boundingBox()]);
  expect(pageBox && guideBox).toBeTruthy();
  if (pageBox && guideBox) {
    const scale = pageBox.width / 794;
    expect(Math.abs((guideBox.y - pageBox.y) / scale - 1123)).toBeLessThan(6);
  }
  await expect(guides.first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(guides.first()).toBeHidden();
});

test("owner: Put back on a resume at its page target keeps the line and moves other bullets, still 2 pages", async ({ page }) => {
  await generate(page, "en", longFx());
  await expect(toolbar(page)).toContainText(L.en.two);
  const shown = await bullets(page).count();
  await page.getByRole("tab", { name: L.en.tab }).click();
  const first = panelItems(page).first();
  const line = ((await first.textContent()) ?? "").replace(/Put back.*$/s, "").trim();
  expect(line.length).toBeGreaterThan(20);
  await first.getByRole("button", { name: /^Put back/ }).click();
  await expect(page.getByTestId("resume-preview").getByText(line, { exact: true })).toBeVisible();
  await expect(toolbar(page)).toContainText(L.en.two);
  await expect(previewPages(page)).toHaveCount(2);
  await expect(page.getByText(L.en.warn)).toHaveCount(0);
  // another bullet moved out instead: about as many bullets as before, and the put-back line is not in the list
  expect(Math.abs((await bullets(page).count()) - shown)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("tabpanel").getByText(line, { exact: false })).toHaveCount(0);
  await page.screenshot({ path: "test-results/page-fit-put-back.png", fullPage: true });
});

test("owner: Add it back on a resume at its page target keeps the line, other bullets move, still 2 pages and no warning", async ({ page }) => {
  const fx = longFx();
  const dropped = fx.output.resume.experience[0]?.bullets.splice(3, 1)[0];
  expect(dropped).toBeTruthy();
  await generate(page, "en", fx);
  await expect(toolbar(page)).toContainText(L.en.two);
  const shown = await bullets(page).count();
  await page.getByTestId("finding-add").first().click();
  const text = (dropped as { text: string }).text;
  await expect(page.getByTestId("resume-preview").getByText(text, { exact: true })).toBeVisible();
  await expect(toolbar(page)).toContainText(L.en.two);
  await expect(previewPages(page)).toHaveCount(2);
  await expect(page.getByText(L.en.warn)).toHaveCount(0);
  expect(Math.abs((await bullets(page).count()) - shown)).toBeLessThanOrEqual(1);
});

test.describe("nothing more can move", () => {
  // 8 roles (the validator cap) x 2 bullets plus untouchable sections: over two pages even at one bullet per role
  const hardFx = () => synthHeavy();

  test("criterion 4: shows the real page count and the warning; export stays allowed", async ({ page }) => {
    await generate(page, "en", hardFx());
    await expect(page.getByText(L.en.warn)).toBeVisible();
    await expect(toolbar(page)).toContainText(L.en.many);
    await expect(bullets(page)).toHaveCount(8);
    await expect(page.getByRole("button", { name: L.en.pdf })).toBeEnabled();
    await page.screenshot({ path: "test-results/page-fit-over-two-pages.png", fullPage: true });
  });

  test("criterion 6: Put back re-measures: the real count and the warning stay, the line stays", async ({ page }) => {
    await generate(page, "en", hardFx());
    await expect(page.getByText(L.en.warn)).toBeVisible();
    await page.getByRole("tab", { name: L.en.tab }).click();
    const first = panelItems(page).first();
    const line = ((await first.textContent()) ?? "").replace(/Put back.*$/s, "").trim();
    await first.getByRole("button", { name: /^Put back/ }).click();
    await expect(page.getByTestId("resume-preview").getByText(line, { exact: true })).toBeVisible();
    await expect(page.getByText(L.en.warn)).toBeVisible();
    await expect(toolbar(page)).toContainText(L.en.many);
  });
});

test.describe("Chinese interface", () => {
  test.use({ locale: "zh-CN" });

  test("shows '2 页' for the tightened long resume and '1 页' for the short one", async ({ page }) => {
    await generate(page, "zh", longFx());
    await expect(toolbar(page)).toContainText(L.zh.two);
    await expect(page.getByText(L.zh.warn)).toHaveCount(0);
  });
  test("short resume: 1 页", async ({ page }) => {
    await generate(page, "zh", synth(shortRoles()));
    await expect(toolbar(page)).toContainText(L.zh.one);
  });
  test("over two pages: the Chinese warning", async ({ page }) => {
    await generate(page, "zh", synthHeavy());
    await expect(page.getByText(L.zh.warn)).toBeVisible();
    await expect(toolbar(page)).toContainText(L.zh.many);
  });
});
