import type { Resume } from "../resume/model.ts";

export type TemplateLang = "en" | "zh";

export interface TemplateProps {
  resume: Resume;
  lang: TemplateLang;
}

/** Section names follow the resume's output language, not the UI language. */
export const SECTION_NAMES = {
  en: {
    summary: "Summary",
    experience: "Experience",
    projects: "Projects",
    education: "Education",
    skills: "Skills",
    certificates: "Certificates",
    languages: "Languages",
    other: "Other",
  },
  zh: { summary: "个人简介", experience: "工作经历", projects: "项目经历", education: "教育背景", skills: "专业技能", certificates: "证书", languages: "语言", other: "其他" },
} as const;

export const filled = (list: readonly string[]): string[] => list.filter((s) => s.trim() !== "");

export const htmlLang = (lang: TemplateLang): string => (lang === "zh" ? "zh-CN" : "en");

/** Items of one line: `、` in Chinese, `, ` in English. */
export const joinItems = (items: readonly string[], lang: TemplateLang): string => filled(items).join(lang === "zh" ? "、" : ", ");

/** Languages: `；` in Chinese, `, ` in English. */
export const joinLanguages = (items: readonly string[], lang: TemplateLang): string => filled(items).join(lang === "zh" ? "；" : ", ");

/** `Group: ` / `组名：` (empty when the group has no name). */
export const groupLabel = (name: string, lang: TemplateLang): string => (name.trim() === "" ? "" : `${name}${lang === "zh" ? "：" : ": "}`);

/** `company, location` / `公司，地点`. */
export const organisation = (company: string, location: string, lang: TemplateLang): string =>
  [company, location].filter((s) => s.trim() !== "").join(lang === "zh" ? "，" : ", ");

export const contactOf = (resume: Resume): string[] => {
  const b = resume.basics;
  return filled([b.email, b.phone, b.location, ...b.links]);
};

export interface Sections {
  summary: boolean;
  experience: boolean;
  projects: boolean;
  education: boolean;
  skills: boolean;
  certificates: boolean;
  extras: boolean;
  languages: boolean;
}

const blank = (s: string): boolean => s.trim() === "";

export const experienceIsEmpty = (e: Resume["experience"][number]): boolean =>
  [e.company, e.title, e.location, e.start, e.end].every(blank) && filled(e.bullets).length === 0;
export const projectIsEmpty = (p: Resume["projects"][number]): boolean =>
  [p.name, p.role, p.org, p.start, p.end].every(blank) && filled(p.tech).length === 0 && filled(p.bullets).length === 0;
export const educationIsEmpty = (e: Resume["education"][number]): boolean =>
  [e.school, e.degree, e.start, e.end].every(blank) && filled(e.details).length === 0;

export function sectionsOf(resume: Resume): Sections {
  return {
    summary: resume.summary.trim() !== "",
    experience: resume.experience.some((e) => !experienceIsEmpty(e)),
    projects: resume.projects.some((p) => !projectIsEmpty(p)),
    education: resume.education.some((e) => !educationIsEmpty(e)),
    skills: resume.skills.some((g) => filled(g.items).length > 0 || g.name.trim() !== ""),
    certificates: filled(resume.certificates).length > 0,
    extras: resume.extras.some((x) => filled(x.items).length > 0),
    languages: filled(resume.languages).length > 0,
  };
}

export const isBlank = (resume: Resume): boolean => {
  const b = resume.basics;
  const s = sectionsOf(resume);
  return (
    b.name.trim() === "" &&
    b.headline.trim() === "" &&
    contactOf(resume).length === 0 &&
    !Object.values(s).some(Boolean)
  );
};
