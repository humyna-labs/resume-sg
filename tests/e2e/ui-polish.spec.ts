import { expect, test, type Page } from "@playwright/test";

// #42 ui-polish (brief v6 sections 5 to 7): header width, contact fallbacks, How it works illustration.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const LANGS = ["en", "zh"] as const;
const LOCALE = { en: "en-US", zh: "zh-CN" } as const;
const EMAIL = "jd2cv.admin@gmail.com";
const NAV = {
  en: { how: "How it works", faq: "FAQ", contact: "Contact", copy: /^Copy address/, copied: /Copied/, gmail: /Write in Gmail/, btn: "Send an email" },
  zh: { how: "工作原理", faq: "常见问题", contact: "联系我们", copy: /^复制邮箱/, copied: /已复制/, gmail: /用 Gmail 网页版写信/, btn: "发送邮件" },
};
const ALT = {
  zh: "粘贴 → 选择 → AI 改写 → 逐条核对 → 导出",
  en: "Paste → Choose → AI rewrites → Check every line → Export",
};

const header = (page: Page) => page.getByRole("banner").first();

test.describe("criterion 2: header width at 1440", () => {
  for (const lang of LANGS) {
    test.describe(lang, () => {
      test.use({ locale: LOCALE[lang] });
      test("content box 980 px, centred, links 28 px apart", async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto("/#/");
        const h = header(page);
        await expect(h.getByRole("link", { name: NAV[lang].how })).toBeVisible();
        const m = await h.evaluate((root) => {
          const brand = root.querySelector('a[href="#/"]') as HTMLElement;
          const bar = brand.parentElement as HTMLElement;
          const cs = getComputedStyle(bar);
          const r = bar.getBoundingClientRect();
          const left = r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
          const right = r.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
          return { width: right - left, left, right, vw: document.documentElement.clientWidth };
        });
        expect(m.width).toBeCloseTo(980, 0);
        expect(m.left).toBeCloseTo(m.vw - m.right, 0);
        const boxes = [] as { x: number; width: number }[];
        for (const name of [NAV[lang].how, NAV[lang].faq, NAV[lang].contact]) {
          const b = await h.getByRole("link", { name, exact: true }).boundingBox();
          if (!b) throw new Error("no box");
          boxes.push(b);
        }
        for (let i = 1; i < boxes.length; i++) {
          const prev = boxes[i - 1] as { x: number; width: number };
          expect((boxes[i] as { x: number }).x - (prev.x + prev.width)).toBeCloseTo(28, 0);
        }
      });
    });
  }
});

for (const lang of LANGS) {
  const n = NAV[lang];
  test.describe(`criterion 3: contact, ${lang}`, () => {
    test.use({ locale: LOCALE[lang], permissions: ["clipboard-read", "clipboard-write"] });

    test("mailto unchanged, copy writes the address, Gmail link right", async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto("/#/contact");
      const main = page.getByRole("main");
      await expect(main.getByRole("link", { name: n.btn })).toHaveAttribute("href", `mailto:${EMAIL}?subject=JD2CV%20feedback`);
      const copy = main.getByRole("button", { name: n.copy });
      await copy.click();
      await expect(copy).toHaveText(n.copied);
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);
      await expect(copy).toHaveText(n.copy, { timeout: 4000 });
      const gmail = main.getByRole("link", { name: n.gmail });
      await expect(gmail).toHaveAttribute("href", `https://mail.google.com/mail/?view=cm&to=${EMAIL}&su=JD2CV%20feedback`);
      await expect(gmail).toHaveAttribute("target", "_blank");
      const rel = ((await gmail.getAttribute("rel")) ?? "").split(/\s+/);
      expect(rel).toContain("noopener");
      expect(rel).toContain("noreferrer");
    });

    test("no request to another origin on load", async ({ page, baseURL }) => {
      const urls: string[] = [];
      page.on("request", (q) => urls.push(q.url()));
      await page.setViewportSize(DESKTOP);
      await page.goto("/#/contact");
      await expect(page.getByRole("main").getByRole("link", { name: n.gmail })).toBeVisible();
      const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
      for (const u of urls) if (!u.startsWith("data:") && !u.startsWith("blob:")) expect(u.startsWith(origin), u).toBe(true);
    });

    test("screenshot at 1440", async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto("/#/contact");
      await expect(page.getByRole("main").getByRole("link", { name: n.gmail })).toBeVisible();
      await page.screenshot({ path: `test-results/ui-polish-contact-desktop-${lang}.png`, fullPage: true });
    });
  });

  test.describe(`criterion 5: illustration, ${lang}`, () => {
    test.use({ locale: LOCALE[lang] });

    test("1440: loads from the page origin, 100% wide up to 1100 px", async ({ page, baseURL }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto("/#/how-it-works");
      const img = page.getByRole("main").getByRole("img", { name: ALT[lang] });
      await expect(img).toBeVisible();
      const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
      const info = await img.evaluate((el) => {
        const i = el as HTMLImageElement;
        const cs = getComputedStyle(i);
        const p = i.parentElement as HTMLElement;
        const pcs = getComputedStyle(p);
        return {
          src: i.currentSrc,
          natural: i.naturalWidth,
          maxWidth: cs.maxWidth,
          width: i.getBoundingClientRect().width,
          parentInner: p.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight),
        };
      });
      expect(info.src.startsWith(origin)).toBe(true);
      expect(info.src).toContain(`how-it-works-${lang}`);
      expect(info.src.startsWith("data:")).toBe(false);
      expect(info.natural).toBeGreaterThan(0);
      expect(info.maxWidth).toBe("1100px");
      expect(info.width).toBeCloseTo(Math.min(1100, info.parentInner), 0);
      // at the top: before the text steps
      const imgBox = await img.boundingBox();
      const olBox = await page.getByRole("main").locator("ol").first().boundingBox();
      expect((imgBox?.y ?? 0) + (imgBox?.height ?? 0)).toBeLessThanOrEqual((olBox?.y ?? 0) + 1);
      await page.screenshot({ path: `test-results/ui-polish-how-desktop-${lang}.png`, fullPage: true });
    });

    test("under 760 px the image is hidden and the text steps remain", async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto("/#/how-it-works");
      const img = page.getByRole("main").locator("img");
      await expect(img).toHaveCount(1);
      await expect(img).toBeHidden();
      expect(await img.evaluate((e) => getComputedStyle(e).display)).toBe("none");
      await expect(page.getByRole("main").locator("ol > li")).toHaveCount(6);
      await expect(page.getByRole("main").locator("ol").first()).toBeVisible();
      await page.screenshot({ path: `test-results/ui-polish-how-mobile-${lang}.png`, fullPage: true });
      await page.setViewportSize({ width: 759, height: 844 });
      await expect(img).toBeHidden();
      await page.setViewportSize({ width: 760, height: 844 });
      await expect(img).toBeVisible();
    });
  });
}
