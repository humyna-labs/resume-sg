// resume-sg#56 criteria 5 and 10 in a real browser: a long synthetic resume gets a cut-off answer (stop_reason max_tokens)
// as a server-sent-event stream. One request, the specific message, input kept, only api.anthropic.com contacted.
// Test hooks: see tests/unit/flow-helpers.tsx and tests/unit/ai-output-budget.test.tsx.
import { expect, test } from "@playwright/test";
import { sseBody } from "../fixtures/sse.ts";
import { JD_EN } from "../fixtures/tailor-flow.ts";
import { walkToStep4 } from "./flow-helpers.ts";

const API = "https://api.anthropic.com/v1/messages";
const KEY = "sk-ant-fakekey-abcd3f9a";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};
const CUTOFF = {
  en: "The AI's answer was too long and was cut off. Your input is still here. Remove experience that does not matter for this job and try again, or use the Balanced mode.",
  zh: "AI 的回答太长，被截断了。你的输入都还在。可以删掉与这个职位无关的经历后再试，或换用「均衡」方式。",
};
const LONG_RESUME = Array.from(
  { length: 60 },
  (_, i) => `Example Systems ${i + 1} · Backend Engineer · Alex Example\n- Built service ${i + 1} used by ${i + 2} teams; cut p95 latency by ${i + 5} ms.`,
).join("\n");

for (const lang of ["en", "zh"] as const) {
  test.describe(`cut-off answer ${lang}`, () => {
    test.use({ locale: lang === "zh" ? "zh-CN" : "en-US" });

    test("one request, the specific message, no retry, input kept, only api.anthropic.com besides the page", async ({ page, baseURL }) => {
      const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
      const requests: string[] = [];
      page.on("request", (q) => requests.push(q.url()));
      const posts: string[] = [];
      let sentBody: Record<string, unknown> = {};
      await page.route(API, async (route) => {
        const req = route.request();
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
        posts.push(req.url());
        sentBody = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
        return route.fulfill({
          status: 200,
          headers: { ...CORS, "content-type": "text/event-stream" },
          body: sseBody({ text: '{"resume":{"basics":{"name":"Alex', thinking: ["hm"], stopReason: "max_tokens", outputTokens: 32000 }),
        });
      });

      await page.goto("/#/app");
      await walkToStep4(page, LONG_RESUME, JD_EN, KEY);
      await page.getByRole("button", { name: /^(Generate tailored resume|生成定制简历)$/ }).click();
      await expect(page.getByRole("main")).toContainText(CUTOFF[lang].replace(/\s+/g, " "));
      await page.waitForTimeout(500);

      expect(posts).toHaveLength(1);
      expect(sentBody["stream"]).toBe(true);
      expect(sentBody["max_tokens"]).toBe(32000);
      for (const k of ["thinking", "effort", "output_config"]) expect(k in sentBody).toBe(false);

      // collapsed technical details
      const details = page.locator("main details").filter({ hasText: /Technical details|技术细节/ });
      await expect(details).toHaveCount(1);
      await expect(details).not.toHaveAttribute("open", /.*/);

      // the input is kept
      await page.getByRole("button", { name: /^(← Back|← 上一步)$/ }).click();
      await page.getByRole("button", { name: /^(← Back|← 上一步)$/ }).click();
      await page.getByRole("button", { name: /^(← Back|← 上一步)$/ }).click();
      await expect(page.getByLabel(/^(Your current resume|你的原始简历)/)).toHaveValue(LONG_RESUME);

      const foreign = requests.filter((u) => !u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:"));
      for (const u of foreign) expect(new URL(u).host).toBe("api.anthropic.com");
    });
  });
}
