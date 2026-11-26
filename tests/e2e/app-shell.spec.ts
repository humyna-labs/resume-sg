import { expect, test } from "@playwright/test";

const ROUTES = [
  { hash: "#/", name: "home" },
  { hash: "#/app", name: "app" },
  { hash: "#/how-it-works", name: "how-it-works" },
  { hash: "#/faq", name: "faq" },
  { hash: "#/contact", name: "contact" },
  { hash: "#/privacy", name: "privacy" },
];

test.describe("locale zh", () => {
  test.use({ locale: "zh-CN" });
  test("zh-CN browser starts Chinese", async ({ page }) => {
    await page.goto("/#/");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("navigation").getByRole("link", { name: "工作原理" })).toBeVisible();
    await page.screenshot({ path: "test-results/home-zh.png", fullPage: true });
  });
});

test.describe("locale en", () => {
  test.use({ locale: "en-US" });
  test("en-US browser starts English", async ({ page }) => {
    await page.goto("/#/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("navigation").getByRole("link", { name: "How it works" })).toBeVisible();
    await page.screenshot({ path: "test-results/home-en.png", fullPage: true });
  });
});

for (const r of ROUTES) {
  test(`route ${r.hash} opens directly, survives reload, no foreign requests`, async ({
    page,
    baseURL,
  }) => {
    const errors: string[] = [];
    const urls: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (q) => urls.push(q.url()));
    await page.goto(`/${r.hash}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const h1 = await page.getByRole("heading", { level: 1 }).innerText();
    expect(h1.trim().length).toBeGreaterThan(0);
    expect(h1).not.toBe("resume-sg");
    await expect(page).toHaveTitle("JD2CV");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
    await page.screenshot({ path: `test-results/${r.name}-route.png`, fullPage: true });
    const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
    for (const u of urls) {
      if (u.startsWith("data:") || u.startsWith("blob:")) continue;
      expect(u.startsWith(origin)).toBe(true);
    }
    expect(errors).toEqual([]);
  });

  test(`no horizontal scroll and keyboard nav at 360px on ${r.hash}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/${r.hash}`);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w).toBeLessThanOrEqual(360);
    const links = page.getByRole("navigation").getByRole("link");
    const n = await links.count();
    expect(n).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < n; i++) {
      const name = await links
        .nth(i)
        .evaluate((el) => (el.getAttribute("aria-label") || el.textContent || "").trim());
      expect(name.length).toBeGreaterThan(0);
    }
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const href = await page.evaluate(() => {
        const a = document.activeElement;
        return a && a.closest("nav") && a.tagName === "A" ? a.getAttribute("href") : null;
      });
      if (href) seen.add(href);
    }
    for (const h of ["#/", "#/app", "#/how-it-works", "#/faq", "#/contact"]) {
      expect(seen.has(h)).toBe(true);
    }
    await page.screenshot({ path: `test-results/${r.name}-360.png`, fullPage: true });
  });
}

test("body uses the system font stack", async ({ page }) => {
  await page.goto("/#/");
  const ff = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(ff.replace(/'/g, '"')).toBe(
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  );
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce", locale: "en-US" });
  test("primary button has no transition", async ({ page }) => {
    await page.goto("/#/");
    const btn = page.getByRole("main").getByRole("link", { name: "Start tailoring" });
    await expect(btn).toBeVisible();
    const d = await btn.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(d.split(",").every((x) => x.trim() === "0s")).toBe(true);
  });
});

test("language switch works in the browser", async ({ page }) => {
  await page.goto("/#/");
  const before = await page.locator("html").getAttribute("lang");
  await page.getByRole("navigation").getByRole("button").click();
  const after = await page.locator("html").getAttribute("lang");
  expect(after).not.toBe(before);
  expect(["zh-CN", "en"]).toContain(after);
});
