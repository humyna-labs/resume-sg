// The wizard's step state in one place, so that session-autosave can store the current step later.
import type { OutputLang, TailorMode } from "../../ai/tailor.ts";
import { DEFAULT_TEMPLATE } from "../../templates/index.ts";
import type { TemplateId } from "../../templates/index.ts";

export const RESUME_MAX_CHARS = 30000;
export const JD_MAX_CHARS = 20000;

export type Step = 1 | 2 | 3 | 4 | 5;

export interface WizardState {
  step: Step;
  original: string;
  jd: string;
  tpl: TemplateId;
  lang: OutputLang;
  mode: TailorMode;
}

export type WizardAction =
  | { type: "go"; step: Step }
  | { type: "set"; patch: Partial<Omit<WizardState, "step">> }
  | { type: "reset"; lang: OutputLang };

export function initialWizard(lang: OutputLang): WizardState {
  return { step: 1, original: "", jd: "", tpl: DEFAULT_TEMPLATE, lang, mode: "balanced" };
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  if (action.type === "reset") return initialWizard(action.lang);
  return action.type === "go" ? { ...state, step: action.step } : { ...state, ...action.patch };
}

/** What blocks the primary button of step 1 or 2: nothing, an empty text or a text over its limit. */
export type TextProblem = "empty" | "over" | null;

export function textProblem(text: string, max: number): TextProblem {
  if (text.trim() === "") return "empty";
  return text.length > max ? "over" : null;
}
