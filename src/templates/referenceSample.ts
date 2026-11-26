import { DEFAULT_ORDER } from "../resume/model.ts";
import type { Resume } from "../resume/model.ts";

/** Synthetic person from the owner-approved reference (templates-reference.html). */
export function referenceSample(lang: "en" | "zh"): Resume {
  if (lang === "zh") {
    return {
      basics: {
        name: "林嘉明",
        headline: "高级后端工程师 · 支付方向",
        email: "jamie.lin@example.com",
        phone: "+65 9000 0000",
        location: "新加坡",
        links: ["github.com/jamielin-example"],
      },
      summary:
        "9 年支付与金融科技平台后端经验。擅长用 Java 和 Spring 构建高吞吐交易服务，主导过向事件驱动架构的迁移，带过 4 到 6 人的工程团队。",
      experience: [
        {
          id: "exp-1",
          company: "海港支付",
          title: "后端技术负责人",
          location: "新加坡",
          start: "2021-03",
          end: "",
          bullets: [
            "主导清算服务重构，日终批处理时间从 4 小时缩短到 35 分钟。",
            "设计并实现幂等支付接口，峰值处理每秒 1,200 笔交易。",
            "引入契约测试和灰度发布，线上事故同比下降 40%。",
            "辅导 5 名工程师，其中 2 人晋升为高级工程师。",
          ],
        },
        {
          id: "exp-2",
          company: "流明金融科技",
          title: "高级软件工程师",
          location: "上海",
          start: "2017-07",
          end: "2021-02",
          bullets: [
            "设计风控规则引擎，支撑 3 条产品线。",
            "将 14 个服务从单体迁移到基于 Kafka 的事件架构，全程零停机。",
            "账户服务 p99 延迟从 480 毫秒降到 120 毫秒。",
          ],
        },
        {
          id: "exp-3",
          company: "东门银行科技",
          title: "软件工程师",
          location: "上海",
          start: "2015-07",
          end: "2017-06",
          bullets: ["开发银行卡交易对账任务，人工核对工作量减少 60%。"],
        },
      ],
      education: [
        { id: "edu-1", school: "示例大学", degree: "计算机科学 工学学士", start: "2011", end: "2015", details: [] },
      ],
      certificates: ["AWS 认证解决方案架构师 – 助理级（2022）"],
      skills: [
        { id: "skill-1", name: "编程语言", items: ["Java", "Kotlin", "SQL"] },
        { id: "skill-2", name: "框架", items: ["Spring Boot", "Kafka", "gRPC"] },
        { id: "skill-3", name: "云与容器", items: ["AWS", "Docker", "Kubernetes"] },
        { id: "skill-4", name: "工程实践", items: ["DDD", "TDD", "可观测性"] },
      ],
      languages: ["英语（工作语言）", "普通话（母语）"],
      projects: [],
      extras: [],
      order: [...DEFAULT_ORDER],
    };
  }
  return {
    basics: {
      name: "Jamie Lin",
      headline: "Senior Backend Engineer · Payments",
      email: "jamie.lin@example.com",
      phone: "+65 9000 0000",
      location: "Singapore",
      links: ["github.com/jamielin-example"],
    },
    summary:
      "Backend engineer with 9 years in payments and fintech platforms. Builds high-throughput transaction services in Java and Spring, leads migrations to event-driven architecture, and mentors teams of 4–6 engineers.",
    experience: [
      {
        id: "exp-1",
        company: "Harborline Payments",
        title: "Lead Backend Engineer",
        location: "Singapore",
        start: "2021-03",
        end: "",
        bullets: [
          "Led the redesign of the settlement service, cutting end-of-day batch time from 4 hours to 35 minutes.",
          "Built an idempotent payment API that handles 1,200 transactions per second at peak.",
          "Introduced contract tests and canary releases; production incidents fell 40% year on year.",
          "Mentored 5 engineers, two of whom were promoted to senior.",
        ],
      },
      {
        id: "exp-2",
        company: "Lumen Fintech",
        title: "Senior Software Engineer",
        location: "Shanghai",
        start: "2017-07",
        end: "2021-02",
        bullets: [
          "Designed the risk-rule engine used by 3 product lines.",
          "Moved 14 services from a monolith to Kafka-based events with zero downtime.",
          "Cut p99 latency of the account service from 480 ms to 120 ms.",
        ],
      },
      {
        id: "exp-3",
        company: "Eastgate Bank Technology",
        title: "Software Engineer",
        location: "Shanghai",
        start: "2015-07",
        end: "2017-06",
        bullets: ["Built reconciliation jobs for card transactions, reducing manual checks by 60%."],
      },
    ],
    education: [
      { id: "edu-1", school: "Example University", degree: "B.Eng. Computer Science", start: "2011", end: "2015", details: [] },
    ],
    certificates: ["AWS Certified Solutions Architect – Associate (2022)"],
    skills: [
      { id: "skill-1", name: "Languages", items: ["Java", "Kotlin", "SQL"] },
      { id: "skill-2", name: "Frameworks", items: ["Spring Boot", "Kafka", "gRPC"] },
      { id: "skill-3", name: "Cloud", items: ["AWS", "Docker", "Kubernetes"] },
      { id: "skill-4", name: "Practices", items: ["DDD", "TDD", "observability"] },
    ],
    languages: ["English (professional)", "Mandarin (native)"],
    projects: [],
    extras: [],
    order: [...DEFAULT_ORDER],
  };
}
