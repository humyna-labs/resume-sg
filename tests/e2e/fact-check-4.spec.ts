// resume-sg#52 (brief v8 section 1) in a real browser: a faithful cross-language run shows the Translated group and the
// cross-language green text; an exploit output (an empty resume whose notIncluded sources are "e" and "i") shows
// findings and no green line. Synthetic data only; the AI call is a fake and nothing else leaves the page.
//
// Hooks: data-testid="finding-group-translated" (heading "Translated: compare with your original" / "换了语言，请对照原文"),
// cards as [data-finding-id], data-testid="original-lines". Screenshots go to test-results/.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { case1Original } from "../fixtures/fact-check-cases.ts";
import { apiBody, crossZhOutput, validOutput } from "../fixtures/tailor-flow.ts";
import type { TailorOutput } from "../../src/ai/types.ts";

const API = "https://api.anthropic.com/v1/messages";
const KEY = "sk-ant-fakekey-abcd3f9a";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
const GREEN = "All dates, numbers and sources were found in your original";
const GREEN_CROSS = "All dates and numbers were found in your original. Titles, degrees and names are in another language, so compare them with the original.";

test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

/** Requests that leave the page for somewhere other than the dev server or the mocked AI call. */
function watchOutside(page: Page): string[] {
  const outside: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol === "data:" || u.protocol === "blob:") return;
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return;
    if (r.url() === API) return;
    outside.push(r.url());
  });
  return outside;
}

async function generate(page: Page, out: TailorOutput, original: string, outLang: "中文" | "English"): Promise<void> {
  await page.route(API, (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "text/event-stream" }, body: apiBody(JSON.stringify(out)) });
  });
  await page.goto("/#/app");
  await page.getByLabel(/^(Your current resume|你的原始简历)/).fill(original);
  await page.getByTestId("step-next").click();
  await page.getByLabel(/^(Job description|职位描述)/).fill("Senior Backend Engineer, payments. Requirements: Java, Kafka, settlement.");
  await page.getByTestId("step-next").click();
  await page.getByRole("radio", { name: outLang === "中文" ? /^中文$/ : /^english$/i }).first().click();
  await page.getByTestId("step-next").click();
  await page.getByLabel(/^Anthropic API key/).fill(KEY);
  await page.getByRole("button", { name: /^(Generate tailored resume|生成定制简历)$/ }).click();
  await expect(page.getByTestId("tailor-result")).toBeVisible({ timeout: 30_000 });
}

test("a faithful English -> Chinese run shows the Translated group and the cross-language green text", async ({ page }) => {
  const outside = watchOutside(page);
  await generate(page, crossZhOutput(), case1Original, "中文");
  const g = page.getByTestId("finding-group-translated");
  await expect(g.getByRole("heading", { name: "Translated: compare with your original" })).toBeVisible();
  await expect(g.locator("[data-finding-id]")).toHaveCount(4); // three titles and one degree
  await expect(g).toContainText("首席后端工程师");
  await expect(g).toContainText("计算机科学工学学士");
  await expect(page.getByTestId("original-lines")).toBeVisible();
  const result = page.getByTestId("tailor-result");
  await expect(result).toContainText(GREEN_CROSS);
  await expect(result).not.toContainText(GREEN);
  await expect(page.getByTestId("tailor-toolbar").getByRole("button", { name: /save as pdf/i })).toBeEnabled();
  await page.screenshot({ path: "test-results/fact-check-4-translated.png", fullPage: true });
  expect(outside, "requests that left the page").toEqual([]);
});

test("a faithful same-language run shows the plain green text and no Translated group", async ({ page }) => {
  const outside = watchOutside(page);
  await generate(page, validOutput(), case1Original, "English");
  const result = page.getByTestId("tailor-result");
  await expect(result).toContainText(GREEN);
  await expect(result).not.toContainText(GREEN_CROSS);
  await expect(page.getByTestId("finding-group-translated")).toHaveCount(0);
  expect(outside, "requests that left the page").toEqual([]);
});

test("exploit (a): an empty resume with notIncluded 'e' and 'i' shows findings and no green line", async ({ page }) => {
  const outside = watchOutside(page);
  const out = validOutput();
  out.resume = { ...out.resume, summary: "", experience: [], projects: [], education: [], certificates: [], skills: [], extras: [], languages: [] };
  out.resume.basics = { name: "", headline: "", email: "", phone: "", location: "", links: [] };
  out.changes = [];
  out.notIncluded = [{ source: "e" }, { source: "i" }];
  await generate(page, out, case1Original, "English");
  const result = page.getByTestId("tailor-result");
  await expect(result).not.toContainText(GREEN);
  await expect(result).not.toContainText(GREEN_CROSS);
  expect(await page.locator("[data-finding-id]").count()).toBeGreaterThan(2);
  await expect(result).toContainText("Source too short to check");
  await page.screenshot({ path: "test-results/fact-check-4-exploit.png", fullPage: true });
  expect(outside, "requests that left the page").toEqual([]);
});
