// Fixtures for resume-sg#11 (page fit). Synthetic data only: "Alex Example" and made-up companies.
// `synth` builds an original resume text and a TailorOutput whose sources are exact lines of that text, so
// factCheck(original, output) gives no finding at all (the fixture tests check this).
import type { SourcedExperience, SourcedProject, TailorOutput } from "../../src/ai/types.ts";
import { DEFAULT_ORDER } from "../../src/resume/model.ts";
import type { Resume } from "../../src/resume/model.ts";
import { emptySourced } from "./fact-check-cases.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const W = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima"];
const LONG =
  ", working with the product, design and operations teams to plan the work, review each change with care, ship it in small steps and write up what was learned for the next team that picks it up";
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "2021-03" -> "Mar 2021" */
export const monthLabel = (iso: string): string => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? "Jan"} ${iso.slice(0, 4)}`;

/** The current month as "YYYY-MM" (what the preview uses for `end: ""`). */
export function nowMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** `months` months before the current month, "YYYY-MM". */
export function monthsAgo(months: number): string {
  const d = new Date();
  const total = d.getFullYear() * 12 + d.getMonth() - months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export interface RoleSpec {
  company: string;
  title: string;
  /** "YYYY-MM" */
  start: string;
  /** "YYYY-MM", "" = present */
  end: string;
  bullets: string[];
}

export const companyName = (r: number): string => `Company ${cap(W[r % 12] ?? "x")}${r >= 12 ? ` ${Math.floor(r / 12) + 1}` : ""}`;
export function bulletText(r: number, b: number, long = false): string {
  const rw = `${W[r % 12]}${r >= 12 ? ` ${W[Math.floor(r / 12) % 12]}` : ""}`;
  const bw = `${W[b % 12]}${b >= 12 ? ` ${W[Math.floor(b / 12) % 12]}` : ""}`;
  return `Delivered the ${bw} workstream of the ${rw} programme${long ? LONG : ""}.`;
}

/** Roles from newest (index 0) to oldest, `bullets` bullets each; the oldest starts in `firstYear`. */
export function longRoles(roles: number, bullets: number, opts: { long?: boolean; firstYear?: number } = {}): RoleSpec[] {
  const first = (opts.firstYear ?? 2008) * 12; // January of that year, as a month index
  const now = Number(nowMonth().slice(0, 4)) * 12 + Number(nowMonth().slice(5, 7)) - 1;
  const iso = (i: number): string => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  const startOf = (r: number): number => first + Math.floor(((now - first) * (roles - 1 - r)) / roles);
  return Array.from({ length: roles }, (_, r) => ({
    company: companyName(r),
    title: r === 0 ? "Senior Engineer" : "Software Engineer",
    start: iso(startOf(r)),
    end: r === 0 ? "" : iso(startOf(r - 1) - 1),
    bullets: Array.from({ length: bullets }, (_, b) => bulletText(r, b, opts.long ?? false)),
  }));
}

/** The short synthetic resume: 2 roles, about 2 years 6 months in total, 3 short bullets each. */
export const shortRoles = (): RoleSpec[] => [
  { company: "Company Alpha", title: "Software Engineer", start: monthsAgo(14), end: "", bullets: [0, 1, 2].map((b) => bulletText(0, b)) },
  { company: "Company Bravo", title: "Junior Engineer", start: monthsAgo(30), end: monthsAgo(15), bullets: [0, 1, 2].map((b) => bulletText(1, b)) },
];

export interface Synth {
  original: string;
  output: TailorOutput;
}

/** `projects`: standalone projects (name, bullets), all within the text after the experience lines. */
export function synth(roles: RoleSpec[], opts: { projects?: { name: string; bullets: string[] }[] } = {}): Synth {
  const header = "Alex Example — Software Engineer";
  const email = "alex.example@example.com";
  const phone = "+65 9000 0001";
  const lines: string[] = [header, `${email} · ${phone}`, "Experience"];
  const experience: SourcedExperience[] = roles.map((r, i) => {
    const source = `${r.title} — ${r.company} — ${monthLabel(r.start)} – ${r.end === "" ? "Present" : monthLabel(r.end)}`;
    lines.push(`${i + 1}. ${source}`);
    r.bullets.forEach((t) => lines.push(`   - ${t}`));
    return {
      id: `e${i + 1}`,
      company: r.company,
      title: r.title,
      location: "",
      start: r.start,
      end: r.end,
      source,
      bullets: r.bullets.map((t) => ({ text: t, source: t })),
    };
  });
  const projects: SourcedProject[] = [];
  if (opts.projects && opts.projects.length > 0) {
    lines.push("Projects");
    opts.projects.forEach((p, i) => {
      const source = `${p.name} — personal project`;
      lines.push(`${i + 1}. ${source}`);
      p.bullets.forEach((t) => lines.push(`   - ${t}`));
      projects.push({
        id: `p${i + 1}`,
        name: p.name,
        role: "",
        org: "",
        start: "",
        end: "",
        tech: [],
        source,
        bullets: p.bullets.map((t) => ({ text: t, source: t })),
      });
    });
  }
  const eduSource = "B.Sc. Computing — Example University — 2004 – 2008";
  lines.push("Education", eduSource);

  const resume = emptySourced();
  resume.basics = { name: "Alex Example", headline: "Software Engineer", email, phone, location: "", links: [] };
  resume.experience = experience;
  resume.projects = projects;
  resume.education = [
    { id: "d1", school: "Example University", degree: "B.Sc. Computing", start: "2004", end: "2008", details: [], source: eduSource },
  ];
  resume.order = [...DEFAULT_ORDER];
  return { original: `${lines.join("\n")}\n`, output: { resume, changes: [], notIncluded: [] } };
}

/** A `Resume` (editor model) with the given experience dates, for targetPages. */
export function baseWithDates(spans: { start: string; end: string }[]): Resume {
  return {
    basics: { name: "Alex Example", headline: "", email: "", phone: "", location: "", links: [] },
    summary: "",
    experience: spans.map((s, i) => ({ id: `e${i}`, company: `Company ${i}`, title: "Engineer", location: "", start: s.start, end: s.end, bullets: ["Did work."] })),
    education: [],
    certificates: [],
    skills: [],
    languages: [],
    projects: [],
    extras: [],
    order: [...DEFAULT_ORDER],
  };
}

export const bulletsOf = (o: TailorOutput): string[][] => o.resume.experience.map((e) => e.bullets.map((b) => b.source));
export const totalBullets = (o: TailorOutput): number =>
  o.resume.experience.reduce((n, e) => n + e.bullets.length, 0) + o.resume.projects.reduce((n, p) => n + p.bullets.length, 0);

/**
 * A resume that stays over two pages even when every role is down to one bullet. The validator caps experience at 8
 * roles, so the weight comes from sections tighten never touches: 12 skill groups of 40 items, 20 certificates and
 * a long summary. Every added line is also in `original`.
 */
export function synthHeavy(): Synth {
  const base = synth(longRoles(8, 2, { long: true }));
  const extra: string[] = ["Skills"];
  base.output.resume.skills = Array.from({ length: 12 }, (_, g) => {
    const items = Array.from({ length: 40 }, (_, i) => `Skill${W[g % 12]}${i + 1}`);
    extra.push(`Group ${g + 1}: ${items.join(", ")}`);
    return { id: `s${g + 1}`, name: `Group ${g + 1}`, items };
  });
  extra.push("Certificates");
  base.output.resume.certificates = Array.from({ length: 20 }, (_, i) => {
    const t = `Certificate ${i + 1} in ${W[i % 12]} practice, issued by Example Institute, with a long description that fills a line`;
    extra.push(t);
    return { text: t, source: t };
  });
  base.output.resume.summary = Array.from({ length: 30 }, (_, i) => `Experienced engineer ${W[i % 12]} ${i}.`).join(" ");
  extra.push(base.output.resume.summary);
  base.original += `${extra.join("\n")}\n`;
  return base;
}
