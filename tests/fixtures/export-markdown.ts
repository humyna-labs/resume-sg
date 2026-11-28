// resume-sg#12: the exact Markdown that toMarkdown(sampleResume(), lang) must return. Synthetic data ("Alex Example").
// Layout rules these strings pin down (the issue leaves them open):
//  - blocks are separated by exactly one blank line, the text ends with one "\n"
//  - name, headline and contact line come first; the contact line is email, phone, location, links joined with " · "
//  - each section is "## <name>"; names are the SECTION_NAMES of the output language
//  - an experience entry is "### <title> — <company>" (zh: "### <title><U+3000><company>"), then the date line
//    from formatRange(start, end, lang), then "- " bullets; the location is not printed
//  - an education entry is "### <school> — <degree>" (zh: U+3000), a date line, then its details as "- " bullets
//  - a skill group is one "- " bullet: "Name: a, b" (zh: "Name：a、b")
//  - certificates are "- " bullets; languages are one plain line joined with ", " (zh: "；")
const SUMMARY = "Operations analyst with six years in logistics, focused on process improvement and clear reporting for warehouse teams.";

const lines = (...blocks: string[]): string => blocks.join("\n\n") + "\n";

export const EXPECTED_EN = lines(
  "# Alex Example",
  "Operations Analyst",
  "alex@example.com · +65 9000 0000 · Singapore · linkedin.com/in/alex-example",
  "## Summary",
  SUMMARY,
  "## Experience",
  "### Senior Operations Analyst — Example Logistics Pte Ltd",
  "Mar 2021 – Present",
  [
    "- Built weekly dashboards that cut report preparation time by half.",
    "- Led a three-person team reviewing warehouse picking routes.",
    "- Trained 20 new staff on the inventory system.",
  ].join("\n"),
  "### Operations Executive — Sample Freight Services Pte Ltd",
  "Jun 2018 – Feb 2021",
  ["- Coordinated daily shipments for 12 regional customers.", "- Reduced delivery exceptions through a simple tracking checklist."].join("\n"),
  "## Education",
  "### Example University — BSc Supply Chain Management",
  "2014 – 2018",
  ["- Second-class upper honours", "- Dean's list, two semesters"].join("\n"),
  "## Skills",
  ["- Analysis: Excel, SQL, Process mapping", "- Software: Power BI, Jira"].join("\n"),
  "## Certificates",
  "- Certified Supply Chain Analyst (example)",
  "## Languages",
  "English (fluent), Mandarin (fluent)",
);

export const EXPECTED_ZH = lines(
  "# Alex Example",
  "Operations Analyst",
  "alex@example.com · +65 9000 0000 · Singapore · linkedin.com/in/alex-example",
  "## 个人简介",
  SUMMARY,
  "## 工作经历",
  "### Senior Operations Analyst　Example Logistics Pte Ltd",
  "2021.03 – 至今",
  [
    "- Built weekly dashboards that cut report preparation time by half.",
    "- Led a three-person team reviewing warehouse picking routes.",
    "- Trained 20 new staff on the inventory system.",
  ].join("\n"),
  "### Operations Executive　Sample Freight Services Pte Ltd",
  "2018.06 – 2021.02",
  ["- Coordinated daily shipments for 12 regional customers.", "- Reduced delivery exceptions through a simple tracking checklist."].join("\n"),
  "## 教育背景",
  "### Example University　BSc Supply Chain Management",
  "2014 – 2018",
  ["- Second-class upper honours", "- Dean's list, two semesters"].join("\n"),
  "## 专业技能",
  ["- Analysis：Excel、SQL、Process mapping", "- Software：Power BI、Jira"].join("\n"),
  "## 证书",
  "- Certified Supply Chain Analyst (example)",
  "## 语言",
  "English (fluent)；Mandarin (fluent)",
);
