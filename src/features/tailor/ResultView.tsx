import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { unresolvedCount } from "../../ai/factCheck.ts";
import type { Decision, Finding, TailorOutput } from "../../ai/types.ts";
import type { StrKey } from "../../i18n/en.ts";
import { useT } from "../../i18n/index.ts";
import type { Resume } from "../../resume/model.ts";
import { TEMPLATES } from "../../templates/index.ts";
import type { TemplateId } from "../../templates/index.ts";
import { PAGE_H } from "../../layout/pageFit.ts";
import { TemplateView } from "../templates/TemplateView.tsx";
import { toResume } from "./apply.ts";
import type { OutputLang, TailorMode } from "../../ai/tailor.ts";

export interface ResultSnapshot {
  originalLen: number;
  jdLen: number;
  lang: OutputLang;
  mode: TailorMode;
  modelName: string;
}

type TabId = "check" | "changes" | "notIncluded";
type T = (key: StrKey) => string;

const fill = (s: string, n: number): string => s.replace("{n}", String(n));
const fmt = (n: number): string => n.toLocaleString("en-US");

export const TPL_KEY: Record<TemplateId, StrKey> = { classic: "flow.tpl.classic", modern: "flow.tpl.modern" };
export const MODE_KEY: Record<TailorMode, StrKey> = {
  balanced: "flow.mode.balanced",
  "results-first": "flow.mode.results",
  "career-change": "flow.mode.career",
};

const SECTION_KEY: Record<string, StrKey> = {
  basics: "flow.w.basics",
  summary: "flow.w.summary",
  experience: "flow.w.experience",
  projects: "flow.w.projects",
  education: "flow.w.education",
  certificates: "flow.w.certificates",
  skills: "flow.w.skills",
  extras: "flow.w.extras",
  languages: "flow.w.languages",
  notIncluded: "flow.w.notIncluded",
};

/** "experience[0].bullets[3]" -> "Harborline · bullet 4". Plain text. */
function whereLabel(where: string, out: TailorOutput, t: T): string {
  const m = /^([A-Za-z]+)(?:\[(\d+)\])?(.*)$/.exec(where);
  if (!m) return where;
  const section = m[1] as string;
  const idx = m[2] === undefined ? null : Number(m[2]);
  const rest = m[3] ?? "";
  const parts: string[] = [];
  parts.push(SECTION_KEY[section] ? t(SECTION_KEY[section] as StrKey) : section);
  if (idx !== null) {
    const r = out.resume;
    const name =
      section === "experience" ? r.experience[idx]?.company
      : section === "projects" ? r.projects[idx]?.name
      : section === "education" ? r.education[idx]?.school
      : section === "skills" ? r.skills[idx]?.name
      : section === "extras" ? r.extras[idx]?.heading
      : undefined;
    parts.push(name && name !== "" ? name : String(idx + 1));
  }
  const b = /bullets\[(\d+)\]/.exec(rest);
  if (b) parts.push(fill(t("flow.w.bullet"), Number(b[1]) + 1));
  const it = /(?:items|tech)\[(\d+)\]/.exec(rest);
  if (it) parts.push(fill(t("flow.w.item"), Number(it[1]) + 1));
  const f = /^\.([A-Za-z]+)$/.exec(rest);
  if (f) parts.push(f[1] as string);
  return parts.join(" · ");
}

const KIND_KEY: Record<Finding["kind"], StrKey> = {
  source: "flow.f.source",
  number: "flow.f.number",
  unsourced: "flow.f.unsourced",
  date: "flow.f.date",
  basics: "flow.f.basics",
  item: "flow.f.item",
  coverage: "flow.f.coverage",
};

function FindingRow({
  f,
  decision,
  out,
  onDecide,
}: {
  f: Finding;
  decision: Decision | undefined;
  out: TailorOutput;
  onDecide: (id: string, d: Decision | null) => void;
}) {
  const t = useT();
  const red = f.level === "red";
  const addable = !red && f.kind === "coverage";
  const nameNote = !red && f.kind === "basics";
  const elsewhere = !red && (f.kind === "date" || f.kind === "number");
  const removable = red || elsewhere || f.kind === "item";
  const status: StrKey | null = decision === "removed" ? "flow.status.removed" : decision === "kept" ? "flow.status.kept" : decision === "added" ? "flow.status.added" : null;
  return (
    <div className={`ffind ${red ? "red" : "amber"}${status ? " done" : ""}`} data-finding-id={f.id}>
      <div className="fq">
        {t(nameNote ? "flow.f.name" : elsewhere ? "flow.f.elsewhere" : KIND_KEY[f.kind])}
        <mark>{f.value}</mark>
      </div>
      <div className="fsmall">
        {t("flow.where")}
        {whereLabel(f.where, out, t)}
      </div>
      {status ? (
        <div className="facts">
          <span className="fstatus">{t(status)}</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onDecide(f.id, null)}>
            {t("flow.undo")}
          </button>
        </div>
      ) : removable ? (
        <div className="facts">
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => onDecide(f.id, "removed")}>
            {t("flow.remove")}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onDecide(f.id, "kept")}>
            {t(red ? "flow.keep" : "flow.keepOk")}
          </button>
        </div>
      ) : nameNote ? (
        <div className="facts">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onDecide(f.id, "kept")}>
            {t("flow.keepOk")}
          </button>
        </div>
      ) : addable ? (
        <div className="facts">
          <button type="button" className="btn btn-sm btn-secondary" data-testid="finding-add" onClick={() => onDecide(f.id, "added")}>
            {t("flow.add")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function OriginalLines({ out }: { out: TailorOutput }) {
  const t = useT();
  const r = out.resume;
  const rows: { head: string; source: string }[] = [
    ...r.experience.map((e) => ({ head: [e.company, e.title].filter(Boolean).join(" · "), source: e.source })),
    ...r.projects.map((p) => ({ head: p.name, source: p.source })),
    ...r.education.map((e) => ({ head: [e.school, e.degree].filter(Boolean).join(" · "), source: e.source })),
    ...r.certificates.map((c) => ({ head: c.text, source: c.source })),
  ];
  return (
    <section className="forig" data-testid="original-lines" aria-labelledby="forig-title">
      <h3 id="forig-title">{t("flow.orig.title")}</h3>
      <p className="fsmall">{t("flow.orig.help")}</p>
      <ul>
        {rows.map((row, i) => (
          <li key={i}>
            <span className="forig-new">{row.head}</span>
            <span className="forig-src">{row.source}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The number of rendered A4 pages in the preview, kept up to date as the preview changes. */
function usePages(target: RefObject<HTMLElement | null>): number {
  const [pages, setPages] = useState(1);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const count = () => setPages(Math.max(1, el.querySelectorAll("[data-page]").length));
    count();
    const mo = new MutationObserver(count);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [target]);
  return pages;
}

export interface ResultProps {
  output: TailorOutput;
  shown: TailorOutput;
  findings: Finding[];
  decisions: Record<string, Decision>;
  onDecide: (id: string, d: Decision | null) => void;
  crossLang: boolean;
  snapshot: ResultSnapshot;
  tpl: TemplateId;
  onTemplate: (id: TemplateId) => void;
  onEditInput: () => void;
  onEditResult: (r: Resume) => void;
  /** Still over two pages after nothing more could move. */
  over: boolean;
  onPutBack: (source: string) => void;
}

export function ResultView(p: ResultProps) {
  const t = useT();
  const [tab, setTab] = useState<TabId>("check");
  const stageRef = useRef<HTMLDivElement>(null);
  const pages = usePages(stageRef);
  const resume = useMemo(() => toResume(p.shown), [p.shown]);
  const open = unresolvedCount(p.findings, p.decisions);
  const red = p.findings.filter((f) => f.level === "red");
  const notFound = p.findings.filter((f) => f.level === "amber" && f.kind !== "coverage");
  const missing = p.findings.filter((f) => f.level === "amber" && f.kind === "coverage");
  const tabs: { id: TabId; label: StrKey; count: ReactNode; good: boolean }[] = [
    { id: "check", label: "flow.tab.check", count: open > 0 ? fill(t("flow.toReview"), open) : "✓", good: open === 0 },
    { id: "changes", label: "flow.tab.changes", count: p.output.changes.length, good: true },
    { id: "notIncluded", label: "flow.tab.notIncluded", count: p.shown.notIncluded.length, good: true },
  ];
  const row = (f: Finding) => <FindingRow key={f.id} f={f} decision={p.decisions[f.id]} out={p.output} onDecide={p.onDecide} />;
  const modelLine = [
    `${t("flow.sum.resume")} ${fmt(p.snapshot.originalLen)} ${t("flow.chars")}`,
    `${t("flow.sum.jd")} ${fmt(p.snapshot.jdLen)} ${t("flow.chars")}`,
    t(TPL_KEY[p.tpl]),
    p.snapshot.lang === "zh" ? t("tpl.chinese") : t("tpl.english"),
    t(MODE_KEY[p.snapshot.mode]),
    p.snapshot.modelName,
  ].join(" · ");

  return (
    <>
      <div className="fcol" data-testid="tailor-result">
        <section className="card fcard">
          <div className="ftabs" role="tablist">
            {tabs.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                id={`ftab-${x.id}`}
                aria-selected={tab === x.id}
                aria-controls="ftabpanel"
                className={tab === x.id ? "on" : ""}
                onClick={() => setTab(x.id)}
              >
                {t(x.label)}
                <span className={`fcnt ${x.good ? "g" : "r"}`}>{x.count}</span>
              </button>
            ))}
          </div>
          <div id="ftabpanel" role="tabpanel" aria-labelledby={`ftab-${tab}`}>
            {tab === "check" ? (
              <>
                {red.map(row)}
                {open === 0 ? <p className="fpassed">✓ {t("flow.green")}</p> : null}
                {notFound.length > 0 ? (
                  <section className="fgroup" data-testid="finding-group-notfound">
                    <h3 className="fsub">{t("flow.notFound")}</h3>
                    <p className="fsmall">{t("flow.notFoundHelp")}</p>
                    {notFound.map(row)}
                  </section>
                ) : null}
                {missing.length > 0 ? (
                  <section className="fgroup" data-testid="finding-group-missing">
                    <h3 className="fsub">{t("flow.possibly")}</h3>
                    <p className="fsmall">{t("flow.possiblyHelp")}</p>
                    {missing.map(row)}
                  </section>
                ) : null}
                <p className="fsmall">{t("flow.exportNote")}</p>
                {p.crossLang ? <OriginalLines out={p.shown} /> : null}
              </>
            ) : tab === "changes" ? (
              p.output.changes.length === 0 ? (
                <p className="fsmall">{t("flow.noChanges")}</p>
              ) : (
                <ul className="flist">
                  {p.output.changes.map((c, i) => (
                    <li key={i}>
                      <b>{c.where}</b> {c.what}
                    </li>
                  ))}
                </ul>
              )
            ) : p.shown.notIncluded.length === 0 ? (
              <p className="fsmall">{t("flow.noneLeft")}</p>
            ) : (
              <>
                <p className="fsmall">{t("flow.notIncludedHelp")}</p>
                <ul className="flist">
                  {p.shown.notIncluded.map((n, i) => (
                    <li key={i}>
                      {n.source}{" "}
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => p.onPutBack(n.source)}>
                        {t("flow.putBack")}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
        <section className="card fcard">
          <h2 className="fstep">{t("flow.sum.title")}</h2>
          <p className="fsmall">{modelLine}</p>
          <div className="frow">
            <button type="button" className="btn btn-sm btn-secondary" onClick={p.onEditInput}>
              {t("flow.editInput")}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => p.onEditResult(resume)}>
              {t("flow.editResult")}
            </button>
          </div>
        </section>
      </div>
      <div className="fcol">
        <div className="ftoolbar" data-testid="tailor-toolbar">
          <div className="tpl-switch" role="radiogroup" aria-label={t("tpl.switchLabel")}>
            {TEMPLATES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={p.tpl === x.id}
                className={p.tpl === x.id ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"}
                onClick={() => p.onTemplate(x.id)}
              >
                {t(TPL_KEY[x.id])}
              </button>
            ))}
          </div>
          <span className="fpages" data-testid="page-count">{" "}{pages === 1 ? t("flow.page1") : fill(t("flow.pages"), pages)}</span>
          <button type="button" className="btn btn-sm btn-secondary" disabled>
            {t("flow.export.pdf")}
          </button>
          <button type="button" className="btn btn-sm btn-secondary" disabled>
            {t("flow.export.md")}
          </button>
          <span className="fsmall fhint">{t("flow.export.soon")}</span>
        </div>
        {p.over ? (
          <p className="field-error fwarn" role="status">
            {t("flow.overTwo")}
          </p>
        ) : null}
        <div className="card preview fpreview" data-testid="resume-preview" data-template={p.tpl}>
          <span className="fai">{t("flow.aiLabel")}</span>
          <div className="tpl-stage" ref={stageRef}>
            <TemplateView id={p.tpl} resume={resume} lang={p.snapshot.lang} />
            {Array.from({ length: pages - 1 }, (_, i) => (
              <i key={i} className="page-guide" data-page-guide aria-hidden="true" style={{ top: PAGE_H * (i + 1) + 24 * i }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
