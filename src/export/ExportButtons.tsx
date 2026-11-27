import { useId } from "react";
import { useT } from "../i18n/index.ts";
import type { Resume } from "../resume/model.ts";
import { toMarkdown } from "./markdown.ts";
import "../styles/print.css";

/** Saves the Markdown of the resume as resume-en.md / resume-zh.md. */
export function downloadMarkdown(resume: Resume, lang: "en" | "zh"): void {
  const blob = new Blob([toMarkdown(resume, lang)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resume-${lang}.md`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

/** "Save as PDF" (the print dialog) and "Download Markdown". Both are disabled while `open` red items remain. */
export function ExportButtons({ resume, lang, open = 0 }: { resume: Resume; lang: "en" | "zh"; open?: number }) {
  const t = useT();
  const reasonId = useId();
  const blocked = open > 0;
  const reason = t("flow.export.reason");
  const props = { disabled: blocked, title: blocked ? reason : undefined, "aria-describedby": blocked ? reasonId : undefined } as const;
  return (
    <>
      <button type="button" className="btn btn-sm btn-secondary" {...props} onClick={() => window.print()}>
        {t("flow.export.pdf")}
      </button>
      <button type="button" className="btn btn-sm btn-secondary" {...props} onClick={() => downloadMarkdown(resume, lang)}>
        {t("flow.export.md")}
      </button>
      {blocked ? (
        <span className="fsmall fhint" id={reasonId}>
          {reason}
        </span>
      ) : null}
    </>
  );
}
