import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { TailorOutput } from "../../ai/types.ts";
import type { OutputLang } from "../../ai/tailor.ts";
import { targetPages } from "../../layout/pageFit.ts";
import { tighten } from "../../layout/pageFit.ts";
import { TemplateView } from "../templates/TemplateView.tsx";
import type { TemplateId } from "../../templates/index.ts";
import { prepare, toResume } from "./apply.ts";
import type { Decision, Finding } from "../../ai/types.ts";

export interface Fit {
  shown: TailorOutput;
  /** Still more than two pages after everything that may move has moved. */
  over: boolean;
}

const nowMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Renders the active template off screen (in the browser, nothing is sent anywhere) and counts its A4 pages. */
function measurer(tpl: TemplateId, lang: OutputLang) {
  // The same ancestors and classes as the visible preview, so that inherited text styles (and so the page breaks) match.
  const chain = ["wz wz-result", "fgrid res", "fcol", "card preview fpreview", "tpl-stage"].map((c) => {
    const el = document.createElement("div");
    el.className = c;
    return el;
  });
  chain.forEach((el, i) => chain[i - 1]?.appendChild(el));
  const outer = chain[0] as HTMLElement;
  const host = chain[chain.length - 1] as HTMLElement;
  (chain[3] as HTMLElement).setAttribute("data-template", tpl);
  outer.setAttribute("aria-hidden", "true");
  outer.style.cssText = "position:fixed;left:-10000px;top:0;width:1400px;visibility:hidden;pointer-events:none;";
  (document.querySelector(".wz")?.parentElement ?? document.body).appendChild(outer);
  const root = createRoot(host);
  const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  return {
    pages(out: TailorOutput): number {
      const saved = g.IS_REACT_ACT_ENVIRONMENT;
      g.IS_REACT_ACT_ENVIRONMENT = false;
      try {
        flushSync(() => root.render(<TemplateView id={tpl} resume={toResume(out)} lang={lang} />));
      } finally {
        g.IS_REACT_ACT_ENVIRONMENT = saved;
      }
      const n = Math.max(1, host.querySelectorAll("[data-page]").length);
            return n;
    },
    dispose() {
      const saved = g.IS_REACT_ACT_ENVIRONMENT;
      g.IS_REACT_ACT_ENVIRONMENT = false;
      try {
        flushSync(() => root.unmount());
      } finally {
        g.IS_REACT_ACT_ENVIRONMENT = saved;
      }
      outer.remove();
    },
  };
}

/** The displayed result: decisions and put-back lines applied, then tightened to the page target. */
export function computeFit(
  output: TailorOutput,
  findings: Finding[],
  decisions: Record<string, Decision>,
  putBack: string[],
  original: string,
  heading: string,
  tpl: TemplateId,
  lang: OutputLang,
): Fit {
  const { pre, fixed } = prepare(output, findings, decisions, putBack, original, heading);
  const m = measurer(tpl, lang);
  try {
    const target = targetPages(toResume(pre), nowMonth());
    const shown = tighten(pre, (r) => m.pages(r), target, fixed);
    return { shown, over: m.pages(shown) > 2 };
  } finally {
    m.dispose();
  }
}
