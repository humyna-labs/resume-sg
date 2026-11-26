// The Anthropic key lives in this module's memory. It is written to localStorage
// (slot "jd2cv.apiKey") only while the user has chosen "Remember on this device".
const SLOT = "jd2cv.apiKey";

let memory = "";

function stored(): string | null {
  try {
    return localStorage.getItem(SLOT);
  } catch {
    return null;
  }
}

function write(key: string | null): void {
  try {
    if (key === null) localStorage.removeItem(SLOT);
    else localStorage.setItem(SLOT, key);
  } catch {
    // storage unavailable: the key stays in memory only
  }
}

export function getKey(): string {
  return memory || stored() || "";
}

export function setKey(key: string, remember: boolean): void {
  memory = key;
  write(remember ? key : null);
}

export function clearKey(): void {
  memory = "";
  write(null);
}

export function isRemembered(): boolean {
  return stored() !== null;
}
