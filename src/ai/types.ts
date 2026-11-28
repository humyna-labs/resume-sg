// Sourced resume shape returned by the model (brief v5.2 sections 2, 4, 6).
// Every entry and bullet carries `source`: the exact substring of the original text it comes from.
export interface SourcedText {
  text: string;
  source: string;
}
export interface SourcedExperience {
  id: string;
  company: string;
  title: string;
  location: string;
  start: string;
  end: string;
  source: string;
  bullets: SourcedText[];
}
export interface SourcedProject {
  id: string;
  name: string;
  role: string;
  org: string;
  start: string;
  end: string;
  tech: string[];
  source: string;
  bullets: SourcedText[];
  experienceId?: string;
}
export interface SourcedEducation {
  id: string;
  school: string;
  degree: string;
  start: string;
  end: string;
  details: string[];
  source: string;
}
export interface SourcedExtra {
  id: string;
  heading: string;
  items: SourcedText[];
}
export interface SourcedResume {
  basics: { name: string; headline: string; email: string; phone: string; location: string; links: string[] };
  summary: string;
  experience: SourcedExperience[];
  projects: SourcedProject[];
  education: SourcedEducation[];
  certificates: SourcedText[];
  skills: { id: string; name: string; items: string[] }[];
  extras: SourcedExtra[];
  languages: string[];
  order: string[];
}
export interface TailorOutput {
  resume: SourcedResume;
  changes: { where: string; what: string }[];
  notIncluded: { source: string }[];
}

export type FindingKind = "source" | "number" | "unsourced" | "date" | "coverage" | "basics" | "item";
export interface Finding {
  id: string;
  level: "red" | "amber";
  kind: FindingKind;
  where: string;
  value: string;
}
/** red: removed | kept; amber: added */
export type Decision = "removed" | "kept" | "added";

// Match analysis (resume-sg#48): one separate AI call, every quote checked by code.
export type MatchStatus = "evidence" | "partial" | "missing";
export interface MatchRequirement {
  /** Copied from the job description. */
  jdQuote: string;
  status: MatchStatus;
  /** Copied from the original resume. Absent when the status is missing. */
  evidenceQuote?: string;
  note: string;
}
export interface MatchStrength {
  jdQuote: string;
  status: "evidence";
  evidenceQuote: string;
  note: string;
  howToTell: string;
}
export interface MatchGap {
  jdQuote: string;
  howToAddress: string;
}
export interface MatchQuestion {
  question: string;
  starPoints: string[];
}
export interface MatchOutput {
  requirements: MatchRequirement[];
  strengths: MatchStrength[];
  gaps: MatchGap[];
  interviewQuestions: MatchQuestion[];
  questionsToAsk: string[];
}
