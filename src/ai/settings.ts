export const DEFAULT_MODEL = "claude-sonnet-5-5";

const MODEL_RE = /^[a-z0-9][a-z0-9.-]{1,63}$/;

export function isValidModel(id: string): boolean {
  return MODEL_RE.test(id);
}

export const MODEL_CHOICES = [
  { value: DEFAULT_MODEL, labelKey: "ai.model.sonnet" },
  { value: "claude-opus-5-5", labelKey: "ai.model.opus" },
  { value: "claude-haiku-5-5", labelKey: "ai.model.haiku" },
] as const;

export const CUSTOM_CHOICE = "__custom__";
