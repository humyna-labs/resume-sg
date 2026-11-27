// resume-sg#7 criteria 5a (links), 8 (network proof), 9 (key never rendered) and 10 (keyboard, 360 px).
import { expect, test } from "@playwright/test";
import { walkToStep4 } from "./flow-helpers.ts";
import type { Page } from "@playwright/test";

const KEY = "test-key-not-real";
const API = "https://api.anthropic.com/v1/messages";
const LABEL = { en: "Anthropic API key", zh: "Anthropic API key（密钥）" };
const TEST = { en: "Test connection", zh: "测试连接" };
const OKMSG = { en: "Connected.", zh: "连接成功。" };
const HELP = { en: "No key yet? Get one in 3 steps", zh: "还没有 key？3 步获取" };
const PROTECT = { en: "How we protect your key ›", zh: "我们怎么保护你的 key ›" };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};

async function fakeApi(page: Page, hits: string[]) {
  await page.route(API, async (route) => {
    hits.push(route.request().method());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify({ content: [{ type: "text", text: "ok" }] }),
    });
  });
}

for (const lang of ["en", "zh"] as const) {
  test.describe(`AI settings ${lang}`, () => {
    test.use({ locale: lang === "zh" ? "zh-CN" : "en-US" });

    test("criterion 8: no request leaves the origin until Test connection, then exactly one to Anthropic", async ({ page, baseURL }) => {
      const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
      const urls: string[] = [];
      const hits: string[] = [];
      page.on("request", (q) => urls.push(q.url()));
      await fakeApi(page, hits);
      await page.goto("/#/app");
      await walkToStep4(page, "Sam Sample", "Any job"); // resume-sg#41: the key row is on step 4
      const key = page.getByLabel(LABEL[lang], { exact: true });
      await expect(key).toBeVisible();
      await key.fill(KEY);
      await page.getByRole("button", { name: HELP[lang] }).click();
      await page.getByRole("button", { name: HELP[lang] }).click();
      const btn = page.getByRole("button", { name: TEST[lang] });
      await expect(btn).toBeEnabled();
      await page.screenshot({ path: `test-results/byok-before-test-${lang}.png`, fullPage: true });
      for (const u of urls) {
        if (u.startsWith("data:") || u.startsWith("blob:")) continue;
        expect(u.startsWith(origin), `request before the click: ${u}`).toBe(true);
      }
      expect(hits).toHaveLength(0);

      const before = urls.length;
      await btn.click();
      await expect(page.getByRole("main")).toContainText(OKMSG[lang]);
      await page.screenshot({ path: `test-results/byok-after-test-${lang}.png`, fullPage: true });
      const after = urls.slice(before).filter((u) => !u.startsWith("data:") && !u.startsWith("blob:"));
      expect(after.filter((u) => u === API)).toHaveLength(1);
      for (const u of after) expect(u === API || u.startsWith(origin), `unexpected request: ${u}`).toBe(true);
      expect(hits.filter((m) => m === "POST")).toHaveLength(1);
    });

    test("criterion 9: the key is never rendered, logged or put in the URL", async ({ page }) => {
      const logs: string[] = [];
      page.on("console", (m) => logs.push(m.text()));
      page.on("pageerror", (e) => logs.push(e.message));
      await fakeApi(page, []);
      await page.goto("/#/app");
      await walkToStep4(page, "Sam Sample", "Any job"); // resume-sg#41: the key row is on step 4
      const key = page.getByLabel(LABEL[lang], { exact: true });
      await key.fill(KEY);
      await page.getByRole("button", { name: TEST[lang] }).click();
      await expect(page.getByRole("main")).toContainText(OKMSG[lang]);
      await page.screenshot({ path: `test-results/byok-key-hidden-${lang}.png`, fullPage: true });
      const state = await page.evaluate((k) => {
        const text = document.body.innerText + document.documentElement.outerHTML.replace(/value="[^"]*"/g, "");
        const pw = document.querySelector("input[type=password]");
        const values = Array.from(document.querySelectorAll("input, textarea, select"))
          .filter((e) => e !== pw)
          .map((e) => (e as HTMLInputElement).value);
        const attrs = Array.from(document.querySelectorAll("*")).flatMap((e) =>
          Array.from(e.attributes).filter((a) => !(e === pw && a.name === "value")).map((a) => a.value),
        );
        return {
          textHas: text.includes(k),
          valuesHave: values.some((v) => v.includes(k)),
          attrsHave: attrs.some((v) => v.includes(k)),
          pwType: pw?.getAttribute("type"),
          url: location.href,
        };
      }, KEY);
      expect(state.pwType).toBe("password");
      expect(state.textHas).toBe(false);
      expect(state.valuesHave).toBe(false);
      expect(state.attrsHave).toBe(false);
      expect(state.url).not.toContain(KEY);
      expect(logs.join("\n")).not.toContain(KEY);
    });

    test("criterion 5a: help links have the right href, target and rel and make no request", async ({ page, baseURL }) => {
      const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
      const urls: string[] = [];
      page.on("request", (q) => urls.push(q.url()));
      await page.goto("/#/app");
      await walkToStep4(page, "Sam Sample", "Any job"); // resume-sg#41: the key row is on step 4
      const help = page.getByRole("button", { name: HELP[lang] });
      await expect(help).toHaveAttribute("aria-expanded", "true");
      const items = page.getByRole("main").locator("ol > li");
      await expect(items).toHaveCount(3);
      const consoleLink = items.nth(0).getByRole("link", { name: "platform.claude.com" });
      const keysLink = items.nth(2).getByRole("link", { name: "API keys" });
      await expect(consoleLink).toHaveAttribute("href", "https://platform.claude.com");
      await expect(keysLink).toHaveAttribute("href", "https://platform.claude.com/settings/keys");
      for (const l of [consoleLink, keysLink]) {
        await expect(l).toHaveAttribute("target", "_blank");
        const rel = (await l.getAttribute("rel")) ?? "";
        expect(rel.split(/\s+/)).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
      }
      await help.click();
      await expect(help).toHaveAttribute("aria-expanded", "false");
      await page.screenshot({ path: `test-results/byok-help-${lang}.png`, fullPage: true });
      for (const u of urls) {
        if (u.startsWith("data:") || u.startsWith("blob:")) continue;
        expect(u.startsWith(origin), `request from the help area: ${u}`).toBe(true);
      }
    });

    test("criterion 5a: the protect link opens the FAQ entry Is my API key safe?", async ({ page }) => {
      await page.goto("/#/app");
      await walkToStep4(page, "Sam Sample", "Any job"); // resume-sg#41: the key row is on step 4
      await page.getByRole("link", { name: PROTECT[lang] }).click();
      await expect(page).toHaveURL(/#\/faq/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(lang === "en" ? "FAQ" : "常见问题");
      const q = page.getByText(lang === "en" ? "Is my API key safe?" : "我的 API key 安全吗？").first();
      await expect(q).toBeInViewport();
      await page.screenshot({ path: `test-results/byok-faq-anchor-${lang}.png` });
    });

    test("criterion 10: works by keyboard alone", async ({ page }) => {
      const hits: string[] = [];
      await fakeApi(page, hits);
      await page.goto("/#/app");
      await walkToStep4(page, "Sam Sample", "Any job"); // resume-sg#41: the key row is on step 4
      const key = page.getByLabel(LABEL[lang], { exact: true });
      await key.focus();
      await page.keyboard.type(KEY);
      await expect(key).toHaveValue(KEY);
      const btn = page.getByRole("button", { name: TEST[lang] });
      let reached = false;
      for (let i = 0; i < 15 && !reached; i++) {
        await page.keyboard.press("Tab");
        reached = await btn.evaluate((el) => el === document.activeElement);
      }
      expect(reached, "Test connection reachable with Tab").toBe(true);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toContainText(OKMSG[lang]);
      expect(hits.filter((m) => m === "POST")).toHaveLength(1);
    });

    test("criterion 10: usable at 360 px without horizontal scroll", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await fakeApi(page, []);
      await page.goto("/#/app");
      await walkToStep4(page, "Sam Sample", "Any job"); // resume-sg#41: the key row is on step 4
      const key = page.getByLabel(LABEL[lang], { exact: true });
      await key.fill(KEY);
      await expect(page.getByRole("button", { name: TEST[lang] })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
      await page.screenshot({ path: `test-results/byok-360-${lang}.png`, fullPage: true });
    });
  });
}
