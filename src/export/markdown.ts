import { formatRange } from "../resume/dates.ts";
import { DEFAULT_ORDER } from "../resume/model.ts";
import type { Experience, Project, Resume, SectionId } from "../resume/model.ts";
import { SECTION_NAMES, contactOf, educationIsEmpty, experienceIsEmpty, filled, groupLabel, joinItems, joinLanguages, projectIsEmpty } from "../templates/common.ts";
import type { TemplateLang } from "../templates/common.ts";

const OPEN_END = /^(?:present|current|now|至今)$/i;

/** One line of user text made literal: no link, tag, emphasis, code span, heading or list marker can start from it. */
function escLine(line: string): string {
  let s = line.replace(/[\\`*_[\]<>]/g, (c) => `\\${c}`);
  s = s.replace(/^(\s*)#/, "$1\\#").replace(/^(\s*)([+-])(?=\s|$)/, "$1\\$2").replace(/^(\s*)(\d+)([.)])(?=\s|$)/, "$1$2\\$3");
  return s;
}
const esc = (text: string): string => text.split(/\r?\n/).map(escLine).join("\n");
const one = (text: string): string => escLine(text.replace(/\s+/g, " ").trim());

const range = (start: string, end: string, lang: TemplateLang): string => formatRange(start.trim(), OPEN_END.test(end.trim()) ? "" : end.trim(), lang);

/** `toMarkdown(resume, lang)`: the resume as Markdown, in the output language. Blocks are separated by one blank line. */
export function toMarkdown(resume: Resume, lang: TemplateLang): string {
  const names = SECTION_NAMES[lang];
  const sep = lang === "zh" ? "　" : " — ";
  const blocks: string[] = [];
  const b = resume.basics;

  if (b.name.trim() !== "") blocks.push(`# ${one(b.name)}`);
  if (b.headline.trim() !== "") blocks.push(esc(b.headline.trim()));
  const contact = contactOf(resume).map((c) => one(c));
  if (contact.length > 0) blocks.push(contact.join(" · "));

  const title = (...parts: string[]): string => parts.map((p) => p.trim()).filter((p) => p !== "").map(one).join(sep);
  const bullets = (items: readonly string[]) => {
    const list = filled(items).map((x) => `- ${esc(x.trim())}`);
    if (list.length > 0) blocks.push(list.join("\n"));
  };
  const dateLine = (start: string, end: string) => {
    const d = range(start, end, lang);
    if (d !== "") blocks.push(esc(d));
  };
  const heading = (level: number, text: string) => {
    if (text !== "") blocks.push(`${"#".repeat(level)} ${text}`);
  };
  const tech = (p: Project) => {
    const items = filled(p.tech).map((x) => one(x));
    if (items.length > 0) blocks.push(`${lang === "zh" ? "技术栈：" : "Tech: "}${joinItems(items, lang)}`);
  };
  const section = (name: string, body: () => void) => {
    const mark = blocks.length;
    body();
    if (blocks.length > mark) blocks.splice(mark, 0, `## ${one(name)}`);
  };

  const experienceIds = new Set(resume.experience.filter((e) => !experienceIsEmpty(e)).map((e) => e.id));
  const nestedIn = (id: string): Project[] => resume.projects.filter((p) => !projectIsEmpty(p) && p.experienceId === id);
  const isNested = (p: Project): boolean => p.experienceId !== undefined && p.experienceId !== "" && experienceIds.has(p.experienceId);
  const loose = resume.projects.filter((p) => !projectIsEmpty(p) && !isNested(p));

  const builders: Record<Exclude<SectionId, "extras">, () => void> = {
    summary: () => section(names.summary, () => {
      if (resume.summary.trim() !== "") blocks.push(esc(resume.summary.trim()));
    }),

    experience: () => section(names.experience, () => {
      const groups: Experience[][] = [];
      for (const e of resume.experience) {
        if (experienceIsEmpty(e)) continue;
        const last = groups[groups.length - 1];
        if (last && (last[0]?.company ?? "").trim() === e.company.trim()) last.push(e);
        else groups.push([e]);
      }
      for (const g of groups) {
        const first = g[0] as Experience;
        const company = first.company;
        const roleLevel = g.length > 1 && company.trim() !== "" ? 4 : 3;
        if (roleLevel === 4) heading(3, title(company));
        for (const e of g) {
          heading(roleLevel, roleLevel === 4 ? title(e.title) : title(e.title, company));
          dateLine(e.start, e.end);
          bullets(e.bullets);
          for (const p of nestedIn(e.id)) {
            heading(roleLevel + 1, title(p.name, p.role));
            dateLine(p.start, p.end);
            tech(p);
            bullets(p.bullets);
          }
        }
      }
    }),

    projects: () => section(names.projects, () => {
      for (const p of loose) {
        const meta = [p.role.trim(), p.org.trim()].filter((s) => s !== "").join(" · ");
        heading(3, title(p.name, meta));
        dateLine(p.start, p.end);
        tech(p);
        bullets(p.bullets);
      }
    }),

    education: () => section(names.education, () => {
      for (const e of resume.education) {
        if (educationIsEmpty(e)) continue;
        heading(3, title(e.school, e.degree));
        dateLine(e.start, e.end);
        bullets(e.details);
      }
    }),

    skills: () => section(names.skills, () => {
      const list: string[] = [];
      for (const g of resume.skills) {
        const items = filled(g.items).map((x) => one(x));
        if (items.length === 0 && g.name.trim() === "") continue;
        const label = g.name.trim() === "" ? "" : groupLabel(one(g.name), lang);
        list.push(`- ${label}${joinItems(items, lang)}`);
      }
      if (list.length > 0) blocks.push(list.join("\n"));
    }),

    certificates: () => section(names.certificates, () => bullets(resume.certificates)),

    languages: () => section(names.languages, () => {
      const text = joinLanguages(filled(resume.languages).map((x) => one(x)), lang);
      if (text !== "") blocks.push(text);
    }),
  };

  const order: SectionId[] = [...(resume.order ?? DEFAULT_ORDER)].filter((s, i, all) => all.indexOf(s) === i);
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
  for (const id of order) {
    if (id === "extras") {
      for (const x of resume.extras) section(x.heading.trim() === "" ? names.other : x.heading, () => bullets(x.items));
    } else builders[id]();
  }

  return blocks.length === 0 ? "" : `${blocks.join("\n\n")}\n`;
}
