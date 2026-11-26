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
export interface Resume {
  basics: Basics;
  summary: string;
  experience: Experience[];
  education: Education[];
  certificates: string[];
  skills: SkillGroup[];
  languages: string[];
}

export function emptyResume(): Resume {
  return {
    basics: { name: "", headline: "", email: "", phone: "", location: "", links: [] },
    summary: "",
    experience: [],
    education: [],
    certificates: [],
    skills: [],
    languages: [],
  };
}
