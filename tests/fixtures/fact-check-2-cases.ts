/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// Fixtures for resume-sg#36 (fact-check 2): faithful cross-language outputs built from the
// #8 sample cases (synthetic). Sources stay exact substrings of the original; only the display
// text is in the other language. Faithful means: no red finding when checked cross-language.
import type { TailorOutput } from "../../src/ai/types.ts";
import { case1Output, case2Output } from "./fact-check-cases.ts";

/** Case 1 (English original) with a Chinese output. Brand names stay Latin and occur in the original. */
export function case1ZhOutput(): TailorOutput {
  const out = case1Output();
  const r = out.resume;
  r.basics.headline = "首席后端工程师 · 支付与清结算";
  r.summary = "9 年金融科技后端经验，负责支付与清结算服务，使用 Java、Kotlin 和 Kafka 构建事件驱动系统，并指导工程师。";
  const e = r.experience;
  e[0]!.title = "首席后端工程师";
  e[0]!.start = "2021.03";
  e[0]!.end = "至今";
  e[0]!.bullets[0]!.text = "重构清算服务，日终批处理时间从 4 小时缩短到 35 分钟。";
  e[0]!.bullets[1]!.text = "构建支持幂等键的支付 API，高峰期每秒处理 1,200 笔交易。";
  e[0]!.bullets[2]!.text = "引入契约测试和金丝雀发布，生产事故同比下降 40%。";
  e[0]!.bullets[3]!.text = "指导 5 名工程师，其中两人晋升为高级工程师。";
  e[1]!.title = "高级软件工程师";
  e[1]!.start = "2017.07";
  e[1]!.end = "2021.02";
  e[1]!.bullets[0]!.text = "将 14 个服务从单体迁移到 Kafka 事件，零停机。";
  e[1]!.bullets[1]!.text = "将账户服务 p99 延迟从 480 ms 降到 120 ms。";
  e[1]!.bullets[2]!.text = "构建风控规则引擎，服务 3 条产品线。";
  e[2]!.title = "软件工程师";
  e[2]!.start = "2015.07";
  e[2]!.end = "2017.06";
  e[2]!.bullets[0]!.text = "构建银行卡交易对账任务，人工核对减少 60%。";
  r.education[0]!.degree = "计算机科学工学学士";
  r.certificates[0]!.text = "AWS 认证解决方案架构师（助理级）(2022)";
  r.languages = ["英语", "普通话"];
  out.changes = [{ where: "summary", what: "已改写为中文。" }];
  return out;
}

/** Case 2 (Chinese original) with an English output. Company, title, school, degree and language items
 * stay as in the original (an English rendering would add Latin tokens the original does not contain). */
export function case2EnOutput(): TailorOutput {
  const out = case2Output();
  const r = out.resume;
  r.basics.headline = "Senior user operations, e-commerce growth";
  r.summary =
    "Focused on e-commerce new-user growth and first-order conversion: planned 12 acquisition campaigns, lifted first-order conversion from 6.2% to 9.1%, and raised 30-day recall by 35%. Reviews data with SQL every week and has run 3 A/B tests.";
  const e = r.experience;
  e[0]!.start = "2021.07";
  e[0]!.bullets[0]!.text = "Reworked the first-order flow and landing page with design; conversion rose from 6.2% to 9.1%.";
  e[0]!.bullets[1]!.text = "Planned 12 new-user acquisition campaigns.";
  e[0]!.bullets[2]!.text = "Built SMS and push win-back for churned users; 30-day recall up 35%.";
  e[0]!.bullets[3]!.text = "Weekly review with SQL and dashboards; gave product more than 20 suggestions.";
  e[1]!.bullets[0]!.text = "Supported the Southeast Asia site launch and wrote English campaign page copy and schedules.";
  e[1]!.bullets[1]!.text = "Ran 3 A/B tests on the effect of coupon value on orders.";
  out.changes = [{ where: "summary", what: "Rewritten in English." }];
  return out;
}
