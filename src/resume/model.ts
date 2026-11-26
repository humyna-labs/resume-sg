export interface Basics {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
}
export interface Experience {
  id: string;
  company: string;
  title: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
}
export interface Education {
  id: string;
  school: string;
  degree: string;
  start: string;
  end: string;
  details: string[];
}
export interface SkillGroup {
  id: string;
  name: string;
  items: string[];
}
export interface Project {
  id: string;
  name: string;
  role: string;
  org: string;
  start: string;
  end: string;
  tech: string[];
  bullets: string[];
  /** The experience entry this project is nested under; absent or "" means the Projects section. */
  experienceId?: string | undefined;
}
export interface Extra {
  id: string;
  heading: string;
  items: string[];
}
export type SectionId = "summary" | "experience" | "projects" | "education" | "skills" | "certificates" | "extras" | "languages";
export interface Resume {
  basics: Basics;
  summary: string;
  experience: Experience[];
  education: Education[];
  certificates: string[];
  skills: SkillGroup[];
  languages: string[];
  projects: Project[];
  extras: Extra[];
  order: SectionId[];
}

export const DEFAULT_ORDER: readonly SectionId[] = [
  "summary",
  "experience",
  "projects",
  "education",
  "skills",
  "certificates",
  "extras",
  "languages",
];

export function emptyResume(): Resume {
  return {
    basics: { name: "", headline: "", email: "", phone: "", location: "", links: [] },
    summary: "",
    experience: [],
    education: [],
    certificates: [],
    skills: [],
    languages: [],
    projects: [],
    extras: [],
    order: [...DEFAULT_ORDER],
  };
}
