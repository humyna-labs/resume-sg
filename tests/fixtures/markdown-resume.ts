// resume-sg#47: a Chinese resume written in markdown (headings, ---, bold, dates on their own line, a project built
// from an experience bullet) with a faithful zh output and a faithful en output. Synthetic person and companies.
//
// Expected result of factCheck on each pair (listed in tests/unit/result-fixes-markdown.test.ts):
//   zh -> zh: no finding at all.
//   zh -> en: no red finding; exactly one amber, kind "basics" (the translated name, as in #36).
import { DEFAULT_ORDER } from "../../src/resume/model.ts";
import type { TailorOutput } from "../../src/ai/types.ts";
import { emptySourced } from "./fact-check-cases.ts";

export const MD_NAME_LINE = "# 陈海";
export const MD_RULE = "---";
export const MD_BULLET_PROJECT = "- 主导商户对账项目，对账差异率降低 60%。";

export const mdOriginal = [
  "# 陈海",
  "**邮箱**：chen.hai@example.com · 电话：+65 9000 0001",
  "",
  "---",
  "",
  "## 个人简介",
  "",
  "后端工程师，8 年支付系统经验，熟悉清算与对账。",
  "",
  "---",
  "",
  "## 工作经历",
  "",
  "### 海港支付 · 高级后端工程师 · 新加坡",
  "",
  "2021.03 - 至今",
  "",
  "- 重构清算服务，日终批处理耗时从 4 小时降到 35 分钟。",
  "- 设计幂等支付接口，高峰期每秒处理 1200 笔交易。",
  MD_BULLET_PROJECT,
  "",
  "### 星河科技 · 后端工程师",
  "",
  "2017.07 - 2021.02",
  "",
  "- 搭建规则引擎，使用 LiteFlow 编排，覆盖 3 条产品线。",
  "",
  "---",
  "",
  "## 教育背景",
  "",
  "**示例大学** · 计算机科学 学士 · 2013.09 - 2017.06",
  "",
  "---",
  "",
  "## 专业技能",
  "",
  "Java、Kafka、LiteFlow、Docker",
  "",
].join("\n");

const E1_SOURCE = [
  "### 海港支付 · 高级后端工程师 · 新加坡",
  "",
  "2021.03 - 至今",
  "",
  "- 重构清算服务，日终批处理耗时从 4 小时降到 35 分钟。",
  "- 设计幂等支付接口，高峰期每秒处理 1200 笔交易。",
].join("\n");
const E2_SOURCE = ["### 星河科技 · 后端工程师", "", "2017.07 - 2021.02", "", "- 搭建规则引擎，使用 LiteFlow 编排，覆盖 3 条产品线。"].join("\n");
const EDU_SOURCE = "**示例大学** · 计算机科学 学士 · 2013.09 - 2017.06";
const NOT_INCLUDED = [
  { source: "# 陈海" },
  { source: "**邮箱**：chen.hai@example.com · 电话：+65 9000 0001" },
  { source: "后端工程师，8 年支付系统经验，熟悉清算与对账。" },
  { source: "Java、Kafka、LiteFlow、Docker" },
];

/** A faithful Chinese output: one role per company, a project taken from the first role's third bullet. */
export function mdZhOutput(): TailorOutput {
  const resume = emptySourced();
  resume.basics = { name: "陈海", headline: "高级后端工程师", email: "chen.hai@example.com", phone: "+65 9000 0001", location: "", links: [] };
  resume.summary = "后端工程师，8 年支付系统经验，熟悉清算与对账。";
  resume.experience = [
    {
      id: "e1", company: "海港支付", title: "高级后端工程师", location: "新加坡", start: "2021.03", end: "至今", source: E1_SOURCE,
      bullets: [
        { text: "重构清算服务，日终批处理耗时从 4 小时降到 35 分钟。", source: "- 重构清算服务，日终批处理耗时从 4 小时降到 35 分钟。" },
        { text: "设计幂等支付接口，高峰期每秒处理 1200 笔交易。", source: "- 设计幂等支付接口，高峰期每秒处理 1200 笔交易。" },
      ],
    },
    {
      id: "e2", company: "星河科技", title: "后端工程师", location: "", start: "2017.07", end: "2021.02", source: E2_SOURCE,
      bullets: [{ text: "搭建规则引擎，使用 LiteFlow 编排，覆盖 3 条产品线。", source: "- 搭建规则引擎，使用 LiteFlow 编排，覆盖 3 条产品线。" }],
    },
  ];
  resume.projects = [
    {
      id: "p1", name: "商户对账", role: "", org: "", start: "", end: "", tech: ["Java"], experienceId: "e1",
      source: MD_BULLET_PROJECT,
      bullets: [{ text: "对账差异率降低 60%。", source: MD_BULLET_PROJECT }],
    },
  ];
  resume.education = [
    { id: "d1", school: "示例大学", degree: "计算机科学 学士", start: "2013.09", end: "2017.06", details: [], source: EDU_SOURCE },
  ];
  resume.skills = [{ id: "s1", name: "技能", items: ["Java", "Kafka", "LiteFlow", "Docker"] }];
  resume.order = [...DEFAULT_ORDER];
  return { resume, changes: [{ where: "projects[0]", what: "把一条工作要点单列为项目。" }], notIncluded: NOT_INCLUDED };
}

/** A faithful English output for the same original (translated; sources stay Chinese). */
export function mdEnOutput(): TailorOutput {
  const resume = emptySourced();
  resume.basics = { name: "Chen Hai", headline: "Senior Backend Engineer", email: "chen.hai@example.com", phone: "+65 9000 0001", location: "", links: [] };
  resume.summary = "Backend engineer with 8 years in payment systems, experienced in settlement and reconciliation.";
  resume.experience = [
    {
      id: "e1", company: "Harbour Pay", title: "Senior Backend Engineer", location: "Singapore", start: "2021-03", end: "present", source: E1_SOURCE,
      bullets: [
        { text: "Rebuilt the settlement service, cutting end-of-day batch time from 4 hours to 35 minutes.", source: "- 重构清算服务，日终批处理耗时从 4 小时降到 35 分钟。" },
        { text: "Designed an idempotent payment API handling 1200 transactions per second at peak.", source: "- 设计幂等支付接口，高峰期每秒处理 1200 笔交易。" },
      ],
    },
    {
      id: "e2", company: "Stellar Tech", title: "Backend Engineer", location: "", start: "2017-07", end: "2021-02", source: E2_SOURCE,
      bullets: [{ text: "Built a rule engine orchestrated with LiteFlow, covering 3 product lines.", source: "- 搭建规则引擎，使用 LiteFlow 编排，覆盖 3 条产品线。" }],
    },
  ];
  resume.projects = [
    {
      id: "p1", name: "Merchant reconciliation", role: "", org: "", start: "", end: "", tech: ["Java"], experienceId: "e1",
      source: MD_BULLET_PROJECT,
      bullets: [{ text: "Reduced the reconciliation difference rate by 60%.", source: MD_BULLET_PROJECT }],
    },
  ];
  resume.education = [
    { id: "d1", school: "Example University", degree: "BSc Computer Science", start: "2013-09", end: "2017-06", details: [], source: EDU_SOURCE },
  ];
  resume.skills = [{ id: "s1", name: "Skills", items: ["Java", "Kafka", "LiteFlow", "Docker"] }];
  resume.order = [...DEFAULT_ORDER];
  return { resume, changes: [{ where: "projects[0]", what: "Split one experience bullet into a project." }], notIncluded: NOT_INCLUDED };
}
