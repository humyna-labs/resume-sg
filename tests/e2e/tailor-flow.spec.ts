// resume-sg#30 criteria 10 and 11: network proof, screenshots (input, waiting, result), phone layout, keyboard.
// Test hooks: see tests/unit/flow-helpers.tsx. Screenshots go to test-results/.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { JD_EN, ORIGINAL_EN, apiBody, validOutput } from "../fixtures/tailor-flow.ts";

const API = "https://api.anthropic.com/v1/messages";
const KEY = "sk-ant-fakekey-abcd3f9a";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};
const L = {
  en: { resume: "Your current resume", jd: "Job description", key: "Anthropic API key", generate: "Generate tailored resume" },
  zh: { resume: "你的原始简历", jd: "职位描述（JD）", key: "Anthropic API key（密钥）", generate: "生成定制简历" },
};

/** Fulfil the API with a fixture; if `gate` is given, hold the answer until it resolves. */
async function fakeApi(page: Page, posts: string[], gate?: Promise<void>) {
  await page.route(API, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    posts.push(req.url());
    if (gate) await gate;
    return route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: apiBody(JSON.stringify(validOutput())),
    });
  });
}

async function fill(page: Page, lang: "en" | "zh") {
  const c = L[lang];
  await page.getByLabel(c.key).fill(KEY);
  await page.getByLabel(c.resume).fill(ORIGINAL_EN);
  await page.getByLabel(c.jd).fill(JD_EN);
}

for (const lang of ["en", "zh"] as const) {
  for (const width of [1440, 390]) {
    test.describe(`tailor flow ${lang} ${width}px`, () => {
      test.use({ locale: lang === "zh" ? "zh-CN" : "en-US", viewport: { width, height: width === 1440 ? 900 : 844 } });

      test(`criterion 10: network proof and screenshots of input, waiting and result`, async ({ page, baseURL }) => {
        const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
        const requests: string[] = [];
        page.on("request", (q) => requests.push(q.url()));
        const posts: string[] = [];
        let release: () => void = () => undefined;
        await fakeApi(page, posts, new Promise<void>((r) => (release = r)));

        await page.goto("/#/app");
        await expect(page.getByLabel(L[lang].resume)).toBeVisible();
        await fill(page, lang);
        // nothing has left the page origin yet
        expect(requests.filter((u) => !u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:"))).toEqual([]);
        expect(posts).toHaveLength(0);
        await page.screenshot({ path: `test-results/tailor-${lang}-${width}-input.png`, fullPage: true });

        await page.getByRole("button", { name: L[lang].generate }).click();
        await expect(page.getByTestId("tailor-progress")).toBeVisible();
        await expect.poll(() => posts.length).toBe(1);
        await page.screenshot({ path: `test-results/tailor-${lang}-${width}-waiting.png`, fullPage: true });

        release();
        await expect(page.getByTestId("tailor-result")).toBeVisible();
        await expect(page.getByTestId("resume-preview")).toBeVisible();
        await page.screenshot({ path: `test-results/tailor-${lang}-${width}-result.png`, fullPage: true });

        expect(posts).toEqual([API]);
        const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith(API));
        expect(foreign).toEqual([]);
      });
    });
  }
}

test.describe("criterion 11: phone, 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 }, locale: "en-US" });

  test("one column in the same order, no horizontal overflow, in all three states", async ({ page }) => {
    const posts: string[] = [];
    let release: () => void = () => undefined;
    await fakeApi(page, posts, new Promise<void>((r) => (release = r)));
    const noOverflow = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto("/#/app");
    await fill(page, "en");
    await noOverflow();
    const top = async (loc: ReturnType<Page["locator"]>) => (await loc.first().boundingBox())?.y ?? -1;
    const resume = page.getByLabel(L.en.resume);
    const jd = page.getByLabel(L.en.jd);
    const generate = page.getByRole("button", { name: L.en.generate });
    const [yResume, yJd, yGen] = [await top(resume), await top(jd), await top(generate)];
    expect(yResume).toBeLessThan(yJd);
    expect(yJd).toBeLessThan(yGen);
    // one column: the textareas and the button share the same left edge region and do not sit side by side
    const rb = await resume.boundingBox();
    const gb = await generate.boundingBox();
    expect(rb && gb && gb.y > rb.y + rb.height - 1).toBe(true);

    await generate.click();
    await expect(page.getByTestId("tailor-progress")).toBeVisible();
    await noOverflow();
    release();
    await expect(page.getByTestId("tailor-result")).toBeVisible();
    await noOverflow();
    const yLeft = await top(page.getByTestId("tailor-result"));
    const yPreview = await top(page.getByTestId("resume-preview"));
    expect(yLeft).toBeLessThan(yPreview);
  });

  test("keyboard reaches every control of the input state", async ({ page }) => {
    await fakeApi(page, []);
    await page.goto("/#/app");
    await fill(page, "en");
    const total = await page.evaluate(() => {
      const sel = "main a[href], main button:not([disabled]), main input:not([disabled]), main select:not([disabled]), main textarea:not([disabled]), main [tabindex]:not([tabindex='-1'])";
      const els = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((e) => e.getClientRects().length > 0);
      els.forEach((e) => e.removeAttribute("data-reached"));
      document.addEventListener("focusin", (ev) => (ev.target as HTMLElement).setAttribute("data-reached", "1"));
      return els.length;
    });
    expect(total).toBeGreaterThan(8);
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    for (let i = 0; i < total + 25; i++) await page.keyboard.press("Tab");
    const missed = await page.evaluate(() => {
      const sel = "main a[href], main button:not([disabled]), main input:not([disabled]), main select:not([disabled]), main textarea:not([disabled]), main [tabindex]:not([tabindex='-1'])";
      return Array.from(document.querySelectorAll<HTMLElement>(sel))
        .filter((e) => e.getClientRects().length > 0 && !e.hasAttribute("data-reached"))
        .map((e) => `${e.tagName} ${(e.textContent ?? "").trim().slice(0, 30)}`);
    });
    expect(missed).toEqual([]);
  });
});
