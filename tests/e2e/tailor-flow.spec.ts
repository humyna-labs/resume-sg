// resume-sg#30 criteria 10 and 11 as updated by resume-sg#41 (five-step wizard): network proof, screenshots of steps 1 to 5,
// one centred card, limits, phone layout, keyboard.
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

const NEXT_ANY = /^(Next: |下一步：)/;
const next = (page: Page) => page.getByTestId("step-next");

/** Walk steps 1 to 3 (texts, Next) and arrive on step 4; the key is typed there. */
async function toStep4(page: Page, lang: "en" | "zh", shots?: (n: number) => Promise<void>) {
  const c = L[lang];
  await page.getByLabel(c.resume).fill(ORIGINAL_EN);
  await shots?.(1);
  await next(page).click();
  await page.getByLabel(c.jd).fill(JD_EN);
  await shots?.(2);
  await next(page).click();
  await expect(page.getByTestId("step-next")).toHaveText(NEXT_ANY);
  await shots?.(3);
  await next(page).click();
  await page.getByLabel(c.key).fill(KEY);
  await shots?.(4);
}

for (const lang of ["en", "zh"] as const) {
  for (const width of [1440, 390]) {
    test.describe(`wizard ${lang} ${width}px`, () => {
      test.use({ locale: lang === "zh" ? "zh-CN" : "en-US", viewport: { width, height: width === 1440 ? 900 : 844 } });

      test(`criteria 2 and 12: one centred card per step, network proof, screenshots of steps 1 to 5`, async ({ page, baseURL }) => {
        const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
        const requests: string[] = [];
        page.on("request", (q) => requests.push(q.url()));
        const posts: string[] = [];
        let release: () => void = () => undefined;
        await fakeApi(page, posts, new Promise<void>((r) => (release = r)));

        await page.goto("/#/app");
        await expect(page.getByLabel(L[lang].resume)).toBeVisible();
        const oneCard = async () => {
          const box = await page.getByTestId("step-footer").locator("xpath=ancestor::*[contains(concat(' ',normalize-space(@class),' '),' card ')][1]").boundingBox();
          if (!box) throw new Error("the step card has no box");
          const vw = page.viewportSize()?.width ?? width;
          expect(box.width).toBeLessThanOrEqual(860.5);
          expect(Math.abs(box.x + box.width / 2 - vw / 2)).toBeLessThanOrEqual(2);
          // nothing beside it: no visible block of main lies wholly left or right of the card
          const beside = await page.evaluate(({ x, w }) => {
            return Array.from(document.querySelectorAll<HTMLElement>("main textarea, main button, main input, main select, main section, main article"))
              .filter((e) => e.getClientRects().length > 0)
              .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 40 && (r.right < x + 1 || r.left > x + w - 1); }).length;
          }, { x: box.x, w: box.width });
          expect(beside).toBe(0);
        };
        const shot = async (n: number) => {
          await oneCard();
          await page.screenshot({ path: `test-results/wizard-${lang}-${width}-step${n}.png`, fullPage: true });
        };
        await toStep4(page, lang, shot);
        // nothing has left the page origin yet
        expect(requests.filter((u) => !u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:"))).toEqual([]);
        expect(posts).toHaveLength(0);

        await page.getByRole("button", { name: L[lang].generate }).click();
        await expect(page.getByTestId("tailor-progress")).toBeVisible();
        await expect.poll(() => posts.length).toBe(1);
        await page.screenshot({ path: `test-results/wizard-${lang}-${width}-step5-waiting.png`, fullPage: true });

        release();
        await expect(page.getByTestId("tailor-result")).toBeVisible();
        await expect(page.getByTestId("resume-preview")).toBeVisible();
        await page.screenshot({ path: `test-results/wizard-${lang}-${width}-step5.png`, fullPage: true });

        expect(posts).toEqual([API]);
        const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith(API));
        expect(foreign).toEqual([]);
      });
    });
  }
}

test.describe("criterion 1 in a real browser: progress bar look", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  test("nodes sit in one row; the current label is bold; future steps are not focusable", async ({ page }) => {
    await page.goto("/#/app");
    const li = page.getByTestId("wizard-progress").locator("li");
    await expect(li).toHaveCount(5);
    const ys = await li.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(ys).size).toBe(1);
    const weight = await li.nth(0).evaluate((e) => Number.parseInt(getComputedStyle(e.querySelector("[aria-current=step]") ?? e).fontWeight, 10));
    expect(weight).toBeGreaterThanOrEqual(600);
    const other = await li.nth(1).evaluate((e) => Number.parseInt(getComputedStyle(e).fontWeight, 10));
    expect(other).toBeLessThan(600);
    await page.getByLabel(L.en.resume).fill(ORIGINAL_EN);
    await page.keyboard.press("Tab");
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    const focusedInFuture = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-testid=wizard-progress] li:nth-child(n+2)")).some((e) => e.contains(document.activeElement)),
    );
    expect(focusedInFuture).toBe(false);
  });
});

test.describe("criterion 5: limits in a real browser", () => {
  test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  test("30,001 characters stay complete, the counter is red, Next is disabled with the hint", async ({ page }) => {
    await page.goto("/#/app");
    const box = page.getByLabel(L.en.resume);
    await box.fill("x".repeat(30001));
    expect(await box.inputValue()).toHaveLength(30001);
    expect(await box.getAttribute("maxlength")).toBeNull();
    const counter = page.getByTestId("resume-counter");
    await expect(counter).toHaveText("30,001 / 30,000 characters");
    const rgb = await counter.evaluate((e) => getComputedStyle(e).color.match(/\d+/g)?.map(Number) ?? []);
    expect((rgb[0] ?? 0) > 150 && (rgb[1] ?? 255) < 90 && (rgb[2] ?? 255) < 90).toBe(true);
    await expect(next(page)).toBeDisabled();
    await expect(page.getByTestId("generate-hint")).toHaveText("Over 30,000 characters; remove parts that are not about your work");
    await box.fill("x".repeat(30000));
    await expect(next(page)).toBeEnabled();
  });
});

for (const w of [390, 360]) {
  test.describe(`criterion 11: phone, ${w} px`, () => {
    test.use({ viewport: { width: w, height: 740 }, locale: "en-US" });

    test("the same five steps, one column, no horizontal overflow on any step", async ({ page }) => {
      const posts: string[] = [];
      let release: () => void = () => undefined;
      await fakeApi(page, posts, new Promise<void>((r) => (release = r)));
      const noOverflow = async () =>
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.goto("/#/app");
      await expect(page.getByTestId("wizard-progress").locator("li")).toHaveCount(5);
      await noOverflow();
      await toStep4(page, "en", async () => {
        await noOverflow();
        const m = await page.getByRole("main").boundingBox();
        const card = await page.getByTestId("step-footer").locator("xpath=ancestor::*[contains(concat(' ',normalize-space(@class),' '),' card ')][1]").boundingBox();
        expect(card && m && card.width <= m.width + 1).toBe(true);
      });
      // step 3 cards in one column: go back and look at the template cards and the three modes
      await page.getByTestId("wizard-progress").locator("li").nth(2).getByRole("button").click();
      const radios = page.getByRole("radio");
      const xs = await radios.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
      expect(xs.length).toBeGreaterThanOrEqual(7);
      const mode = page.getByRole("radio", { name: /^balanced$/i });
      const mode2 = page.getByRole("radio", { name: /^results-first$/i });
      const [b1, b2] = [await mode.boundingBox(), await mode2.boundingBox()];
      expect(b1 && b2 && b2.y >= b1.y + b1.height - 1).toBe(true);
      await next(page).click();
      await page.getByRole("button", { name: L.en.generate }).click();
      await expect(page.getByTestId("tailor-progress")).toBeVisible();
      await noOverflow();
      release();
      await expect(page.getByTestId("tailor-result")).toBeVisible();
      await noOverflow();
    });

    test("the keyboard reaches every control of every input step", async ({ page }) => {
      await fakeApi(page, []);
      await page.goto("/#/app");
      const reach = async () => {
        const total = await page.evaluate(() => {
          const sel = "main a[href], main button:not([disabled]), main input:not([disabled]), main select:not([disabled]), main textarea:not([disabled]), main [tabindex]:not([tabindex='-1'])";
          const els = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((e) => e.getClientRects().length > 0);
          els.forEach((e) => e.removeAttribute("data-reached"));
          document.addEventListener("focusin", (ev) => (ev.target as HTMLElement).setAttribute("data-reached", "1"));
          return els.length;
        });
        expect(total).toBeGreaterThan(2);
        await page.locator("body").click({ position: { x: 1, y: 1 } });
        for (let i = 0; i < total + 25; i++) await page.keyboard.press("Tab");
        const missed = await page.evaluate(() => {
          const sel = "main a[href], main button:not([disabled]), main input:not([disabled]), main select:not([disabled]), main textarea:not([disabled]), main [tabindex]:not([tabindex='-1'])";
          return Array.from(document.querySelectorAll<HTMLElement>(sel))
            .filter((e) => e.getClientRects().length > 0 && !e.hasAttribute("data-reached"))
            .map((e) => `${e.tagName} ${(e.textContent ?? "").trim().slice(0, 30)}`);
        });
        expect(missed).toEqual([]);
      };
      await page.getByLabel(L.en.resume).fill(ORIGINAL_EN);
      await reach();
      await next(page).click();
      await page.getByLabel(L.en.jd).fill(JD_EN);
      await reach();
      await next(page).click();
      await reach();
      await next(page).click();
      await page.getByLabel(L.en.key).fill(KEY);
      await reach();
    });
  });
}
