import { cloneElement, createElement, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import type { Resume } from "../resume/model.ts";
import type { TemplateLang } from "./common.ts";
import { htmlLang } from "./common.ts";
import { paginate } from "./paginate.ts";
import { buildUnits } from "./units.tsx";
import type { Unit, Variant } from "./units.tsx";
import "./layout.css";

const PAGE_H = 1123;
/** Space above and below the flow on a continuation page (the CSS of each template has the same numbers). */
const PAGE_PAD: Record<Variant, { top: number; bottom: number }> = {
  classic: { top: 52, bottom: 48 },
  modern: { top: 44, bottom: 48 },
};

function tree(units: readonly Unit[], idxs: readonly number[], depth: number, first: number): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < idxs.length) {
    const at = idxs[i] as number;
    const unit = units[at] as Unit;
    const wrap = unit.wrap[depth];
    if (!wrap) {
      const node = unit.node as ReactElement<{ className?: string }>;
      out.push(cloneElement(node, { key: at, "data-unit": at, className: `${node.props.className ?? ""}${at === first ? " u-first" : ""}` } as object));
      i++;
      continue;
    }
    let j = i;
    while (j < idxs.length && units[idxs[j] as number]?.wrap[depth]?.key === wrap.key) j++;
    out.push(createElement(wrap.tag, { key: `${wrap.key}@${at}`, ...wrap.props }, tree(units, idxs.slice(i, j), depth + 1, first)));
    i = j;
  }
  return out;
}

const range = (a: number, b: number): number[] => Array.from({ length: Math.max(0, b - a) }, (_, k) => a + k);

interface Props {
  resume: Resume;
  lang: TemplateLang;
  variant: Variant;
  /** Name of the template, for `data-template` and the root class. */
  rootClass: string;
  /** The header block; shown on the first page only. */
  header: ReactNode;
}

/**
 * Lays the units out on A4 pages of 794 x 1123 px: first everything on one page to measure it, then page by page
 * (no heading or entry line ends a page, the last two bullets stay together). The same boxes are used in print.
 */
export function Paged({ resume, lang, variant, rootClass, header }: Props) {
  const units = useMemo(() => buildUnits(resume, lang, variant), [resume, lang, variant]);
  const [paged, setPaged] = useState<{ units: Unit[]; starts: number[] } | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const ready = paged !== null && paged.units === units;

  // Runs after every render until the current units are paginated; it stops by itself (ready).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (ready) return;
    const root = rootRef.current;
    const page = root?.querySelector<HTMLElement>("[data-page]");
    const flow = root?.querySelector<HTMLElement>("[data-flow]");
    if (!root || !page || !flow) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-unit]"));
    const scale = page.offsetWidth > 0 ? page.getBoundingClientRect().width / page.offsetWidth : 1;
    const heights = els.map((e) => e.getBoundingClientRect().height / scale);
    const pads = els.map((e) => parseFloat(getComputedStyle(e).paddingTop) || 0);
    const flowTop = (flow.getBoundingClientRect().top - page.getBoundingClientRect().top) / scale;
    const pad = PAGE_PAD[variant];
    const cap1 = PAGE_H - flowTop - pad.bottom - 1;
    const capN = PAGE_H - pad.top - pad.bottom - 1;
    const starts = els.length === units.length ? paginate(heights, pads, units.map((u) => u.keep), cap1, capN) : [0];
    setPaged({ units, starts });
  });

  const starts = ready ? paged.starts : [0];
  const pages = starts.map((s, i) => [s, starts[i + 1] ?? units.length] as const);
  const name = resume.basics.name.trim();

  return (
    <article ref={rootRef} className={`tpl ${rootClass}`} data-template={variant} data-print-root lang={htmlLang(lang)}>
      {pages.map(([from, to], i) => (
        <div className={`pg${i > 0 ? " cont" : ""}`} data-page key={i}>
          {i === 0 ? header : null}
          <div className="flow" data-flow>
            {tree(units, range(from, to), 0, from)}
          </div>
          {pages.length > 1 ? (
            <div className="pg-foot" data-part="footer">
              {`${name !== "" ? `${name} · ` : ""}${i + 1}/${pages.length}`}
            </div>
          ) : null}
        </div>
      ))}
    </article>
  );
}
