// Fixtures for resume-sg#8 (fact-check). Synthetic people and companies only.
// Two cases from sample-cases.md (extra/): original text + a TailorOutput with correct sources.
// Every non-empty original line is covered by a `source` in resume or notIncluded, so the
// unmutated cases must give NO finding at all (red or amber).
import type { SourcedResume, TailorOutput } from "../../src/ai/types.ts";

export const emptySourced = (): SourcedResume => ({
  basics: { name: "", headline: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  experience: [],
  projects: [],
  education: [],
  certificates: [],
  skills: [],
  extras: [],
  languages: [],
  order: [],
});

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) deepFreeze(v);
  }
  return value;
}

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ---------------------------------------------------------------- Case 1 (English)
export const case1Original = `Jamie Lin — Backend Engineer
jamie.lin@example.com · +65 9000 0000 · github.com/jamielin-example
Summary: Backend engineer with 9 years of experience in fintech. I like building reliable systems and working with people.
Experience:
1. Lead Backend Engineer — Harborline Payments — Mar 2021 – Present
   - Redesigned the settlement service; end-of-day batch time went from 4 hours to 35 minutes.
   - Built a payment API with idempotency keys; it handles 1,200 transactions per second at peak.
   - Introduced contract tests and canary releases; production incidents fell 40% year on year.
   - Mentored 5 engineers; two were promoted to senior.
   - Organised the company hackathon for 60 participants.
   - Maintained the team's wiki and onboarding pages.
2. Senior Software Engineer — Lumen Fintech — Jul 2017 – Feb 2021
   - Built the risk-rule engine used by 3 product lines.
   - Moved 14 services from a monolith to Kafka events with zero downtime.
   - Reduced p99 latency of the account service from 480 ms to 120 ms.
   - Wrote internal tools for log search.
3. Software Engineer — Eastgate Bank Technology — Jul 2015 – Jun 2017
   - Built reconciliation jobs for card transactions; manual checks fell by 60%.
   - Supported the release of a mobile banking feature.
Education: B.Eng. Computer Science — Example University — 2011 – 2015
Skills: Java, Kotlin, SQL, Spring Boot, Kafka, gRPC, AWS, Docker, Kubernetes, React
Certificates: AWS Certified Solutions Architect – Associate (2022)
Languages: English, Mandarin
`;

export const case1Hackathon = "Organised the company hackathon for 60 participants.";

export function case1Output(): TailorOutput {
  const resume = emptySourced();
  resume.basics = {
    name: "Jamie Lin",
    headline: "Lead Backend Engineer · Payments and settlement",
    email: "jamie.lin@example.com",
    phone: "+65 9000 0000",
    location: "",
    links: ["github.com/jamielin-example"],
  };
  resume.summary =
    "Backend engineer with 9 years in fintech, building payment and settlement services in Java and Kotlin, event-driven systems on Kafka and safer releases, and mentoring engineers.";
  resume.experience = [
    {
      id: "e1",
      company: "Harborline Payments",
      title: "Lead Backend Engineer",
      location: "",
      start: "Mar 2021",
      end: "Present",
      source: "Lead Backend Engineer — Harborline Payments — Mar 2021 – Present",
      bullets: [
        {
          text: "Redesigned the settlement service, cutting end-of-day batch time from 4 hours to 35 minutes.",
          source: "Redesigned the settlement service; end-of-day batch time went from 4 hours to 35 minutes.",
        },
        {
          text: "Built an idempotent payment API (idempotency keys) that handles 1,200 transactions per second at peak.",
          source: "Built a payment API with idempotency keys; it handles 1,200 transactions per second at peak.",
        },
        {
          text: "Introduced contract tests and canary releases; production incidents fell 40% year on year.",
          source: "Introduced contract tests and canary releases; production incidents fell 40% year on year.",
        },
        {
          text: "Mentored 5 engineers, two of whom were promoted to senior.",
          source: "Mentored 5 engineers; two were promoted to senior.",
        },
      ],
    },
    {
      id: "e2",
      company: "Lumen Fintech",
      title: "Senior Software Engineer",
      location: "",
      start: "Jul 2017",
      end: "Feb 2021",
      source: "Senior Software Engineer — Lumen Fintech — Jul 2017 – Feb 2021",
      bullets: [
        {
          text: "Moved 14 services from a monolith to Kafka events with zero downtime.",
          source: "Moved 14 services from a monolith to Kafka events with zero downtime.",
        },
        {
          text: "Reduced p99 latency of the account service from 480 ms to 120 ms.",
          source: "Reduced p99 latency of the account service from 480 ms to 120 ms.",
        },
        {
          text: "Built the risk-rule engine used by 3 product lines.",
          source: "Built the risk-rule engine used by 3 product lines.",
        },
      ],
    },
    {
      id: "e3",
      company: "Eastgate Bank Technology",
      title: "Software Engineer",
      location: "",
      start: "Jul 2015",
      end: "Jun 2017",
      source: "Software Engineer — Eastgate Bank Technology — Jul 2015 – Jun 2017",
      bullets: [
        {
          text: "Built reconciliation jobs for card transactions, reducing manual checks by 60%.",
          source: "Built reconciliation jobs for card transactions; manual checks fell by 60%.",
        },
      ],
    },
  ];
  resume.education = [
    {
      id: "d1",
      school: "Example University",
      degree: "B.Eng. Computer Science",
      start: "2011",
      end: "2015",
      details: [],
      source: "B.Eng. Computer Science — Example University — 2011 – 2015",
    },
  ];
  resume.certificates = [
    {
      text: "AWS Certified Solutions Architect – Associate (2022)",
      source: "AWS Certified Solutions Architect – Associate (2022)",
    },
  ];
  resume.skills = [
    { id: "s1", name: "Languages", items: ["Java", "Kotlin", "SQL"] },
    { id: "s2", name: "Backend", items: ["Spring Boot", "Kafka", "gRPC"] },
    { id: "s3", name: "Cloud", items: ["AWS", "Docker", "Kubernetes"] },
  ];
  resume.languages = ["English", "Mandarin"];
  resume.order = ["summary", "experience", "education", "skills", "certificates", "languages"];
  return {
    resume,
    changes: [{ where: "summary", what: "Rewritten for this job." }],
    notIncluded: [
      { source: "Jamie Lin — Backend Engineer" },
      { source: "jamie.lin@example.com · +65 9000 0000 · github.com/jamielin-example" },
      {
        source:
          "Summary: Backend engineer with 9 years of experience in fintech. I like building reliable systems and working with people.",
      },
      { source: case1Hackathon },
      { source: "Maintained the team's wiki and onboarding pages." },
      { source: "Wrote internal tools for log search." },
      { source: "Supported the release of a mobile banking feature." },
      { source: "React" },
      { source: "Languages: English, Mandarin" },
    ],
  };
}

// ---------------------------------------------------------------- Case 2 (中文)
export const case2Original = `王小雨 · 求职意向：运营
xiaoyu.wang@example.com · +65 9000 0001
自我评价：工作认真负责，学习能力强，有团队精神，性格开朗。
工作经历：
1. 高级用户运营 · 青禾生活（电商平台）· 2021.07 – 至今
   - 负责新用户拉新活动，策划了 12 场活动，新增注册用户 18 万。
   - 优化新人首单流程，和设计一起改版落地页，首单转化率从 6.2% 提升到 9.1%。
   - 搭建流失用户的短信和推送召回策略，30 天召回率提升 35%。
   - 每周用 SQL 和数据看板做复盘，给产品提了 20 多条改进建议。
   - 负责公司公众号日常更新。
   - 组织部门年会。
2. 运营助理 · 北岸科技 · 2019.07 – 2021.06
   - 参与东南亚站点的上线运营，负责英文活动页的文案和排期。
   - 做过 3 次 A/B 测试，测试优惠券面额对下单的影响。
   - 整理用户反馈，每月输出反馈报告。
教育背景：市场营销 管理学学士 · 示例财经大学 · 2015 – 2019
技能：SQL、Excel、A/B 测试、数据看板、Figma、剪映
语言：英语（工作语言）、普通话（母语）
`;

export const case2Annual = "组织部门年会。";

export function case2Output(): TailorOutput {
  const resume = emptySourced();
  resume.basics = {
    name: "王小雨",
    headline: "高级用户运营 · 电商用户增长",
    email: "xiaoyu.wang@example.com",
    phone: "+65 9000 0001",
    location: "",
    links: [],
  };
  resume.summary =
    "专注电商新用户增长和首单转化：策划 12 场拉新活动，新增注册用户 18 万；首单转化率从 6.2% 提升到 9.1%；流失用户 30 天召回率提升 35%。每周用 SQL 做数据复盘，做过 A/B 测试，参与过东南亚站点上线运营，英语可作为工作语言。";
  resume.experience = [
    {
      id: "e1",
      company: "青禾生活",
      title: "高级用户运营",
      location: "",
      start: "2021.07",
      end: "至今",
      source: "高级用户运营 · 青禾生活（电商平台）· 2021.07 – 至今",
      bullets: [
        {
          text: "优化新人首单流程，与设计协作改版落地页，首单转化率从 6.2% 提升到 9.1%。",
          source: "优化新人首单流程，和设计一起改版落地页，首单转化率从 6.2% 提升到 9.1%。",
        },
        {
          text: "策划 12 场新用户拉新活动，新增注册用户 18 万。",
          source: "负责新用户拉新活动，策划了 12 场活动，新增注册用户 18 万。",
        },
        {
          text: "搭建流失用户的短信和推送召回策略，30 天召回率提升 35%。",
          source: "搭建流失用户的短信和推送召回策略，30 天召回率提升 35%。",
        },
        {
          text: "每周用 SQL 和数据看板复盘，向产品提出 20 多条改进建议。",
          source: "每周用 SQL 和数据看板做复盘，给产品提了 20 多条改进建议。",
        },
      ],
    },
    {
      id: "e2",
      company: "北岸科技",
      title: "运营助理",
      location: "",
      start: "2019.07",
      end: "2021.06",
      source: "运营助理 · 北岸科技 · 2019.07 – 2021.06",
      bullets: [
        {
          text: "参与东南亚站点上线运营，负责英文活动页的文案和排期。",
          source: "参与东南亚站点的上线运营，负责英文活动页的文案和排期。",
        },
        {
          text: "完成 3 次 A/B 测试，验证优惠券面额对下单的影响。",
          source: "做过 3 次 A/B 测试，测试优惠券面额对下单的影响。",
        },
      ],
    },
  ];
  resume.education = [
    {
      id: "d1",
      school: "示例财经大学",
      degree: "市场营销 管理学学士",
      start: "2015",
      end: "2019",
      details: [],
      source: "市场营销 管理学学士 · 示例财经大学 · 2015 – 2019",
    },
  ];
  resume.skills = [
    { id: "s1", name: "数据分析", items: ["SQL", "Excel", "数据看板"] },
    { id: "s2", name: "实验", items: ["A/B 测试"] },
    { id: "s3", name: "设计协作", items: ["Figma"] },
  ];
  resume.languages = ["英语（工作语言）", "普通话（母语）"];
  resume.order = ["summary", "experience", "education", "skills", "languages"];
  return {
    resume,
    changes: [{ where: "summary", what: "改写为个人简介。" }],
    notIncluded: [
      { source: "王小雨 · 求职意向：运营" },
      { source: "xiaoyu.wang@example.com · +65 9000 0001" },
      { source: "工作认真负责，学习能力强，有团队精神，性格开朗。" },
      { source: "负责公司公众号日常更新。" },
      { source: case2Annual },
      { source: "整理用户反馈，每月输出反馈报告。" },
      { source: "剪映" },
      { source: "语言：英语（工作语言）、普通话（母语）" },
    ],
  };
}
