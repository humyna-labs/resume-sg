export const DEFAULT_MODEL = "claude-sonnet-5-5";

const MODEL_RE = /^[a-z0-9][a-z0-9.-]{1,63}$/;

export function isValidModel(id: string): boolean {
  return MODEL_RE.test(id);
}
