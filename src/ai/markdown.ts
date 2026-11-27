// Markdown helpers shared by the validator (clean text fields) and the fact-check (compare lines). Pure.

/** Leading markers: heading marks (#), quote (>), list markers (-, *, •, ·, "1."). Stripped one after the other. */
const LEAD = /^(?:#{1,6}\s+|>\s*|[-*•·]\s+|\d{1,3}\.\s+)/;

function stripLead(s: string): string {
  let cur = s.trim();
  for (let i = 0; i < 8; i++) {
    const next = cur.replace(LEAD, "").trim();
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/** A text field of the model output: no emphasis or code marks (**, __, `), no heading or leading list marker. */
export function cleanText(s: string): string {
  return stripLead(s.replace(/\*\*|__|`/g, ""));
}

/** An original line or a source line, to compare: markers and markdown marks removed, whitespace collapsed. */
export function plainLine(s: string): string {
  return stripLead(s)
    .replace(/[*_`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A multi-line text as one plain string (empty lines dropped). */
export function plainText(s: string): string {
  return s
    .split(/\r?\n/)
    .map(plainLine)
    .filter((l) => l !== "")
    .join(" ");
}
