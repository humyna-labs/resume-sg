import type { Education, Experience, Resume, SkillGroup } from "./model.ts";

export type Dir = "up" | "down";

function moved<T>(list: readonly T[], index: number, dir: Dir): T[] {
  const out = [...list];
  const j = dir === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= out.length || j < 0 || j >= out.length) return out;
  const a = out[index] as T;
  out[index] = out[j] as T;
  out[j] = a;
  return out;
}
const removed = <T>(list: readonly T[], index: number): T[] => list.filter((_, i) => i !== index);
const replaced = <T>(list: readonly T[], index: number, value: T): T[] => list.map((x, i) => (i === index ? value : x));

function nextId(prefix: string, list: readonly { id: string }[]): string {
  let max = 0;
  for (const { id } of list) {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${max + 1}`;
}
const indexOfId = (list: readonly { id: string }[], id: string) => list.findIndex((x) => x.id === id);

// basics and summary
export function updateBasics(r: Resume, patch: Partial<Omit<Resume["basics"], "links">>): Resume {
  return { ...r, basics: { ...r.basics, ...patch } };
}
export function updateSummary(r: Resume, summary: string): Resume {
  return { ...r, summary };
}

// entries by id
export function addExperience(r: Resume): Resume {
  const e: Experience = { id: nextId("exp", r.experience), company: "", title: "", location: "", start: "", end: "", bullets: [] };
  return { ...r, experience: [...r.experience, e] };
}
export function updateExperience(r: Resume, id: string, patch: Partial<Omit<Experience, "id">>): Resume {
  return { ...r, experience: r.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}
export function moveExperience(r: Resume, id: string, dir: Dir): Resume {
  return { ...r, experience: moved(r.experience, indexOfId(r.experience, id), dir) };
}
export function removeExperience(r: Resume, id: string): Resume {
  return { ...r, experience: r.experience.filter((e) => e.id !== id) };
}

export function addEducation(r: Resume): Resume {
  const e: Education = { id: nextId("edu", r.education), school: "", degree: "", start: "", end: "", details: [] };
  return { ...r, education: [...r.education, e] };
}
export function updateEducation(r: Resume, id: string, patch: Partial<Omit<Education, "id">>): Resume {
  return { ...r, education: r.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}
export function moveEducation(r: Resume, id: string, dir: Dir): Resume {
  return { ...r, education: moved(r.education, indexOfId(r.education, id), dir) };
}
export function removeEducation(r: Resume, id: string): Resume {
  return { ...r, education: r.education.filter((e) => e.id !== id) };
}

export function addSkillGroup(r: Resume): Resume {
  const g: SkillGroup = { id: nextId("skill", r.skills), name: "", items: [] };
  return { ...r, skills: [...r.skills, g] };
}
export function updateSkillGroup(r: Resume, id: string, patch: Partial<Omit<SkillGroup, "id">>): Resume {
  return { ...r, skills: r.skills.map((g) => (g.id === id ? { ...g, ...patch } : g)) };
}
export function moveSkillGroup(r: Resume, id: string, dir: Dir): Resume {
  return { ...r, skills: moved(r.skills, indexOfId(r.skills, id), dir) };
}
export function removeSkillGroup(r: Resume, id: string): Resume {
  return { ...r, skills: r.skills.filter((g) => g.id !== id) };
}

// string lists by index
type ListKey = "certificates" | "languages";
const listOps = (key: ListKey) => ({
  add: (r: Resume): Resume => ({ ...r, [key]: [...r[key], ""] }),
  update: (r: Resume, i: number, v: string): Resume => ({ ...r, [key]: replaced(r[key], i, v) }),
  move: (r: Resume, i: number, d: Dir): Resume => ({ ...r, [key]: moved(r[key], i, d) }),
  remove: (r: Resume, i: number): Resume => ({ ...r, [key]: removed(r[key], i) }),
});
const cert = listOps("certificates");
export const addCertificate = cert.add;
export const updateCertificate = cert.update;
export const moveCertificate = cert.move;
export const removeCertificate = cert.remove;
const lang = listOps("languages");
export const addLanguage = lang.add;
export const updateLanguage = lang.update;
export const moveLanguage = lang.move;
export const removeLanguage = lang.remove;

const withLinks = (r: Resume, links: string[]): Resume => ({ ...r, basics: { ...r.basics, links } });
export const addLink = (r: Resume): Resume => withLinks(r, [...r.basics.links, ""]);
export const updateLink = (r: Resume, i: number, v: string): Resume => withLinks(r, replaced(r.basics.links, i, v));
export const moveLink = (r: Resume, i: number, d: Dir): Resume => withLinks(r, moved(r.basics.links, i, d));
export const removeLink = (r: Resume, i: number): Resume => withLinks(r, removed(r.basics.links, i));

// nested string lists: bullets, details, skill items
export const addBullet = (r: Resume, id: string): Resume =>
  updateExperience(r, id, { bullets: [...(r.experience.find((e) => e.id === id)?.bullets ?? []), ""] });
export const updateBullet = (r: Resume, id: string, i: number, v: string): Resume =>
  updateExperience(r, id, { bullets: replaced(r.experience.find((e) => e.id === id)?.bullets ?? [], i, v) });
export const moveBullet = (r: Resume, id: string, i: number, d: Dir): Resume =>
  updateExperience(r, id, { bullets: moved(r.experience.find((e) => e.id === id)?.bullets ?? [], i, d) });
export const removeBullet = (r: Resume, id: string, i: number): Resume =>
  updateExperience(r, id, { bullets: removed(r.experience.find((e) => e.id === id)?.bullets ?? [], i) });

export const addDetail = (r: Resume, id: string): Resume =>
  updateEducation(r, id, { details: [...(r.education.find((e) => e.id === id)?.details ?? []), ""] });
export const updateDetail = (r: Resume, id: string, i: number, v: string): Resume =>
  updateEducation(r, id, { details: replaced(r.education.find((e) => e.id === id)?.details ?? [], i, v) });
export const moveDetail = (r: Resume, id: string, i: number, d: Dir): Resume =>
  updateEducation(r, id, { details: moved(r.education.find((e) => e.id === id)?.details ?? [], i, d) });
export const removeDetail = (r: Resume, id: string, i: number): Resume =>
  updateEducation(r, id, { details: removed(r.education.find((e) => e.id === id)?.details ?? [], i) });

export const addSkillItem = (r: Resume, id: string): Resume =>
  updateSkillGroup(r, id, { items: [...(r.skills.find((g) => g.id === id)?.items ?? []), ""] });
export const updateSkillItem = (r: Resume, id: string, i: number, v: string): Resume =>
  updateSkillGroup(r, id, { items: replaced(r.skills.find((g) => g.id === id)?.items ?? [], i, v) });
export const moveSkillItem = (r: Resume, id: string, i: number, d: Dir): Resume =>
  updateSkillGroup(r, id, { items: moved(r.skills.find((g) => g.id === id)?.items ?? [], i, d) });
export const removeSkillItem = (r: Resume, id: string, i: number): Resume =>
  updateSkillGroup(r, id, { items: removed(r.skills.find((g) => g.id === id)?.items ?? [], i) });
