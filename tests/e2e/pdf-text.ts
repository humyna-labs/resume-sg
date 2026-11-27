// A small PDF text extractor for the Chromium (Skia) PDFs that page.pdf() writes. No dependency: it inflates the
// streams, reads each font's ToUnicode map, and decodes the hex strings of the Tj / TJ operators.
// It is good enough to answer "is this text selectable (real text, not an image or outlines)?".
import { inflateSync } from "node:zlib";

interface Obj {
  num: number;
  dict: string;
  data: Buffer | null;
}

function readObjects(pdf: Buffer): Obj[] {
  const raw = pdf.toString("latin1");
  const out: Obj[] = [];
  const re = /(\d+) 0 obj([\s\S]*?)endobj/g;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    const body = m[2] ?? "";
    const at = body.indexOf("stream");
    if (at < 0 || !/stream\r?\n/.test(body.slice(at, at + 8))) {
      out.push({ num: Number(m[1]), dict: body, data: null });
      continue;
    }
    const dict = body.slice(0, at);
    const start = at + (body.slice(at, at + 8).startsWith("stream\r\n") ? 8 : 7);
    let end = body.lastIndexOf("endstream");
    if (end < 0) end = body.length;
    let data = Buffer.from(body.slice(start, end), "latin1");
    if (/FlateDecode/.test(dict)) {
      try {
        data = inflateSync(data);
      } catch {
        try {
          data = inflateSync(data.subarray(0, Math.max(0, data.length - 1)));
        } catch {
          /* keep the raw bytes */
        }
      }
    }
    out.push({ num: Number(m[1]), dict, data });
  }
  return out;
}

const hexOf = (s: string): string => s.replace(/\s+/g, "");
const utf16 = (hex: string): string => {
  let s = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return s;
};

function parseCMap(text: string): { map: Map<number, string>; width: number } {
  const map = new Map<number, string>();
  let width = 4;
  for (const blk of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of (blk[1] ?? "").matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      width = (m[1] ?? "").length;
      map.set(parseInt(m[1] ?? "0", 16), utf16(hexOf(m[2] ?? "")));
    }
  }
  for (const blk of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of (blk[1] ?? "").matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)) {
      width = (m[1] ?? "").length;
      const lo = parseInt(m[1] ?? "0", 16);
      const hi = parseInt(m[2] ?? "0", 16);
      if (m[4] !== undefined) {
        const first = hexOf(m[4]);
        const base = parseInt(first.slice(-4), 16);
        for (let c = lo; c <= hi; c++) map.set(c, utf16(first.slice(0, -4)) + String.fromCharCode(base + (c - lo)));
      } else {
        const items = [...(m[5] ?? "").matchAll(/<([0-9a-fA-F]+)>/g)];
        for (let c = lo; c <= hi; c++) map.set(c, utf16(hexOf(items[c - lo]?.[1] ?? "")));
      }
    }
  }
  return { map, width };
}

/** The text drawn by the PDF's text operators, in drawing order, with one space between runs. */
export function pdfText(pdf: Buffer): string {
  const objs = readObjects(pdf);
  const byNum = new Map(objs.map((o) => [o.num, o]));
  // font object number -> its ToUnicode map
  const fontMaps = new Map<number, ReturnType<typeof parseCMap>>();
  for (const o of objs) {
    const tu = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(o.dict);
    if (!tu || !/\/Type\s*\/Font/.test(o.dict)) continue;
    const cm = byNum.get(Number(tu[1]));
    if (cm?.data) fontMaps.set(o.num, parseCMap(cm.data.toString("latin1")));
  }
  // resource name (/F4) -> font object number (Skia keeps the names the same on every page)
  const names = new Map<string, number>();
  for (const o of objs) for (const m of o.dict.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) names.set(m[1] ?? "", Number(m[2]));

  const runs: string[] = [];
  for (const o of objs) {
    if (!o.data || /\/(Type\s*\/XObject|Subtype\s*\/Image|Length1)/.test(o.dict)) continue;
    const src = o.data.toString("latin1");
    if (!/\bTf\b/.test(src)) continue;
    let cur: ReturnType<typeof parseCMap> | undefined;
    const tok = /\/(F\d+)\s+[\d.]+\s+Tf|\[((?:[^\]]|\\\])*)\]\s*TJ|<([0-9a-fA-F\s]*)>\s*Tj/g;
    for (let m = tok.exec(src); m; m = tok.exec(src)) {
      if (m[1]) {
        cur = fontMaps.get(names.get(m[1]) ?? -1);
        continue;
      }
      if (!cur) continue;
      const hexes = m[2] !== undefined ? [...m[2].matchAll(/<([0-9a-fA-F\s]*)>/g)].map((x) => hexOf(x[1] ?? "")) : [hexOf(m[3] ?? "")];
      let line = "";
      for (const h of hexes) for (let i = 0; i + cur.width <= h.length; i += cur.width) line += cur.map.get(parseInt(h.slice(i, i + cur.width), 16)) ?? "";
      runs.push(line);
    }
  }
  return runs.join(" ");
}

/** The MediaBox of the first page, in points. */
export function mediaBox(pdf: Buffer): { w: number; h: number } | null {
  const m = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf.toString("latin1"));
  return m ? { w: parseFloat(m[1] ?? "0"), h: parseFloat(m[2] ?? "0") } : null;
}

/** Text without any whitespace: letter-spaced headings are drawn one glyph at a time. */
export const compact = (s: string): string => s.replace(/\s+/g, "");

export const pageCount = (pdf: Buffer): number => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
