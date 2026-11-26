/* eslint-disable @typescript-eslint/no-non-null-assertion */
// resume-sg#29 criteria 3, 5, 8 (unit, both templates, both output languages) and the order rendering of criterion 2.
//
// DOM contract the templates must provide (shared by unit and e2e tests; the issue leaves markup open):
//   root [data-template]; each section is <section data-section="summary|experience|projects|education|skills|
//     certificates|languages"> (an extras entry is data-section="extra") with its own <h2>.
//   Experience group: [data-group] > [data-level="company"] (parts: [data-part="company"], [data-part="location"],
//     [data-part="dates"]) then, per role, [data-level="role"] (parts "title", "dates") followed by its bullets <li>.
//   Nested project: [data-nest] (thin left rule) > [data-level="project"] (parts "tag" = "Project" / "项目", "name", "dates")
//     then its bullets <li>, placed right after the bullets of the role it belongs to.
//   Standalone project (Projects section): [data-level="project-standalone"] (parts "name", "meta" = "role · org", "dates"),
//     then [data-part="tech"] (a "tech-label" "Tech:" / "技术栈" and one "tech-tag" per item), then bullets <li>.
//   Education: [data-level="education"] (parts "school", "degree", "dates"), then [data-part="details"] (details joined " · ").
//   Modern skills: one [data-part="chip"] per skill item. Extras: <li> per item. Every bullet is an <li>.
import { cleanup, render, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { formatRange } from "../../src/resume/dates.ts";
import { emptyResume } from "../../src/resume/model.ts";
import type { Experience, Project, Resume } from "../../src/resume/model.ts";
import { TEMPLATES } from "../../src/templates/index.ts";
import { HEAVY } from "../fixtures/heavy-sample.ts";

type L = "en" | "zh";
const IDS = ["classic", "modern"] as const;

function renderT(id: string, resume: Resume, lang: L): HTMLElement {
  const entry = TEMPLATES.find((t) => t.id === id)!;
  const C = entry.component as ComponentType<{ resume: Resume; lang: L }>;
  const { container } = render(<C resume={resume} lang={lang} />);
  return container.querySelector<HTMLElement>("[data-template]")!;
}
afterEach(cleanup);

const q = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
const part = (el: ParentNode, name: string) => el.querySelector<HTMLElement>(`[data-part="${name}"]`);
const txt = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const heads = (root: HTMLElement) => within(root).queryAllByRole("heading", { level: 2 }).map((h) => txt(h));

const exp = (id: string, company: string, title: string, start: string, end: string, extra: Partial<Experience> = {}): Experience => ({
  id, company, title, location: "Singapore", start, end, bullets: [`${title} did a thing.`, `${title} did another thing.`], ...extra,
});
const proj = (id: string, name: string, extra: Partial<Project> = {}): Project => ({
  id, name, role: "Developer", org: "Acme", start: "2020-01", end: "2020-12", tech: ["Java", "Redis"], bullets: [`${name} bullet one.`, `${name} bullet two.`], ...extra,
});
const base = (patch: Partial<Resume>): Resume => ({ ...emptyResume(), basics: { ...emptyResume().basics, name: "Sam Sample" }, ...patch });

describe.each(IDS)("criterion 3: grouping in %s", (id) => {
  for (const lang of ["en", "zh"] as const) {
    it(`${lang}: consecutive same-company entries form one group; others get their own group, both lines each`, () => {
      const r = base({
        experience: [
          exp("e1", "Acme", "Lead", "2023-01", ""),
          exp("e2", " Acme ", "Senior", "2021-03", "2022-12"),
          exp("e3", "Acme", "Engineer", "2019-04", "2021-02"),
          exp("e4", "Beta Ltd", "Analyst", "2017-01", "2019-03"),
          exp("e5", "Acme", "Intern", "2016-06", "2016-09"),
        ],
      });
      const root = renderT(id, r, lang);
      const groups = q(root, "[data-group]");
      expect(groups).toHaveLength(3);
      expect(groups.map((g) => q(g, '[data-level="company"]').length)).toEqual([1, 1, 1]);
      expect(groups.map((g) => q(g, '[data-level="role"]').length)).toEqual([3, 1, 1]);
      const c0 = q(groups[0]!, '[data-level="company"]')[0]!;
      expect(txt(part(c0, "company"))).toBe("Acme");
      expect(txt(part(c0, "location"))).toBe("Singapore");
      expect(txt(part(c0, "dates"))).toBe(formatRange("2019-04", "", lang)); // first start, last end
      expect(txt(part(q(groups[1]!, '[data-level="company"]')[0]!, "dates"))).toBe(formatRange("2017-01", "2019-03", lang));
      const roles = q(groups[0]!, '[data-level="role"]');
      expect(roles.map((x) => txt(part(x, "title")))).toEqual(["Lead", "Senior", "Engineer"]);
      expect(roles.map((x) => txt(part(x, "dates")))).toEqual([
        formatRange("2023-01", "", lang),
        formatRange("2021-03", "2022-12", lang),
        formatRange("2019-04", "2021-02", lang),
      ]);
      expect(q(groups[0]!, "li")).toHaveLength(6);
      // the company line comes before every role line of its group
      expect(c0.compareDocumentPosition(roles[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it(`${lang}: a company with one role has the company line and the role line`, () => {
      const root = renderT(id, base({ experience: [exp("e1", "Solo Co", "Analyst", "2020-01", "2021-01")] }), lang);
      expect(q(root, '[data-level="company"]')).toHaveLength(1);
      expect(q(root, '[data-level="role"]')).toHaveLength(1);
    });
  }

  it("the heavy fixture renders 4 company lines and 6 role lines", () => {
    const root = renderT(id, HEAVY.en, "en");
    expect(q(root, '[data-level="company"]').map((c) => txt(part(c, "company")))).toEqual([
      "Harborline Payments", "Lumen Fintech", "Eastgate Bank Technology", "Bayview Software",
    ]);
    expect(q(root, '[data-level="role"]')).toHaveLength(6);
  });
});

describe.each(IDS)("criterion 5: projects, extras, empty things in %s", (id) => {
  for (const lang of ["en", "zh"] as const) {
    const tagText = lang === "en" ? "Project" : "项目";
    const techLabel = lang === "en" ? /^tech:?$/i : /^技术栈[:：]?$/;

    it(`${lang}: a project with experienceId nests under its role, after that role's bullets`, () => {
      const r = base({
        experience: [exp("e1", "Acme", "Lead", "2023-01", ""), exp("e2", "Acme", "Senior", "2021-03", "2022-12")],
        projects: [proj("p1", "Nested One", { experienceId: "e1", start: "2023-06", end: "2024-03" })],
      });
      const root = renderT(id, r, lang);
      const nests = q(root, "[data-nest]");
      expect(nests).toHaveLength(1);
      const line = q(nests[0]!, '[data-level="project"]');
      expect(line).toHaveLength(1);
      expect(txt(part(line[0]!, "tag"))).toBe(tagText);
      expect(txt(part(line[0]!, "name"))).toBe("Nested One");
      expect(txt(part(line[0]!, "dates"))).toBe(formatRange("2023-06", "2024-03", lang));
      expect(q(nests[0]!, "li").map(txt)).toEqual(["Nested One bullet one.", "Nested One bullet two."]);
      expect(q(root, '[data-section="projects"]')).toHaveLength(0);
      const roles = q(root, '[data-level="role"]');
      const lastBulletOfLead = q(root, "li").find((l) => txt(l) === "Lead did another thing.")!;
      expect(lastBulletOfLead.compareDocumentPosition(nests[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(nests[0]!.compareDocumentPosition(roles[1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it(`${lang}: a project without experienceId renders in the Projects section with a tech line`, () => {
      const r = base({ experience: [exp("e1", "Acme", "Lead", "2023-01", "")], projects: [proj("p1", "Solo Project")] });
      const root = renderT(id, r, lang);
      const sec = q(root, '[data-section="projects"]');
      expect(sec).toHaveLength(1);
      expect(q(root, "[data-nest]")).toHaveLength(0);
      const line = q(sec[0]!, '[data-level="project-standalone"]')[0]!;
      expect(txt(part(line, "name"))).toBe("Solo Project");
      expect(txt(part(line, "meta"))).toBe("Developer · Acme");
      expect(txt(part(line, "dates"))).toBe(formatRange("2020-01", "2020-12", lang));
      const tech = part(sec[0]!, "tech")!;
      expect(txt(part(tech, "tech-label"))).toMatch(techLabel);
      expect(q(tech, '[data-part="tech-tag"]').map(txt)).toEqual(["Java", "Redis"]);
      expect(q(sec[0]!, "li").map(txt)).toEqual(["Solo Project bullet one.", "Solo Project bullet two."]);
    });

    it(`${lang}: a project whose experienceId matches no entry is kept in the Projects section`, () => {
      const root = renderT(id, base({ projects: [proj("p1", "Orphan", { experienceId: "gone" })] }), lang);
      expect(txt(q(root, '[data-section="projects"]')[0])).toContain("Orphan");
    });

    it(`${lang}: heavy fixture shows 1 nested and 3 standalone projects`, () => {
      const root = renderT(id, HEAVY[lang], lang);
      expect(q(root, '[data-level="project"]')).toHaveLength(1);
      expect(q(root, '[data-level="project-standalone"]')).toHaveLength(3);
      expect(q(root, '[data-part="tech"]')).toHaveLength(3);
    });

    it(`${lang}: extras render as their own sections with the original heading, in original order`, () => {
      const root = renderT(id, HEAVY[lang], lang);
      const extra = q(root, '[data-section="extra"]');
      expect(extra.map((s) => txt(s.querySelector("h2")))).toEqual(HEAVY[lang].extras.map((x) => x.heading));
      expect(q(extra[0]!, "li").map(txt)).toEqual(HEAVY[lang].extras[0]!.items);
    });

    it(`${lang}: empty sections and empty fields render nothing`, () => {
      const r = base({
        experience: [exp("e1", "", "Analyst", "", "", { location: "", bullets: ["", "  "] })],
        projects: [proj("p1", "Lonely", { role: "", org: "", start: "", end: "", tech: [], bullets: [] })],
        extras: [
          { id: "x1", heading: "Awards", items: [] },
          { id: "x2", heading: "Talks", items: ["", "A talk"] },
        ],
        education: [{ id: "d1", school: "Uni", degree: "", start: "", end: "", details: [] }],
        skills: [{ id: "s1", name: "", items: [] }],
        certificates: ["", " "],
        languages: [""],
      });
      const root = renderT(id, r, lang);
      expect(heads(root)).not.toContain("Awards");
      expect(heads(root).join("|")).toContain("Talks");
      expect(q(q(root, '[data-section="extra"]')[0]!, "li").map(txt)).toEqual(["A talk"]);
      const names = heads(root).map((h) => h.toLowerCase());
      for (const gone of ["skills", "certificates", "languages", "专业技能", "证书", "语言"]) expect(names).not.toContain(gone);
      const project = q(root, '[data-level="project-standalone"]');
      expect(project).toHaveLength(1);
      expect(part(project[0]!, "meta")).toBeNull();
      expect(part(project[0]!, "dates")).toBeNull();
      expect(part(root, "tech")).toBeNull();
      const company = q(root, '[data-level="company"]');
      for (const c of company) {
        expect(part(c, "location")).toBeNull();
        expect(part(c, "dates")).toBeNull();
      }
      expect(q(root, '[data-level="role"] [data-part="dates"]')).toHaveLength(0);
      expect(q(root, "li").map(txt).filter((t) => t === "")).toEqual([]);
      expect(part(root, "details")).toBeNull();
      expect(part(root, "degree")).toBeNull();
      // no separator left over
      for (const m of q(root, '[data-part="meta"], [data-part="degree"]')) expect(txt(m)).not.toMatch(/^[·,，–-]|[·,，–-]$/);
    });

    it(`${lang}: education keeps school, degree, dates and one muted details line`, () => {
      const root = renderT(id, HEAVY[lang], lang);
      const lines = q(root, '[data-level="education"]');
      expect(lines).toHaveLength(2);
      const e = HEAVY[lang].education;
      expect(lines.map((l) => txt(part(l, "school")))).toEqual(e.map((x) => x.school));
      expect(lines.map((l) => txt(part(l, "degree")))).toEqual(e.map((x) => x.degree));
      expect(lines.map((l) => txt(part(l, "dates")))).toEqual(e.map((x) => formatRange(x.start, x.end, lang)));
      expect(q(root, '[data-part="details"]').map(txt)).toEqual(e.map((x) => x.details.join(" · ")));
    });
  }
});

describe.each(IDS)("criterion 8: skills in %s", (id) => {
  it("en: Classic renders 'group: items' lines, Modern renders every item as a chip", () => {
    const root = renderT(id, HEAVY.en, "en");
    const items = HEAVY.en.skills.flatMap((g) => g.items);
    if (id === "classic") {
      const text = txt(root);
      for (const g of HEAVY.en.skills) expect(text).toContain(`${g.name}: ${g.items.join(", ")}`);
      expect(q(root, '[data-part="chip"]')).toHaveLength(0);
    } else {
      expect(q(root, '[data-part="chip"]').map(txt)).toEqual(items);
    }
  });
  it("zh: Classic uses full-width colon and 、", () => {
    const root = renderT(id, HEAVY.zh, "zh");
    if (id === "classic") expect(txt(root)).toContain("编程语言：Java、Kotlin、SQL、Python");
    else expect(q(root, '[data-part="chip"]')).toHaveLength(HEAVY.zh.skills.flatMap((g) => g.items).length);
  });
});

describe.each(IDS)("criterion 2: section order and entry order in %s", (id) => {
  const NAMES = {
    en: { summary: "Summary", experience: "Experience", projects: "Projects", education: "Education", skills: "Skills", certificates: "Certificates", languages: "Languages" },
    zh: { summary: "个人简介", experience: "工作经历", projects: "项目经历", education: "教育背景", skills: "专业技能", certificates: "证书", languages: "语言" },
  };
  for (const lang of ["en", "zh"] as const) {
    it(`${lang}: default order, extras after Certificates in original order, Languages last`, () => {
      const n = NAMES[lang];
      const root = renderT(id, HEAVY[lang], lang);
      expect(heads(root).map((h) => h.toLowerCase())).toEqual(
        [n.summary, n.experience, n.projects, n.education, n.skills, n.certificates, ...HEAVY[lang].extras.map((x) => x.heading), n.languages].map((h) => h.toLowerCase()),
      );
    });
    it(`${lang}: resume.order is followed (career change); entries stay in their original order`, () => {
      const n = NAMES[lang];
      const order = ["summary", "skills", "projects", "experience", "education", "certificates", "extras", "languages"] as Resume["order"];
      const root = renderT(id, { ...HEAVY[lang], order }, lang);
      expect(heads(root).map((h) => h.toLowerCase())).toEqual(
        [n.summary, n.skills, n.projects, n.experience, n.education, n.certificates, ...HEAVY[lang].extras.map((x) => x.heading), n.languages].map((h) => h.toLowerCase()),
      );
      expect(q(root, '[data-level="company"] [data-part="company"]').map(txt)).toEqual(
        [...new Set(HEAVY[lang].experience.map((e) => e.company))],
      );
      expect(q(root, '[data-level="project-standalone"] [data-part="name"]').map(txt)).toEqual(
        HEAVY[lang].projects.filter((p) => !p.experienceId).map((p) => p.name),
      );
    });
  }
});
