// resume-sg#48 criterion 8: network proof and screenshots of the "Match analysis" tab, 1440 and 390 px, both languages.
// page.route fulfils api.anthropic.com; the match call is told apart by its system prompt (it names jdQuote).
// Hooks: tests/unit/match-analysis.test.tsx (tab, button names; data-testid="match-strength").
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { JD_MATCH, matchBody, matchWithInventedStrength } from "../fixtures/match.ts";
import { apiBody, ORIGINAL_EN, validOutput } from "../fixtures/tailor-flow.ts";

const API = "https://api.anthropic.com/v1/messages";
const KEY = "sk-ant-fakekey-abcd3f9a";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};
const L = {
  en: { resume: "Your current resume", jd: "Job description", key: "Anthropic API key", generate: "Generate tailored resume", tab: /Match analysis/, run: "Generate match analysis", footer: "AI analysis for reference only" },
  zh: { resume: "你的原始简历", jd: "职位描述（JD）", key: "Anthropic API key（密钥）", generate: "生成定制简历", tab: /匹配分析/, run: "生成匹配分析", footer: "AI 分析仅供参考" },
} as const;

async function fakeApi(page: Page, posts: { kind: "main" | "match"; body: string }[]) {
  await page.route(API, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = req.postData() ?? "";
    const isMatch = (JSON.parse(body) as { system?: string }).system?.includes("jdQuote") === true;
    posts.push({ kind: isMatch ? "match" : "main", body });
    return route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "text/event-stream" },
      body: apiBody(isMatch ? matchBody(matchWithInventedStrength()) : JSON.stringify(validOutput())),
    });
  });
}

for (const lang of ["en", "zh"] as const) {
  for (const width of [1440, 390]) {
    test.describe(`match analysis ${lang} ${width}px`, () => {
      test.use({ locale: lang === "zh" ? "zh-CN" : "en-US", viewport: { width, height: width === 1440 ? 900 : 844 } });

      test("criterion 8: nothing leaves the page until the button is clicked, then exactly one more request; screenshots", async ({ page, baseURL }) => {
        const c = L[lang];
        const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
        const requests: string[] = [];
        page.on("request", (q) => requests.push(q.url()));
        const posts: { kind: "main" | "match"; body: string }[] = [];
        await fakeApi(page, posts);

        await page.goto("/#/app");
        await page.getByLabel(c.resume).fill(ORIGINAL_EN);
        await page.getByTestId("step-next").click();
        await page.getByLabel(c.jd).fill(JD_MATCH);
        await page.getByTestId("step-next").click();
        await page.getByTestId("step-next").click();
        await page.getByLabel(c.key).fill(KEY);
        await page.getByRole("button", { name: c.generate }).click();
        await expect(page.getByTestId("tailor-result")).toBeVisible();

        const foreign = () => requests.filter((u) => !u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith(API));
        const tab = page.getByRole("tab", { name: c.tab });
        await expect(tab).toBeVisible();
        expect(posts.map((p) => p.kind)).toEqual(["main"]);
        await tab.click();
        await expect(page.getByRole("tabpanel").getByRole("button", { name: c.run })).toBeVisible();
        await page.screenshot({ path: `test-results/match-${lang}-${width}-before.png`, fullPage: true });
        // opening the tab sends nothing
        expect(posts.map((p) => p.kind)).toEqual(["main"]);
        expect(foreign()).toEqual([]);

        await page.getByRole("tabpanel").getByRole("button", { name: c.run }).click();
        await expect(page.getByTestId("match-strength").first()).toBeVisible();
        await expect(page.getByTestId("match-question")).toHaveCount(5);
        await expect(page.getByRole("tabpanel")).toContainText(c.footer);
        await page.screenshot({ path: `test-results/match-${lang}-${width}-analysis.png`, fullPage: true });

        expect(posts.map((p) => p.kind)).toEqual(["main", "match"]);
        expect(foreign()).toEqual([]);
        // the key never appears in a request body
        for (const p of posts) expect(p.body).not.toContain(KEY);
        // no horizontal scroll on the phone
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });
    });
  }
}
