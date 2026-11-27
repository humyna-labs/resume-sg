/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// resume-sg#47 in a real browser: criterion 4 (no card overflows at 1440 and 390 px), criterion 6 (exactly one visible
// marker per bullet), criterion 7 (one-role dates once; the location never breaks inside a word) and criterion 8 (export
// hint). Synthetic data only; the AI call is a fake. Screenshots go to test-results/.
//
// Hooks: data-testid="finding-group-notfound" / "finding-group-missing" around the amber cards of the Check tab,
// cards as [data-finding-id], the toolbar data-testid="tailor-toolbar", the preview data-testid="resume-preview"
// holding [data-template], [data-group], [data-level="company"|"role"], [data-part="dates"|"location"].
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mdEnOutput, mdOriginal, mdZhOutput } from "../fixtures/markdown-resume.ts";
import { apiBody } from "../fixtures/tailor-flow.ts";
import type { TailorOutput } from "../../src/ai/types.ts";

const API = "https://api.anthropic.com/v1/messages";
const KEY = "sk-ant-fakekey-abcd3f9a";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };

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

const LONG_EN = Array.from({ length: 4 }, () => "Singapore Science Park Phase Three Building Twelve").join(" ");
const LONG_ZH = `${"新加坡科学园三期十二号楼东翼九层办公区域".repeat(3)} Science Park Phase Three Building Twelve Wing`;

const LONG_CO_EN = "Harbour Pay International Payments and Settlement Infrastructure Holdings Group Limited Asia Pacific Division";
const LONG_CO_ZH = "海港国际支付与清算基础设施控股集团有限公司亚太区业务发展与运营管理部门";
const preview = (page: Page) => page.getByTestId("resume-preview");
async function pickTemplate(page: Page, tpl: "classic" | "modern"): Promise<void> {
  await page.getByTestId("tailor-toolbar").getByRole("radio", { name: tpl === "classic" ? /^(Classic|经典)$/ : /^(Modern|清新)$/ }).click();
  await expect(preview(page)).toHaveAttribute("data-template", tpl);
}

test.use({ viewport: { width: 1440, height: 900 }, locale: "en-US" });

// ---------------------------------------------------------------- criterion 4: no overflow
test("criterion 4: a card with a 200-character unbroken string has no horizontal overflow at 1440 and 390 px", async ({ page }) => {
  const long = "Q".repeat(200);
  const out = mdEnOutput();
  out.resume.skills[0]!.items.push("S".repeat(200)); // red item card: a long Latin token that is not in the original
  const original = `${mdOriginal}\n${long}\n`; // an uncovered original line: amber coverage card
  await generate(page, out, original, "English");
  const cards = page.locator("[data-finding-id]");
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const bad = await cards.evaluateAll((els) =>
      els.filter((e) => e.scrollWidth > e.clientWidth).map((e) => `${(e.textContent ?? "").slice(0, 40)}: ${e.scrollWidth} > ${e.clientWidth}`),
    );
    expect(bad, `cards that overflow at ${width}px`).toEqual([]);
    const page_ = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(page_, `the page itself scrolls sideways at ${width}px`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/result-fixes-cards-${width}.png`, fullPage: true });
  }
});

test("criterion 4: the two groups are shown with their headings and actions", async ({ page }) => {
  const out = mdEnOutput();
  out.resume.skills[0]!.items.push("Rule engine");
  out.notIncluded = out.notIncluded.filter((n) => !n.source.startsWith("Java"));
  await generate(page, out, mdOriginal, "English");
  const nf = page.getByTestId("finding-group-notfound");
  const miss = page.getByTestId("finding-group-missing");
  await expect(nf.getByRole("heading", { name: "Not found in your original" })).toBeVisible();
  await expect(miss.getByRole("heading", { name: "Possibly missing" })).toBeVisible();
  await expect(nf.getByRole("button", { name: "Remove it" })).toHaveCount(1);
  await expect(nf.getByRole("button", { name: "Keep", exact: true })).toHaveCount(2); // the item card and the name card
  await expect(miss.getByTestId("finding-add")).toHaveCount(1);
  await page.screenshot({ path: "test-results/result-fixes-groups.png", fullPage: true });
});

// ---------------------------------------------------------------- criterion 8: export hint
test("criterion 8 (changed by resume-sg#12): both export buttons are enabled and the 'Export coming soon' hint is gone", async ({ page }) => {
  await generate(page, mdZhOutput(), mdOriginal, "中文");
  const bar = page.getByTestId("tailor-toolbar");
  await expect(bar.getByRole("button", { name: /save as pdf|另存为 ?PDF/i })).toBeEnabled();
  await expect(bar.getByRole("button", { name: /download markdown|下载 ?Markdown/i })).toBeEnabled();
  await expect(bar).not.toContainText(/Export coming soon|导出即将上线/);
});

// ---------------------------------------------------------------- criteria 6 and 7 in both templates and both languages
for (const [lang, make, outLang] of [["zh", mdZhOutput, "中文"], ["en", mdEnOutput, "English"]] as const) {
  for (const tpl of ["classic", "modern"] as const) {
    test(`criterion 6: ${tpl} ${lang}: every bullet in the result preview renders exactly one visible marker`, async ({ page }) => {
      await generate(page, make(), mdOriginal, outLang);
      await pickTemplate(page, tpl);
      const rows = await preview(page).locator("li").evaluateAll((els) =>
        els.map((li) => {
          const cs = getComputedStyle(li);
          const shown = (c: string) => c !== "none" && c !== "normal" && c !== '""' && c !== "''" && c !== "";
          const native = cs.display === "list-item" && cs.listStyleType !== "none" && cs.listStyleImage === "none" ? 1 : 0;
          const own = (shown(getComputedStyle(li, "::before").content) ? 1 : 0) + (shown(getComputedStyle(li, "::after").content) ? 1 : 0);
          const image = cs.backgroundImage !== "none" ? 1 : 0;
          return { text: (li.textContent ?? "").trim().slice(0, 30), markers: native + own + image, lead: /^([-*•·>#]|\d+\.)\s/.test((li.textContent ?? "").trim()) };
        }),
      );
      expect(rows.length).toBeGreaterThanOrEqual(4);
      expect(rows.filter((r) => r.markers !== 1), "bullets without exactly one marker").toEqual([]);
      expect(rows.filter((r) => r.lead), "bullets whose text starts with a marker character").toEqual([]);
      await page.screenshot({ path: `test-results/result-fixes-markers-${tpl}-${lang}.png`, fullPage: true });
    });

    test(`criterion 7: ${tpl} ${lang}: a company with one role shows its dates once, on the company line`, async ({ page }) => {
      await generate(page, make(), mdOriginal, outLang);
      await pickTemplate(page, tpl);
      const info = await preview(page).locator("[data-group]").evaluateAll((gs) =>
        gs.map((g) => ({
          roles: g.querySelectorAll('[data-level="role"]').length,
          roleDates: g.querySelectorAll('[data-level="role"] [data-part="dates"]').length,
          companyDates: g.querySelectorAll('[data-level="company"] [data-part="dates"]').length,
        })),
      );
      expect(info).toEqual([
        { roles: 1, roleDates: 0, companyDates: 1 },
        { roles: 1, roleDates: 0, companyDates: 1 },
      ]);
    });

    test(`criterion 7: ${tpl} ${lang}: a long location wraps only at spaces or between CJK characters at 390 px`, async ({ page }) => {
      const out = make();
      out.resume.experience[0]!.location =
        lang === "en" ? LONG_EN : LONG_ZH;
      await generate(page, out, mdOriginal, outLang);
      await pickTemplate(page, tpl);
      await page.setViewportSize({ width: 390, height: 900 });
      const r = await preview(page).locator('[data-part="location"]').first().evaluate((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const chars: { ch: string; top: number; afterSpace: boolean }[] = [];
        let afterSpace = false;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const t = n as Text;
          for (let i = 0; i < t.length; i++) {
            const range = document.createRange();
            range.setStart(t, i);
            range.setEnd(t, i + 1);
            const rects = range.getClientRects();
            if (/\s/.test(t.data[i] as string)) afterSpace = true;
            else if (rects.length > 0) {
              chars.push({ ch: t.data[i] as string, top: Math.round(rects[0]!.top), afterSpace });
              afterSpace = false;
            }
          }
        }
        const cjk = /[㐀-鿿＀-￯]/;
        const inWord: string[] = [];
        for (let i = 1; i < chars.length; i++) {
          const a = chars[i - 1]!;
          const b = chars[i]!;
          if (b.top > a.top + 2 && !b.afterSpace && !cjk.test(a.ch) && !cjk.test(b.ch)) inWord.push(`${a.ch}|${b.ch}`);
        }
        return { lines: new Set(chars.map((c) => c.top)).size, inWord, text: el.textContent };
      });
      expect(r.lines, "the location wraps onto several lines at 390 px").toBeGreaterThan(1);
      expect(r.inWord, `breaks inside a word in "${r.text}"`).toEqual([]);
    });

    test(`criterion 7: ${tpl} ${lang}: a location next to a very long company name still wraps only at spaces or between CJK characters at 390 px`, async ({ page }) => {
      const out = make();
      out.resume.experience[0]!.company = lang === "en" ? LONG_CO_EN : LONG_CO_ZH;
      out.resume.experience[0]!.location = lang === "en" ? "Jurong Island Singapore" : "新加坡 裕廊岛";
      await generate(page, out, mdOriginal, outLang);
      await pickTemplate(page, tpl);
      await page.setViewportSize({ width: 390, height: 900 });
      const r = await preview(page).locator('[data-part="location"]').first().evaluate((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const chars: { ch: string; top: number; afterSpace: boolean }[] = [];
        let afterSpace = false;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const t = n as Text;
          for (let i = 0; i < t.length; i++) {
            const range = document.createRange();
            range.setStart(t, i);
            range.setEnd(t, i + 1);
            const rects = range.getClientRects();
            if (/\s/.test(t.data[i] as string)) afterSpace = true;
            else if (rects.length > 0) {
              chars.push({ ch: t.data[i] as string, top: Math.round(rects[0]!.top), afterSpace });
              afterSpace = false;
            }
          }
        }
        const cjk = /[㐀-鿿＀-￯]/;
        const inWord: string[] = [];
        for (let i = 1; i < chars.length; i++) {
          const a = chars[i - 1]!;
          const b = chars[i]!;
          if (b.top > a.top + 2 && !b.afterSpace && !cjk.test(a.ch) && !cjk.test(b.ch)) inWord.push(`${a.ch}|${b.ch}`);
        }
        return { lines: new Set(chars.map((c) => c.top)).size, inWord, text: el.textContent };
      });
      // (no wrap is required here: the short location may stay on one line next to the company name)
      expect(r.inWord, `breaks inside a word in "${r.text}"`).toEqual([]);
    });
  }
}
