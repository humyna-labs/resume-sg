// Fixtures for resume-sg#30 (tailor flow). Synthetic people and companies only.
import type { TailorOutput } from "../../src/ai/types.ts";
import { DEFAULT_ORDER } from "../../src/resume/model.ts";
import { case1Original, case1Output, case2Original, clone } from "./fact-check-cases.ts";
import { case1ZhOutput, case2EnOutput } from "./fact-check-2-cases.ts";

export const FAKE_KEY = "sk-ant-fakekey-abcd3f9a";
export const ORIGINAL_EN = case1Original;
export const ORIGINAL_ZH = case2Original;
export const JD_EN = "Acme Pay · Senior Backend Engineer (Payments Platform)\nRequirements: 6+ years of Java/Kotlin backend work; Kafka; idempotent API design.";

/** A faithful English output for case 1: no red finding when checked against ORIGINAL_EN. */
export function validOutput(): TailorOutput {
  const o = case1Output();
  o.resume.order = [...DEFAULT_ORDER];
  return o;
}

/** English output with one red finding: the number 30% is not in the original (experience[0].bullets[3]). */
export function redOutput(): TailorOutput {
  const o = validOutput();
  const b = o.resume.experience[0]?.bullets[3];
  if (b) b.text = "Mentored 5 engineers, two of whom were promoted to senior, and raised delivery efficiency by 30%.";
  return o;
}

/** English output with one amber finding: a bullet dropped and not listed in notIncluded. */
export function amberOutput(): TailorOutput {
  const o = validOutput();
  o.resume.experience[1]?.bullets.splice(2, 1);
  return o;
}
export const AMBER_LINE = "Built the risk-rule engine used by 3 product lines.";

/** Chinese output for the English original (cross-language). */
export const crossZhOutput = (): TailorOutput => {
  const o = case1ZhOutput();
  o.resume.order = [...DEFAULT_ORDER];
  return o;
};
/** English output for the Chinese original (cross-language). */
export const crossEnOutput = (): TailorOutput => {
  const o = case2EnOutput();
  o.resume.order = [...DEFAULT_ORDER];
  return o;
};

/** A near-empty output: the editor opened from it starts empty. */
export function emptyOutput(): TailorOutput {
  const o = clone(validOutput());
  o.resume = {
    basics: { name: "", headline: "", email: "", phone: "", location: "", links: [] },
    summary: "",
    experience: [],
    projects: [],
    education: [],
    certificates: [],
    skills: [],
    extras: [],
    languages: [],
    order: [...DEFAULT_ORDER],
  };
  o.changes = [];
  o.notIncluded = [];
  return o;
}

export const apiBody = (text: string): string => JSON.stringify({ content: [{ type: "text", text }] });
export const apiResponse = (text: string): Response =>
  new Response(apiBody(text), { status: 200, headers: { "content-type": "application/json" } });
export const apiOutput = (o: TailorOutput): Response => apiResponse(JSON.stringify(o));
