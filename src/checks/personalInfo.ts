import type { Resume } from "../resume/model.ts";

export type PersonalInfoId = "photo" | "age" | "id-number" | "marital" | "religion";
export type FieldKind = "summary" | "basics" | "experience" | "education" | "skills" | "certificates" | "languages";

export interface PersonalInfoFinding {
  id: PersonalInfoId;
  /** The DOM id of the editor field the text was found in. */
  where: string;
  match: string;
}
export interface PersonalInfoFindingIn extends PersonalInfoFinding {
  kind: FieldKind;
}

const RULES: readonly (readonly [PersonalInfoId, readonly RegExp[]])[] = [
  ["photo", [/\bphotos?\b/i, /\bphotographs?\b/i, /照片/]],
  [
    "age",
    [
      /\bage\s*[:：]?\s*\d{1,3}\b/i,
      /\b\d{1,3}\s*years?\s*old\b/i,
      /\bdate\s+of\s+birth\b/i,
      /\bdob\b/i,
      /\bborn\s+(?:in\s+)?\d{4}\b/i,
      /出生日期/,
      /年龄/,
      /\d{4}\s*年\s*\d{1,2}\s*月出生/,
    ],
  ],
  [
    "id-number",
    [
      /\b[STFGM]\d{7}[A-Z]\b/i,
      /(?<!\d)\d{17}[\dXx](?![\dXx])/,
      /\bNRIC\b/i,
      /\bFIN\s+no\b/i,
      /身份证/,
      /\bpassport\s+(?:no|number)\b/i,
      /护照号/,
    ],
  ],
  ["marital", [/\bmarital\s+status\b/i, /\bmarried\b/i, /\bstatus\s*[:：]\s*single\b/i, /已婚/, /未婚/, /婚姻状况/]],
  ["religion", [/\breligion\b/i, /宗教/]],
];

function* fields(r: Resume): Generator<[string, FieldKind, string]> {
  const b = r.basics;
  yield ["b-name", "basics", b.name];
  yield ["b-headline", "basics", b.headline];
  yield ["b-email", "basics", b.email];
  yield ["b-phone", "basics", b.phone];
  yield ["b-location", "basics", b.location];
  for (const [i, v] of b.links.entries()) yield [`b-link-${i}`, "basics", v];
  yield ["summary", "summary", r.summary];
  for (const e of r.experience) {
    yield [`${e.id}-company`, "experience", e.company];
    yield [`${e.id}-title`, "experience", e.title];
    yield [`${e.id}-location`, "experience", e.location];
    for (const [i, v] of e.bullets.entries()) yield [`${e.id}-bullet-${i}`, "experience", v];
  }
  for (const e of r.education) {
    yield [`${e.id}-school`, "education", e.school];
    yield [`${e.id}-degree`, "education", e.degree];
    for (const [i, v] of e.details.entries()) yield [`${e.id}-detail-${i}`, "education", v];
  }
  for (const g of r.skills) {
    yield [`${g.id}-name`, "skills", g.name];
    for (const [i, v] of g.items.entries()) yield [`${g.id}-item-${i}`, "skills", v];
  }
  for (const [i, v] of r.certificates.entries()) yield [`cert-${i}`, "certificates", v];
  for (const [i, v] of r.languages.entries()) yield [`lang-${i}`, "languages", v];
}

/** Every hit, with the kind of field it was in. Suggestions only; nothing is changed. */
export function personalInfoFindingsIn(resume: Resume): PersonalInfoFindingIn[] {
  const out: PersonalInfoFindingIn[] = [];
  for (const [where, kind, text] of fields(resume)) {
    if (text === "") continue;
    for (const [id, res] of RULES) {
      for (const re of res) {
        const m = re.exec(text);
        if (m) {
          out.push({ id, where, kind, match: m[0] });
          break;
        }
      }
    }
  }
  return out;
}

export function personalInfoFindings(resume: Resume): PersonalInfoFinding[] {
  return personalInfoFindingsIn(resume).map(({ id, where, match }) => ({ id, where, match }));
}
