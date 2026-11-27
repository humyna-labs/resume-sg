/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// resume-sg#12 in a real browser: criterion 3 (the download event), 4 (print is called once), 6 (print media shows only the
// print root; A4 PDF with selectable text, kept as test-results/export-sample.pdf), 8 (no request leaves the origin during
// export) and 10 (red items open: print media shows one line and not the resume). Synthetic data; the AI call is a fake.
//
// Hooks: the toolbar data-testid="tailor-toolbar" with the buttons "Save as PDF" / "另存为 PDF" and
// "Download Markdown" / "下载 Markdown"; the print root [data-print-root] inside data-testid="resume-preview".
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mdEnOutput, mdOriginal, mdZhOutput } from "../fixtures/markdown-resume.ts";
import { ORIGINAL_EN, apiBody, redOutput } from "../fixtures/tailor-flow.ts";
import type { TailorOutput } from "../../src/ai/types.ts";
import { compact, mediaBox, pageCount, pdfText } from "./pdf-text.ts";

const API = "https://api.anthropic.com/v1/messages";
const KEY = "sk-ant-fakekey-abcd3f9a";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
const NOTICE = "请先处理红色项再导出 / Deal with the red items before exporting";
const PDF_BTN = /save as pdf|另存为 ?PDF/i;
const MD_BTN = /download markdown|下载 ?Markdown/i;

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

const bar = (page: Page) => page.getByTestId("tailor-toolbar");

test("criterion 3: Download Markdown suggests resume-en.md and the file holds the resume", async ({ page }) => {
  await generate(page, mdEnOutput(), mdOriginal, "English");
  const [download] = await Promise.all([page.waitForEvent("download"), bar(page).getByRole("button", { name: MD_BTN }).click()]);
  expect(download.suggestedFilename()).toBe("resume-en.md");
  const text = readFileSync((await download.path())!, "utf8");
  expect(text.startsWith("# Chen Hai\n")).toBe(true);
  expect(text).toContain("## Experience");
  expect(text).toContain("### Senior Backend Engineer — Harbour Pay");
  expect(text).toContain("Mar 2021 – Present");
  expect(text).toContain("Tech: Java");
});

test("criterion 3: a Chinese result downloads as resume-zh.md with Chinese section names", async ({ page }) => {
  await generate(page, mdZhOutput(), mdOriginal, "中文");
  const [download] = await Promise.all([page.waitForEvent("download"), bar(page).getByRole("button", { name: MD_BTN }).click()]);
  expect(download.suggestedFilename()).toBe("resume-zh.md");
  const text = readFileSync((await download.path())!, "utf8");
  expect(text.startsWith("# 陈海\n")).toBe(true);
  expect(text).toContain("## 工作经历");
  expect(text).toContain("技术栈：Java");
});

test("criterion 4: Save as PDF calls window.print() once", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __prints: number }).__prints = 0;
    window.print = () => {
      (window as unknown as { __prints: number }).__prints++;
    };
  });
  await generate(page, mdEnOutput(), mdOriginal, "English");
  await bar(page).getByRole("button", { name: PDF_BTN }).click();
  expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
});

test("criterion 6: print media shows only the print root; the PDF is A4 with selectable text", async ({ page }) => {
  await generate(page, mdEnOutput(), mdOriginal, "English");
  await expect(page.locator("[data-print-root]")).toHaveCount(1);
  await page.emulateMedia({ media: "print" });
  const root = page.locator("[data-print-root]");
  await expect(root).toBeVisible();

  const stray = await root.evaluate((r) => {
    const out: string[] = [];
    for (const e of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      if (r.contains(e) || e.contains(r)) continue;
      const s = getComputedStyle(e);
      const b = e.getBoundingClientRect();
      if (s.display !== "none" && s.visibility !== "hidden" && b.width * b.height > 0) out.push(`${e.tagName}.${e.className}`);
    }
    return out;
  });
  expect(stray, "visible elements outside the print root").toEqual([]);

  const shown = await page.locator("body").innerText();
  for (const gone of ["Not in this version", "What changed", "Save as PDF", "Download Markdown", "Check", "Edit result", "Privacy", "FAQ"]) {
    expect(shown, `"${gone}" must not print`).not.toContain(gone);
  }
  expect(shown).toContain("Chen Hai");
  const marks = await root.locator("mark").evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
  for (const bg of marks) expect(["rgba(0, 0, 0, 0)", "transparent"]).toContain(bg); // no fact-check highlight in print

  const pdf = await page.pdf({ preferCSSPageSize: true });
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/export-sample.pdf", pdf);
  const box = mediaBox(pdf);
  expect(box, "PDF has a MediaBox").not.toBeNull();
  expect(Math.abs(box!.w - 595)).toBeLessThanOrEqual(1);
  expect(Math.abs(box!.h - 842)).toBeLessThanOrEqual(1);
  expect(pageCount(pdf)).toBeGreaterThanOrEqual(1);
  expect(pageCount(pdf)).toBeLessThanOrEqual(2);
  const text = compact(pdfText(pdf));
  expect(text, "the name is real text in the PDF").toContain("ChenHai");
  expect(text).not.toContain("NotinthisversionWhatchanged");
  expect(text).not.toContain("SaveasPDF");
});

test("criterion 8: no request leaves the page origin during export", async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  await generate(page, mdEnOutput(), mdOriginal, "English");
  const seen: string[] = [];
  page.on("request", (q) => seen.push(q.url()));
  const origin = new URL(page.url()).origin;
  await bar(page).getByRole("button", { name: PDF_BTN }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), bar(page).getByRole("button", { name: MD_BTN }).click()]);
  await download.path();
  const foreign = seen.filter((u) => !u.startsWith(origin) && !u.startsWith("blob:") && !u.startsWith("data:"));
  expect(foreign).toEqual([]);
});

test("criterion 10: with a red item open, print media hides the resume and prints one line", async ({ page }) => {
  await generate(page, redOutput(), ORIGINAL_EN, "English");
  await expect(bar(page).getByRole("button", { name: PDF_BTN })).toBeDisabled();
  await expect(page.getByText(NOTICE)).toBeHidden(); // on screen the line is not shown
  await page.emulateMedia({ media: "print" });
  await expect(page.getByText(NOTICE)).toBeVisible();
  await expect(page.locator("[data-print-root]")).toBeHidden();
  const shown = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
  expect(shown).toBe(NOTICE);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  const text = compact(pdfText(pdf));
  expect(text).not.toContain("JamieLin");
  expect(text).toContain("Dealwiththereditemsbeforeexporting");
  expect(pageCount(pdf)).toBe(1);
});

test("criterion 10: once the red item is handled, print media prints the resume and not the line", async ({ page }) => {
  await generate(page, redOutput(), ORIGINAL_EN, "English");
  await page.locator("[data-finding-id]").getByRole("button", { name: /^Keep, my original left it out$/ }).click();
  await expect(bar(page).getByRole("button", { name: PDF_BTN })).toBeEnabled();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-print-root]")).toBeVisible();
  const shown = await page.locator("body").innerText();
  expect(shown).not.toContain("Deal with the red items");
  expect(shown).not.toContain("请先处理红色项再导出");
  expect(shown).toContain("Jamie Lin");
});
