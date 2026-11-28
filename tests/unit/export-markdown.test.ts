/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// resume-sg#12 criteria 1 and 2 (and the brief v5.2 adaptation): toMarkdown in the export module.
import { describe, expect, it } from "vitest";
import { toMarkdown } from "../../src/export/markdown.ts";
import { emptyResume } from "../../src/resume/model.ts";
import type { Resume } from "../../src/resume/model.ts";
import { sampleResume } from "../../src/resume/sample.ts";
import { EXPECTED_EN, EXPECTED_ZH } from "../fixtures/export-markdown.ts";

const lineList = (md: string) => md.split("\n");
/** Text with backslash escapes and HTML entities removed: what a Markdown reader would see as syntax. */
const syntaxOf = (s: string) => s.replace(/\\[\s\S]/g, "").replace(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi, "");

describe("criterion 1: exact Markdown for the synthetic sample", () => {
  it("English matches the fixture exactly", () => {
    expect(toMarkdown(sampleResume(), "en")).toBe(EXPECTED_EN);
  });
  it("Chinese matches the fixture exactly (zh section names, U+3000 between title and company, zh dates)", () => {
    expect(toMarkdown(sampleResume(), "zh")).toBe(EXPECTED_ZH);
  });
  it("empty sections are absent", () => {
    const r: Resume = { ...emptyResume(), basics: { ...emptyResume().basics, name: "Zed Sample" }, summary: "Short summary." };
    expect(toMarkdown(r, "en")).toBe("# Zed Sample\n\n## Summary\n\nShort summary.\n");
    const md = toMarkdown(r, "en");
    for (const h of ["Experience", "Education", "Skills", "Certificates", "Languages", "Projects"]) expect(md).not.toContain(`## ${h}`);
    const zh = toMarkdown(r, "zh");
    for (const h of ["工作经历", "教育背景", "专业技能", "证书", "语言", "项目经历"]) expect(zh).not.toContain(`## ${h}`);
  });
  it("a section whose entries are all blank is absent too", () => {
    const r = sampleResume();
    r.certificates = ["", "  "];
    r.languages = [];
    const md = toMarkdown(r, "en");
    expect(md).not.toContain("## Certificates");
    expect(md).not.toContain("## Languages");
  });
});

describe("brief v5.2: the resume-sections model", () => {
  it("follows the section order of resume.order", () => {
    const r = sampleResume();
    r.order = ["skills", "summary", "experience", "education", "certificates", "extras", "languages", "projects"];
    const md = toMarkdown(r, "en");
    expect(md.indexOf("## Skills")).toBeGreaterThan(-1);
    expect(md.indexOf("## Skills")).toBeLessThan(md.indexOf("## Summary"));
    expect(md.indexOf("## Summary")).toBeLessThan(md.indexOf("## Experience"));
  });
  it("roles of one company are grouped: the company once, then each role", () => {
    const r = sampleResume();
    r.experience = [
      { id: "a", company: "Example Logistics Pte Ltd", title: "Senior Operations Analyst", location: "", start: "2021-03", end: "", bullets: ["Built dashboards."] },
      { id: "b", company: "Example Logistics Pte Ltd", title: "Operations Analyst", location: "", start: "2019-01", end: "2021-02", bullets: ["Tracked shipments."] },
    ];
    const md = toMarkdown(r, "en");
    expect(md.split("Example Logistics Pte Ltd")).toHaveLength(2); // exactly one occurrence
    expect(md).toContain("Senior Operations Analyst");
    expect(md).toContain("Operations Analyst");
    expect(md.indexOf("Built dashboards.")).toBeLessThan(md.indexOf("Tracked shipments."));
    expect(md).toContain("Mar 2021 – Present");
    expect(md).toContain("Jan 2019 – Feb 2021");
  });
  it("a project nested under a role comes right after that role's bullets", () => {
    const r = sampleResume();
    r.projects = [
      { id: "p1", name: "Route Review", role: "Lead", org: "", start: "2022-01", end: "2022-06", tech: ["SQL"], bullets: ["Mapped picking routes."], experienceId: "exp-1" },
    ];
    const md = toMarkdown(r, "en");
    const at = md.indexOf("Route Review");
    expect(at).toBeGreaterThan(md.indexOf("Trained 20 new staff on the inventory system."));
    expect(at).toBeLessThan(md.indexOf("Operations Executive"));
    expect(md).toContain("Mapped picking routes.");
    expect(md).not.toContain("## Projects"); // nested, so no loose project exists
  });
  it("a loose project goes in the Projects section with 'Tech:' / '技术栈：'", () => {
    const r = sampleResume();
    r.projects = [{ id: "p2", name: "Dock Planner", role: "Owner", org: "Example Org", start: "2023-02", end: "2023-08", tech: ["Rust", "SQL"], bullets: ["Cut dock waiting time."], experienceId: "" }];
    const en = toMarkdown(r, "en");
    expect(en).toContain("## Projects");
    expect(en).toContain("Dock Planner");
    expect(en).toContain("Tech: Rust, SQL");
    expect(en).toContain("- Cut dock waiting time.");
    const zh = toMarkdown(r, "zh");
    expect(zh).toContain("## 项目经历");
    expect(zh).toContain("技术栈：Rust、SQL");
  });
  it("extras sections use their own heading and bullets", () => {
    const r = sampleResume();
    r.extras = [{ id: "x1", heading: "Awards", items: ["Safety Award 2022", "Team Award 2023"] }];
    const md = toMarkdown(r, "en");
    expect(md).toContain("## Awards");
    expect(md).toContain("- Safety Award 2022");
    expect(md).toContain("- Team Award 2023");
  });
});

describe("criterion 2: escaping user text", () => {
  const withBullet = (text: string): Resume => {
    const r = sampleResume();
    r.experience[0]!.bullets = [text];
    return r;
  };
  it("a bullet '[click](https://example.com)' is literal text: no link", () => {
    const md = toMarkdown(withBullet("[click](https://example.com)"), "en");
    expect(md).toContain("click");
    expect(md).toContain("https://example.com");
    const bulletLine = lineList(md).find((l) => l.startsWith("- ") && l.includes("click"))!;
    expect(bulletLine, "the bullet line").toBeTruthy();
    expect(syntaxOf(bulletLine)).not.toMatch(/\[[^\]]*\]\(/); // no [text](url) left once escapes are removed
    expect(syntaxOf(bulletLine)).not.toContain("[");
  });
  it("a name '# Admin <b>' is no second heading and no tag", () => {
    const r = sampleResume();
    r.basics.name = "# Admin <b>";
    const md = toMarkdown(r, "en");
    const first = lineList(md)[0]!;
    expect(first.startsWith("# ")).toBe(true);
    expect(first.slice(2).startsWith("#")).toBe(false); // the user's "#" is escaped
    expect(first).toContain("Admin");
    expect(syntaxOf(first)).not.toContain("<");
    expect(lineList(md).filter((l) => /^# /.test(l))).toHaveLength(1);
  });
  it("risky characters at risky positions never become syntax (*, _, #, [, `, <)", () => {
    const r = sampleResume();
    r.summary = "# Not a heading\n*not bold* and _not italic_ with `code` and <script>alert(1)</script>";
    r.experience[0]!.bullets = ["*starred* bullet", "_underlined_ bullet", "`ticked` bullet", "<img src=x> bullet", "[a](b) bullet"];
    r.experience[0]!.title = "Lead *Analyst*";
    r.skills[0]!.items = ["_C_", "[x]"];
    const md = toMarkdown(r, "en");
    expect(lineList(md).filter((l) => /^# /.test(l)), "only the name is a level-1 heading").toHaveLength(1);
    const userText = lineList(md).filter((l) => !/^#{1,3} /.test(l) || l.includes("Analyst"));
    for (const l of userText) {
      const s = syntaxOf(l.replace(/^### /, "").replace(/^- /, ""));
      expect(s, l).not.toMatch(/[*`<[]/);
      expect(s, l).not.toMatch(/(^|\s)_|_(\s|$)/);
    }
    for (const word of ["starred", "underlined", "ticked", "Not a heading", "alert(1)"]) expect(md).toContain(word);
  });
});
