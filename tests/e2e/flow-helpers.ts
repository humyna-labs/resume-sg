// Reach the structured editor through the tailor flow: fake API returns an empty result, then "Edit result".
// Works in both UI languages.
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { apiBody, emptyOutput } from "../fixtures/tailor-flow.ts";

const API = "https://api.anthropic.com/v1/messages";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};

export async function openEditor(page: Page): Promise<void> {
  await page.route(API, (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: apiBody(JSON.stringify(emptyOutput())),
    });
  });
  await page.goto("/#/app");
  await page.getByLabel(/^Anthropic API key/).fill("sk-ant-fakekey-abcd3f9a");
  await page.getByLabel(/^(Your current resume|你的原始简历)/).fill("Sam Sample");
  await page.getByLabel(/^(Job description|职位描述)/).fill("Any job");
  await page.getByRole("button", { name: /^(Generate tailored resume|生成定制简历)$/ }).click();
  await page.getByRole("button", { name: /^(Edit result|编辑结果)$/ }).click();
  await expect(page.getByTestId("resume-editor")).toBeVisible();
}
