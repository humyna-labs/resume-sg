// Fact-check (brief v5.2 section 4): code, no AI. Pure: no network, storage or randomness.
import type { Decision, Finding, FindingKind, SourcedText, TailorOutput } from "./types.ts";

export function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------- numbers
const EN_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const ZH_DIGITS: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
// Characters that make a 一..十 run part of an ordinary word (一起, 统一, 第一, 十分, ...).
const ZH_BEFORE_NOT_NUMBER = new Set("第统唯同万之纯单专归划");
const ZH_AFTER_NOT_NUMBER = new Set("起直些下切定般样致流体线键站向贯再面度概味旦心分足");

interface NumToken {
  raw: string;
  value: string;
}

function zhRunValue(run: string): number | null {
  if (run.length === 1) return run === "十" ? 10 : (ZH_DIGITS[run] ?? null);
  const m = /^([一二两三四五六七八九])?十([一二三四五六七八九])?$/.exec(run);
  if (!m) return null;
  return (m[1] ? (ZH_DIGITS[m[1]] ?? 0) : 1) * 10 + (m[2] ? (ZH_DIGITS[m[2]] ?? 0) : 0);
}

function extractNumbers(text: string): NumToken[] {
  const out: NumToken[] = [];
  const digits = /(S\$|US\$|[$¥￥€£])?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\s?[万千亿]|[kKmMbB](?![A-Za-z]))?(%)?/g;
  for (const m of text.matchAll(digits)) {
    const n = Number((m[2] ?? "").replace(/,/g, ""));
    const suffix = (m[3] ?? "").replace(/\s/g, "").toLowerCase();
    out.push({ raw: m[0], value: `${n}${suffix}` });
  }
  for (const m of text.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi)) {
    out.push({ raw: m[0], value: String(EN_WORDS[m[0].toLowerCase()]) });
  }
  for (const m of text.matchAll(/[一二两三四五六七八九十]+/g)) {
    const run = m[0];
    const idx = m.index ?? 0;
    const before = text[idx - 1] ?? "";
    const after = text[idx + run.length] ?? "";
    if (ZH_BEFORE_NOT_NUMBER.has(before) || ZH_AFTER_NOT_NUMBER.has(after)) continue;
    const v = zhRunValue(run);
    if (v !== null) out.push({ raw: run, value: String(v) });
    else for (const ch of run) out.push({ raw: ch, value: String(ch === "十" ? 10 : ZH_DIGITS[ch]) });
  }
  return out;
}

// ---------------------------------------------------------------- dates
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const PRESENT = "present";
const PRESENT_RE = /至今|\b(?:present|now|current)\b/i;

function monthNumber(word: string): number | null {
  const w = word.toLowerCase();
  if (w.length < 3) return null;
  const i = MONTHS.findIndex((m) => m.startsWith(w));
  return i < 0 ? null : i + 1;
}
const ym = (y: string, m: number): string => `${y}-${String(m).padStart(2, "0")}`;

function parseDate(value: string): string | null {
  const s = value.trim();
  if (PRESENT_RE.test(s) && !/\d/.test(s)) return PRESENT;
  let m = /^(\d{4})\s*[.\-/年]\s*(\d{1,2})\s*月?$/.exec(s);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return ym(m[1] ?? "", Number(m[2]));
  m = /^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(s);
  if (m) {
    const mo = monthNumber(m[1] ?? "");
    if (mo) return ym(m[2] ?? "", mo);
  }
  m = /^(\d{4})\s*年?$/.exec(s);
  if (m) return m[1] ?? null;
  return null;
}

function sourceDates(source: string): Set<string> {
  const set = new Set<string>();
  if (PRESENT_RE.test(source)) set.add(PRESENT);
  for (const m of source.matchAll(/(\d{4})\s*[.\-/年]\s*(\d{1,2})(?!\d)/g)) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) {
      set.add(ym(m[1] ?? "", mo));
      set.add(m[1] ?? "");
    }
  }
  for (const m of source.matchAll(/([A-Za-z]{3,9})\.?,?\s+(\d{4})(?!\d)/g)) {
    const mo = monthNumber(m[1] ?? "");
    if (mo) set.add(ym(m[2] ?? "", mo));
  }
  for (const m of source.matchAll(/(?<!\d)\d{4}(?!\d)/g)) set.add(m[0]);
  return set;
}

// ---------------------------------------------------------------- coverage
const HEADINGS = new Set(
  [
    "experience", "work experience", "education", "skills", "projects", "summary", "certificates", "languages",
    "工作经历", "教育背景", "专业技能", "项目经历", "个人简介", "自我评价", "证书", "语言",
  ].map((h) => h.toLowerCase()),
);

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}
function dice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const ga = bigrams(a);
  const gb = bigrams(b);
  let hit = 0;
  for (const [g, n] of ga) hit += Math.min(n, gb.get(g) ?? 0);
  return (2 * hit) / (a.length - 1 + (b.length - 1));
}

// ---------------------------------------------------------------- language, basics, items
const HAN_RE = /\p{Script=Han}/gu;
const LATIN_RE = /[A-Za-z]/g;

/** "zh" when Han characters are at least 30% of the letters (Han plus Latin) of the text, else "en". */
export function detectLang(text: string): "en" | "zh" {
  const han = (text.match(HAN_RE) ?? []).length;
  const latin = (text.match(LATIN_RE) ?? []).length;
  const total = han + latin;
  return total > 0 && han * 100 >= 30 * total ? "zh" : "en";
}

const digitsOf = (s: string): string => s.replace(/\D/g, "");
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isLatinItem = (s: string): boolean => /[A-Za-z]/.test(s) && !/\p{Script=Han}/u.test(s);

/** Whether `item` occurs in `haystack` (case-insensitive); alphanumeric edges must sit on a word boundary. */
function occurs(haystack: string, item: string): boolean {
  const it = normalise(item);
  if (it === "") return true;
  const pre = /^[A-Za-z0-9]/.test(it) ? "(?<![A-Za-z0-9])" : "";
  const post = /[A-Za-z0-9]$/.test(it) ? "(?![A-Za-z0-9])" : "";
  return new RegExp(`${pre}${escapeRe(it)}${post}`, "i").test(haystack);
}

export const NAME_CHECK_TEXT = "请核对姓名拼写 / Check the name spelling";

// ---------------------------------------------------------------- checker
export function factCheck(original: string, out: TailorOutput, opts?: { outputLang?: "en" | "zh" }): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const add = (level: Finding["level"], kind: FindingKind, where: string, value: string): void => {
    const id = `${kind}:${where}:${value}`;
    if (seen.has(id)) return;
    seen.add(id);
    findings.push({ id, level, kind, where, value });
  };

  const norm = normalise(original);
  const lower = norm.toLowerCase();
  const cross = opts?.outputLang !== undefined && opts.outputLang !== detectLang(original);
  const r = out.resume;
  const goodSources: string[] = [];
  const badSources: string[] = [];

  /** (a): returns whether the source occurs in the original. */
  const checkSource = (where: string, source: string): boolean => {
    const s = normalise(source);
    const ok = s !== "" && norm.includes(s);
    if (ok) goodSources.push(s);
    else {
      add("red", "source", where, source);
      if (s !== "") badSources.push(s);
    }
    return ok;
  };

  /** (c): each fact must occur in the entry's source, which must itself have passed (a). */
  const checkFacts = (where: string, sourceOk: boolean, source: string, facts: [string, string][]): void => {
    if (cross) {
      // Cross language: only Latin-script tokens (brand names) must occur in the original.
      for (const [field, value] of facts) {
        for (const m of value.matchAll(/[A-Za-z][A-Za-z0-9]+/g)) {
          if (!lower.includes(m[0].toLowerCase())) add("red", "unsourced", field ? `${where}.${field}` : where, m[0]);
        }
      }
      return;
    }
    const s = normalise(source);
    for (const [field, value] of facts) {
      const v = normalise(value);
      if (v === "") continue;
      if (!sourceOk || !s.includes(v)) add("red", "unsourced", field ? `${where}.${field}` : where, value);
    }
  };

  const checkDates = (where: string, sourceOk: boolean, source: string, dates: [string, string][]): void => {
    const set = sourceDates(source);
    for (const [field, value] of dates) {
      if (normalise(value) === "") continue;
      if (!sourceOk) {
        add("red", "unsourced", `${where}.${field}`, value);
        continue;
      }
      const token = parseDate(value);
      const ok = token === null ? normalise(source).includes(normalise(value)) : set.has(token);
      if (!ok) add("red", "date", `${where}.${field}`, value);
    }
  };

  const checkNumbers = (where: string, text: string, haystack: string): void => {
    const have = new Set(extractNumbers(haystack).map((n) => n.value));
    for (const n of extractNumbers(text)) if (!have.has(n.value)) add("red", "number", where, n.raw.trim());
  };

  const checkBullets = (where: string, bullets: SourcedText[]): void => {
    bullets.forEach((b, i) => {
      const w = `${where}.bullets[${i}]`;
      checkSource(w, b.source);
      checkNumbers(w, b.text, b.source);
    });
  };

  r.experience.forEach((e, i) => {
    const w = `experience[${i}]`;
    const ok = checkSource(w, e.source);
    checkFacts(w, ok, e.source, [["company", e.company], ["title", e.title]]);
    checkDates(w, ok, e.source, [["start", e.start], ["end", e.end]]);
    checkBullets(w, e.bullets);
  });
  r.projects.forEach((p, i) => {
    const w = `projects[${i}]`;
    const ok = checkSource(w, p.source);
    checkFacts(w, ok, p.source, [["name", p.name]]);
    checkDates(w, ok, p.source, [["start", p.start], ["end", p.end]]);
    checkBullets(w, p.bullets);
  });
  r.education.forEach((e, i) => {
    const w = `education[${i}]`;
    const ok = checkSource(w, e.source);
    checkFacts(w, ok, e.source, [["school", e.school], ["degree", e.degree]]);
    checkDates(w, ok, e.source, [["start", e.start], ["end", e.end]]);
  });
  r.certificates.forEach((c, i) => {
    const w = `certificates[${i}]`;
    const ok = checkSource(w, c.source);
    checkFacts(w, ok, c.source, [["", c.text]]);
  });
  r.extras.forEach((x, i) =>
    x.items.forEach((item, j) => {
      const w = `extras[${i}].items[${j}]`;
      const ok = checkSource(w, item.source);
      checkFacts(w, ok, item.source, [["", item.text]]);
    }),
  );
  out.notIncluded.forEach((n, i) => checkSource(`notIncluded[${i}]`, n.source));

  // Basics: email, links, phone, name.
  const b = r.basics;
  const email = normalise(b.email).toLowerCase();
  if (email !== "" && !lower.includes(email)) add("red", "basics", "basics.email", b.email);
  b.links.forEach((l, i) => {
    const link = normalise(l).toLowerCase();
    if (link !== "" && !lower.includes(link)) add("red", "basics", `basics.links[${i}]`, l);
  });
  const phoneDigits = digitsOf(b.phone);
  if (phoneDigits !== "" && !original.split(/\r?\n/).some((l) => digitsOf(l).includes(phoneDigits))) {
    add("red", "basics", "basics.phone", b.phone);
  }
  const name = normalise(b.name).toLowerCase();
  if (name !== "" && !lower.includes(name)) {
    if (cross) add("amber", "basics", "basics.name", NAME_CHECK_TEXT);
    else add("red", "basics", "basics.name", b.name);
  }

  // Items: skills, project tech, languages.
  const checkItem = (where: string, item: string): void => {
    if (normalise(item) === "" || occurs(norm, item)) return;
    add(!cross || isLatinItem(item) ? "red" : "amber", "item", where, item);
  };
  r.skills.forEach((s, i) => s.items.forEach((it, j) => checkItem(`skills[${i}].items[${j}]`, it)));
  r.projects.forEach((p, i) => p.tech.forEach((it, j) => checkItem(`projects[${i}].tech[${j}]`, it)));
  r.languages.forEach((it, i) => checkItem(`languages[${i}]`, it));

  // (b) summary: numbers may come from anywhere in the original.
  checkNumbers("summary", r.summary, original);

  // (d) coverage.
  original.split(/\r?\n/).forEach((rawLine, i) => {
    const line = normalise(rawLine.trim().replace(/^(?:[-•*]|\d+\.)\s+/, ""));
    if (line === "") return;
    if (HEADINGS.has(line.replace(/\s*[:：]$/, "").toLowerCase())) return;
    const ll = line.toLowerCase();
    if (name !== "" && ll.includes(name)) return;
    if (email !== "" && ll.includes(email)) return;
    if (phoneDigits !== "" && digitsOf(line).includes(phoneDigits)) return;
    if (goodSources.some((s) => line.includes(s) || s.includes(line))) return;
    if (badSources.some((s) => line.includes(s) || s.includes(line))) return;
    // A source that failed (a) is already red; it still stands for the line it tried to cite.
    if (badSources.some((s) => dice(s, line) >= 0.6)) return;
    add("amber", "coverage", `original:line ${i + 1}`, line);
  });

  return findings;
}

export function unresolvedCount(findings: Finding[], decisions: Record<string, Decision>): number {
  return findings.filter((f) => {
    if (f.level !== "red") return false;
    const d = decisions[f.id];
    return d !== "removed" && d !== "kept";
  }).length;
}
