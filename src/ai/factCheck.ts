// Fact-check (brief v5.2 section 4): code, no AI. Pure: no network, storage or randomness.
import { plainLine, plainText } from "./markdown.ts";
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

// Number units compare by value: 18 万 = 180,000 = 180k.
const UNITS: Record<string, number> = { 万: 1e4, 千: 1e3, 亿: 1e8, k: 1e3, m: 1e6, b: 1e9 };

function extractNumbers(text: string): NumToken[] {
  const out: NumToken[] = [];
  const digits = /(S\$|US\$|[$¥￥€£])?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(\s?[万千亿]|[kKmMbB](?![A-Za-z]))?(%)?/g;
  for (const m of text.matchAll(digits)) {
    const n = Number((m[2] ?? "").replace(/,/g, ""));
    const unit = (m[3] ?? "").replace(/\s/g, "").toLowerCase();
    out.push({ raw: m[0], value: String(Math.round(n * (UNITS[unit] ?? 1) * 1e6) / 1e6) });
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

/** Language names that mean the same language in Chinese and English (owner map, resume-sg#38). */
export const LANGUAGE_NAMES: readonly (readonly string[])[] = [
  ["英语", "English"],
  ["普通话", "中文", "汉语", "Mandarin", "Chinese"],
  ["粤语", "Cantonese"],
  ["马来语", "Malay"],
  ["泰米尔语", "Tamil"],
  ["印尼语", "Indonesian"],
  ["日语", "Japanese"],
  ["韩语", "Korean"],
  ["法语", "French"],
  ["德语", "German"],
  ["西班牙语", "Spanish"],
  ["越南语", "Vietnamese"],
  ["泰语", "Thai"],
];

const stripProficiency = (s: string): string => normalise(s.replace(/\s*[(（][^)）]*[)）]/g, ""));

// ---------------------------------------------------------------- strong sources (brief v8 section 1)
type Strength = "missing" | "weak" | "strong";
interface PLine {
  idx: number;
  text: string;
}
/** A line covered by a strong source: the characters the source holds of it, in tenths: len * 10 >= line * 6. */
const coversLine = (part: number, line: number): boolean => part * 10 >= line * 6;
const ENTRY_MIN = 12;
const ENTRY_MIN_CJK = 6;
const isMostlyCjk = (s: string): boolean => {
  const han = (s.match(HAN_RE) ?? []).length;
  const latin = (s.match(LATIN_RE) ?? []).length;
  return han > 0 && han >= latin;
};

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
  const src = detectLang(original);
  const cross = opts?.outputLang !== undefined && opts.outputLang !== src;
  const zhToEn = cross && src === "zh";
  const r = out.resume;
  const badSources: string[] = [];
  const origLines = original.split(/\r?\n/);
  const plines: PLine[] = [];
  origLines.forEach((raw, idx) => {
    if (!/[\p{L}\p{N}]/u.test(raw)) return;
    const text = plainLine(raw);
    if (text !== "") plines.push({ idx, text });
  });
  /** Positions (in plines) of original lines covered by a strong source. */
  const covered = new Set<number>();
  const heads = (fields: string[]): string[] => fields.map((f) => normalise(f).toLowerCase()).filter((f) => f !== "");
  const origDates = sourceDates(original);
  const origNumbers = new Set(extractNumbers(original).map((n) => n.value));

  /** The source and its block: the original's lines from 1 line before the source to 3 lines after it. */
  const scopeOf = (source: string): string => {
    const tokens = source.trim().split(/\s+/).filter((x) => x !== "");
    if (tokens.length === 0) return source;
    const m = new RegExp(tokens.map(escapeRe).join("\\s+")).exec(original);
    if (!m) return source;
    const first = original.slice(0, m.index).split("\n").length - 1;
    const last = first + m[0].split("\n").length - 1;
    return `${source}\n${origLines.slice(Math.max(0, first - 1), last + 4).join("\n")}`;
  };

  /**
   * (a): "missing" when the source is not in the original (red); "weak" when it is in the original but not strong
   * (amber, "source too short to check"); "strong" otherwise. A strong source covers the original lines it holds.
   * `entry` is given for an experience, project or education source: a run of consecutive lines with one of its heads.
   */
  const checkSource = (where: string, source: string, entry?: string[]): Strength => {
    const s = normalise(source);
    const srcLines = source.split(/\r?\n/).map(plainLine).filter((l) => l !== "");
    const inLines = srcLines.length > 0 && srcLines.every((l) => plines.some((p) => p.text.includes(l)));
    if (s === "" || (!norm.includes(s) && !(entry !== undefined && inLines))) {
      add("red", "source", where, source);
      if (s !== "") badSources.push(s);
      return "missing";
    }
    const weak = (): Strength => {
      add("amber", "source", where, source);
      return "weak";
    };
    const k = srcLines.length;
    if (entry === undefined) {
      if (k !== 1) return weak();
      const sp = srcLines[0] ?? "";
      let best = -1;
      plines.forEach((p, i) => {
        if (p.text.includes(sp) && (best < 0 || p.text.length < (plines[best]?.text.length ?? 0))) best = i;
      });
      if (best < 0 || !coversLine(sp.length, plines[best]?.text.length ?? 1)) return weak();
      covered.add(best);
      return "strong";
    }
    const total = srcLines.join(" ");
    if (total.length < (isMostlyCjk(total) ? ENTRY_MIN_CJK : ENTRY_MIN)) return weak();
    for (let i = 0; i + k <= plines.length; i++) {
      let ok = true;
      for (let j = 0; j < k && ok; j++) {
        const pl = plines[i + j];
        const sl = srcLines[j] ?? "";
        if (!pl) ok = false;
        else ok = j === 0 || j === k - 1 ? pl.text.includes(sl) : pl.text === sl;
      }
      if (!ok) continue;
      if (!cross && entry.length > 0) {
        const run = plines.slice(i, i + k).map((p) => p.text.toLowerCase());
        if (!entry.some((h) => run.some((t) => t.includes(h)))) continue;
      }
      srcLines.forEach((sl, j) => {
        const len = plines[i + j]?.text.length ?? 1;
        if (sl.length >= len || coversLine(sl.length, len)) covered.add(i + j);
      });
      return "strong";
    }
    return weak();
  };

  /** (c): each fact must occur in the entry's source, which must itself have passed (a). */
  const checkFacts = (where: string, sourceOk: boolean, source: string, facts: [string, string][]): void => {
    if (zhToEn) return; // zh original, en output: these fields are not checked against the original.
    if (cross) {
      // Cross language: only Latin-script tokens (brand names) must occur in the original.
      for (const [field, value] of facts) {
        for (const m of value.matchAll(/[A-Za-z][A-Za-z0-9]+/g)) {
          if (!occurs(norm, m[0])) add("red", "unsourced", field ? `${where}.${field}` : where, m[0]);
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

  const checkDates = (where: string, sourceOk: boolean, scope: string, dates: [string, string][]): void => {
    const set = sourceDates(scope);
    for (const [field, value] of dates) {
      if (normalise(value) === "") continue;
      if (!sourceOk) {
        add("red", "unsourced", `${where}.${field}`, value);
        continue;
      }
      const token = parseDate(value);
      const ok = token === null ? normalise(scope).includes(normalise(value)) : set.has(token);
      if (ok) continue;
      const elsewhere = token === null ? norm.includes(normalise(value)) : origDates.has(token);
      add(elsewhere ? "amber" : "red", "date", `${where}.${field}`, value);
    }
  };

  /** A number passes in the scope; elsewhere in the original it is amber; nowhere it is red. */
  const checkNumbers = (where: string, text: string, scope: string): void => {
    const have = new Set(extractNumbers(scope).map((n) => n.value));
    for (const n of extractNumbers(text)) {
      if (!have.has(n.value)) add(origNumbers.has(n.value) ? "amber" : "red", "number", where, n.raw.trim());
    }
  };

  const checkBullets = (where: string, bullets: SourcedText[], entryScope: string): void => {
    bullets.forEach((b, i) => {
      const w = `${where}.bullets[${i}]`;
      const st = checkSource(w, b.source);
      if (st === "strong") checkNumbers(w, b.text, `${scopeOf(b.source)}\n${entryScope}`);
      else for (const n of extractNumbers(b.text)) add("red", "number", w, n.raw.trim());
    });
  };

  const expScope = new Map<string, string>();
  r.experience.forEach((e) => expScope.set(e.id, scopeOf(e.source)));
  r.experience.forEach((e, i) => {
    const w = `experience[${i}]`;
    const ok = checkSource(w, e.source, heads([e.company, e.title])) !== "missing";
    checkFacts(w, ok, e.source, [["company", e.company], ["title", e.title]]);
    if (cross && normalise(e.title) !== "") add("amber", "translated", `${w}.title`, e.title);
    const scope = expScope.get(e.id) ?? e.source;
    checkDates(w, ok, scope, [["start", e.start], ["end", e.end]]);
    checkBullets(w, e.bullets, scope);
  });
  r.projects.forEach((p, i) => {
    const w = `projects[${i}]`;
    const ok = checkSource(w, p.source, heads([p.name])) !== "missing";
    checkFacts(w, ok, p.source, [["name", p.name]]);
    const parent = p.experienceId === undefined ? undefined : expScope.get(p.experienceId);
    const scope = `${scopeOf(p.source)}${parent === undefined ? "" : `\n${parent}`}`;
    checkDates(w, ok, scope, [["start", p.start], ["end", p.end]]);
    checkBullets(w, p.bullets, scope);
  });
  r.education.forEach((e, i) => {
    const w = `education[${i}]`;
    const ok = checkSource(w, e.source, heads([e.school, e.degree])) !== "missing";
    checkFacts(w, ok, e.source, [["school", e.school], ["degree", e.degree]]);
    if (cross && normalise(e.degree) !== "") add("amber", "translated", `${w}.degree`, e.degree);
    checkDates(w, ok, scopeOf(e.source), [["start", e.start], ["end", e.end]]);
  });
  r.certificates.forEach((c, i) => {
    const w = `certificates[${i}]`;
    const ok = checkSource(w, c.source) !== "missing";
    checkFacts(w, ok, c.source, [["", c.text]]);
  });
  r.extras.forEach((x, i) =>
    x.items.forEach((item, j) => {
      const w = `extras[${i}].items[${j}]`;
      const ok = checkSource(w, item.source) !== "missing";
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
  /** The text before a bracketed gloss: "LiteFlow（规则引擎）" gives "LiteFlow". Empty for a gloss alone. */
  const glossBase = (item: string): string => /^(.*?)\s*[(（][^)）]*[)）]\s*$/.exec(normalise(item))?.[1]?.trim() ?? "";
  const checkItem = (where: string, item: string): void => {
    if (normalise(item) === "" || occurs(norm, item)) return;
    const base = glossBase(item);
    if (base !== "" && occurs(norm, base)) return;
    const red = !cross || (zhToEn ? /[A-Za-z]/.test(item) && !/\s/.test(normalise(item)) : isLatinItem(item));
    add(red ? "red" : "amber", "item", where, item);
  };
  const checkLanguage = (where: string, item: string): void => {
    if (!cross) return checkItem(where, item);
    const name = stripProficiency(item).toLowerCase();
    const group = LANGUAGE_NAMES.find((g) => g.some((n) => n.toLowerCase() === name));
    if (!group) return checkItem(where, item);
    const found = group.some((n) => (/[A-Za-z]/.test(n) ? occurs(norm, n) : norm.includes(n)));
    if (!found) add("red", "item", where, item);
  };
  r.skills.forEach((s, i) => s.items.forEach((it, j) => checkItem(`skills[${i}].items[${j}]`, it)));
  r.projects.forEach((p, i) => p.tech.forEach((it, j) => checkItem(`projects[${i}].tech[${j}]`, it)));
  r.languages.forEach((it, i) => checkLanguage(`languages[${i}]`, it));

  // (b) summary: numbers may come from anywhere in the original.
  checkNumbers("summary", r.summary, original);

  // (d) coverage.
  const badPlain = badSources.map(plainText).filter((s) => s !== "");
  const posOf = new Map(plines.map((p, i) => [p.idx, i]));
  origLines.forEach((rawLine, i) => {
    if (!/[\p{L}\p{N}]/u.test(rawLine)) return; // ---, ***, |---|: no letter, digit or CJK character
    if (covered.has(posOf.get(i) ?? -1)) return;
    const line = plainLine(rawLine);
    if (line === "") return;
    if (HEADINGS.has(line.replace(/\s*[:：]$/, "").toLowerCase())) return;
    const ll = line.toLowerCase();
    if (name !== "" && ll.includes(name)) return;
    if (email !== "" && ll.includes(email)) return;
    if (phoneDigits !== "" && digitsOf(line).includes(phoneDigits)) return;
    if (badPlain.some((s) => line.includes(s) || s.includes(line))) return;
    // A source that failed (a) is already red; it still stands for the line it tried to cite.
    if (badPlain.some((s) => dice(s, line) >= 0.6)) return;
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
