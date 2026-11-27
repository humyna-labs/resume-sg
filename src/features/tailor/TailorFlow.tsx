import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { AiConsentLine } from "../../app/AiConsentLine.tsx";
import { AiError } from "../../ai/anthropic.ts";
import { detectLang, factCheck } from "../../ai/factCheck.ts";
import { TailorCutOffError, TailorInvalidError, runTailor } from "../../ai/tailor.ts";
import type { OutputLang, TailorMode } from "../../ai/tailor.ts";
import { MODEL_CHOICES } from "../../ai/settings.ts";
import type { Decision, Finding, TailorOutput } from "../../ai/types.ts";
import type { StrKey } from "../../i18n/en.ts";
import { useLang, useT } from "../../i18n/index.ts";
import type { Resume } from "../../resume/model.ts";
import { DEFAULT_TEMPLATE, TEMPLATES } from "../../templates/index.ts";
import type { TemplateId } from "../../templates/index.ts";
import { useAiConfig } from "../ai-settings/useAiConfig.ts";
import { initialWizard, JD_MAX_CHARS, RESUME_MAX_CHARS, textProblem, wizardReducer } from "./wizardState.ts";
import type { Step, WizardState } from "./wizardState.ts";
import { ResumeEditor } from "../editor/ResumeEditor.tsx";
import { applyDecisions } from "./apply.ts";
import { KeyArea } from "./KeyArea.tsx";
import { MODE_KEY, ResultView, TPL_KEY } from "./ResultView.tsx";
import type { ResultSnapshot } from "./ResultView.tsx";

type Phase = "input" | "running" | "result" | "editing";
const MODES: TailorMode[] = ["balanced", "results-first", "career-change"];
const STEP_AT = [0, 2, 20, 40];
const fmt = (n: number): string => n.toLocaleString("en-US");

interface ResultState {
  output: TailorOutput;
  findings: Finding[];
  original: string;
  lang: OutputLang;
  snapshot: ResultSnapshot;
}

function Thumb({ id }: { id: TemplateId }) {
  return id === "classic" ? (
    <span className="fthumb" aria-hidden="true">
      <i className="t" />
      <i style={{ width: "80%" }} />
      <i style={{ width: "92%" }} />
      <i style={{ width: "70%" }} />
      <i style={{ width: "86%" }} />
    </span>
  ) : (
    <span className="fthumb m" aria-hidden="true">
      <i className="fband" />
      <i style={{ width: "88%" }} />
      <i style={{ width: "76%" }} />
      <i style={{ width: "82%" }} />
    </span>
  );
}

function Progress({ onCancel, chars }: { onCancel: () => void; chars: number }) {
  const t = useT();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const now = STEP_AT.reduce((acc, at, i) => (elapsed >= at ? i : acc), 0);
  const steps: StrKey[] = ["flow.step.1", "flow.step.2", "flow.step.3", "flow.step.4"];
  return (
    <section className="card fcard fwait wz-card" data-testid="tailor-progress" aria-live="polite">
      <div className="fwait-head">
        <div className="fspin" data-testid="tailor-spinner" aria-hidden="true" />
        <div>
          <h2 className="wz-h" data-testid="step-heading" tabIndex={-1}>{t("flow.wait.title")}</h2>
          <p className="fsmall">
            {t("flow.elapsed").replace("{n}", String(elapsed))} · {t("flow.time")}
          </p>
          <p className="fsmall" data-testid="tailor-chars">
            {chars === 0 ? t("flow.progress.thinking") : t("flow.progress.written").replace("{n}", String(Math.round(chars / 100) * 100))}
          </p>
        </div>
      </div>
      <ol className="fsteps">
        {steps.map((s, i) => {
          const state = i < now ? "done" : i === now ? "now" : "todo";
          return (
            <li key={s} data-state={state}>
              <span className={`fdot ${state}`} aria-hidden="true">
                {state === "done" ? "✓" : ""}
              </span>
              {t(s)}
            </li>
          );
        })}
      </ol>
      <p className="fsmall">{t("flow.wait.estimate")}</p>
      <p className="fnote">{t("flow.wait.note")}</p>
      <div className="frow end">
        <button type="button" className="btn btn-sm btn-secondary" onClick={onCancel}>
          {t("flow.cancel")}
        </button>
      </div>
    </section>
  );
}

function CancelDialog({ onKeep, onConfirm }: { onKeep: () => void; onConfirm: () => void }) {
  const t = useT();
  const keepRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keepRef.current?.focus();
  }, []);
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") onKeep();
    if (e.key === "Tab") {
      e.preventDefault();
      (document.activeElement === keepRef.current ? confirmRef.current : keepRef.current)?.focus();
    }
  }
  return (
    <div className="fmodal">
      <div className="fdialog" role="alertdialog" aria-modal="true" aria-labelledby="fcancel-ask" onKeyDown={onKey}>
        <p id="fcancel-ask">{t("flow.cancelAsk")}</p>
        <div className="frow end">
          <button type="button" ref={confirmRef} className="btn btn-sm btn-secondary" data-testid="cancel-confirm" onClick={onConfirm}>
            {t("flow.cancelConfirm")}
          </button>
          <button type="button" ref={keepRef} className="btn btn-sm btn-primary" onClick={onKeep}>
            {t("flow.keepWaiting")}
          </button>
        </div>
      </div>
    </div>
  );
}


const MODE_DESC: Record<TailorMode, StrKey> = {
  balanced: "wz.mode.desc.balanced",
  "results-first": "wz.mode.desc.results",
  "career-change": "wz.mode.desc.career",
};
const STEP_NAME: StrKey[] = ["wz.step.1", "wz.step.2", "wz.step.3", "wz.step.4", "wz.step.5"];
const STEP_NEXT: Partial<Record<Step, StrKey>> = { 1: "wz.next.2", 2: "wz.next.3", 3: "wz.next.4" };

/** Arrow keys move the choice of a radio group; focus follows. */
function arrowKeys(e: KeyboardEvent<HTMLElement>, count: number, current: number, pick: (i: number) => void) {
  const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (dir === 0) return;
  e.preventDefault();
  const next = (current + dir + count) % count;
  pick(next);
  const radios = e.currentTarget.querySelectorAll<HTMLElement>("[role=radio]");
  radios[next]?.focus();
}

function Stepper({ step, locked, onGo }: { step: Step; locked: boolean; onGo: (s: Step) => void }) {
  const t = useT();
  return (
    <ul className="wz-steps" data-testid="wizard-progress" aria-label={t("wz.nav")}>
      {STEP_NAME.map((name, i) => {
        const n = (i + 1) as Step;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        const dot = <span className="wz-dot" aria-hidden="true">{state === "done" ? "✓" : n}</span>;
        return (
          <li key={name} className={`wz-st ${state}`} data-step={n} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            {state === "done" && !locked ? (
              <button type="button" className="wz-st-btn" onClick={() => onGo(n)}>
                {dot}
                <span className="wz-st-label">{t(name)}</span>
              </button>
            ) : (
              <>
                {dot}
                <span className="wz-st-label">{t(name)}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Counter({ id, n, max, over }: { id: string; n: number; max: number; over: boolean }) {
  const t = useT();
  return (
    <span data-testid={id} data-over={over ? "true" : undefined} className={over ? "wz-count over" : "wz-count"}>
      {t("wz.counter").replace("{n}", fmt(n)).replace("{max}", fmt(max))}
    </span>
  );
}

function Footer({ step, nextLabel, ok, hint, onBack, onNext }: {
  step: Step;
  nextLabel: string;
  ok: boolean;
  hint: ReactNode[];
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useT();
  return (
    <>
      <div className="wz-foot" data-testid="step-footer">
        {step > 1 ? (
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            {t("wz.back")}
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="btn btn-primary" data-testid="step-next" disabled={!ok} onClick={onNext}>
          {nextLabel}
        </button>
      </div>
      <div data-testid="generate-hint" className="fhints wz-hint" aria-live="polite">
        {hint}
      </div>
    </>
  );
}

export function TailorFlow() {
  const t = useT();
  const { lang: uiLang } = useLang();
  const cfg = useAiConfig();
  const [w, dispatch] = useReducer(wizardReducer, uiLang, initialWizard);
  const { step, original, jd, tpl, lang: outLang, mode } = w;
  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<StrKey | null>(null);
  const [details, setDetails] = useState<{ cause: string; tokens: number | null } | null>(null);
  const [chars, setChars] = useState(0);
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [editing, setEditing] = useState<Resume | null>(null);
  const busy = useRef(false);
  const ctl = useRef<AbortController | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const shownStep = useRef(step);
  const uid = useId();

  const set = (patch: Partial<Omit<WizardState, "step">>) => dispatch({ type: "set", patch });
  const go = (s: Step) => dispatch({ type: "go", step: s });

  const resumeProblem = textProblem(original, RESUME_MAX_CHARS);
  const jdProblem = textProblem(jd, JD_MAX_CHARS);
  const keyMissing = cfg.key.trim() === "";
  const ready = resumeProblem === null && jdProblem === null && !keyMissing && cfg.modelOk;
  const running = phase === "running";

  // On every step change the focus moves to the step heading.
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    root.current?.querySelector<HTMLElement>('[data-testid="step-heading"]')?.focus();
  }, [step, phase]);

  // The browser's leave-page warning, only while a request runs.
  useEffect(() => {
    if (phase !== "running") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  // Leaving the page drops the request.
  useEffect(
    () => () => {
      ctl.current?.abort();
    },
    [],
  );

  async function generate() {
    if (busy.current || !ready) return;
    busy.current = true;
    setError(null);
    setDetails(null);
    setChars(0);
    setAsking(false);
    setPhase("running");
    go(5);
    const c = new AbortController();
    ctl.current = c;
    const run = { key: cfg.key, model: cfg.model, original, jd, lang: outLang, mode, signal: c.signal, onText: setChars };
    try {
      const output = await runTailor(run);
      if (c.signal.aborted) return;
      const known = MODEL_CHOICES.find((m) => m.value === cfg.model);
      const modelName = known ? t(known.labelKey).replace(/\s*[（(].*$/, "") : cfg.model;
      setResult({
        output,
        findings: factCheck(original, output, { outputLang: outLang }),
        original,
        lang: outLang,
        snapshot: { originalLen: original.length, jdLen: jd.length, lang: outLang, mode, modelName },
      });
      setDecisions({});
      setPhase("result");
    } catch (e) {
      if (c.signal.aborted) return;
      if (e instanceof TailorCutOffError) {
        setError("flow.err.cutoff");
        setDetails({ cause: "max_tokens", tokens: e.outputTokens });
      } else if (e instanceof TailorInvalidError) {
        setError("flow.err.unreadable");
        setDetails({ cause: e.paths.join(", "), tokens: e.outputTokens });
      } else {
        setError(`ai.msg.${e instanceof AiError ? e.kind : "network"}` as StrKey);
      }
      setPhase("input");
      go(4);
    } finally {
      if (ctl.current === c) {
        ctl.current = null;
        busy.current = false;
      }
    }
  }

  function confirmCancel() {
    ctl.current?.abort();
    ctl.current = null;
    busy.current = false;
    setAsking(false);
    setPhase("input");
    go(4);
  }

  function jump(s: Step) {
    setPhase("input");
    go(s);
  }

  const shown = useMemo(
    () => (result ? applyDecisions(result.output, result.findings, decisions, result.original, t("flow.addedHeading")) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, decisions, uiLang],
  );

  function decide(id: string, d: Decision | null) {
    setDecisions((cur) => {
      const rest = Object.fromEntries(Object.entries(cur).filter(([k]) => k !== id));
      return d === null ? rest : { ...rest, [id]: d };
    });
  }

  if (phase === "editing" && editing) {
    return (
      <div className="fedit">
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setPhase("result")}>
          {t("flow.back")}
        </button>
        <ResumeEditor initial={editing} />
      </div>
    );
  }

  const hint = (key: string, text: string) => (
    <p key={key} data-hint={key} className="fsmall">
      {text}
    </p>
  );
  const textStep = (kind: "resume" | "jd") => {
    const isResume = kind === "resume";
    const text = isResume ? original : jd;
    const problem = isResume ? resumeProblem : jdProblem;
    const max = isResume ? RESUME_MAX_CHARS : JD_MAX_CHARS;
    return {
      body: (
        <>
          <label className="wz-sr" htmlFor={`${uid}-${kind}`}>
            {t(isResume ? "flow.resumeLabel" : "flow.jdLabel")}
          </label>
          <textarea
            id={`${uid}-${kind}`}
            className="input input-area ftext"
            rows={isResume ? 14 : 12}
            value={text}
            onChange={(e) => set(isResume ? { original: e.target.value } : { jd: e.target.value })}
          />
          <div className="wz-meta">
            <Counter id={isResume ? "resume-counter" : "jd-counter"} n={text.length} max={max} over={problem === "over"} />
            {isResume ? <a href="#/faq">{t("wz.faqLink")}</a> : null}
          </div>
        </>
      ),
      ok: problem === null,
      hint: problem === "empty" ? [hint(kind, t(isResume ? "flow.hint.resume" : "flow.hint.jd"))] : problem === "over" ? [hint(kind, t(isResume ? "wz.over.resume" : "wz.over.jd"))] : [],
    };
  };

  let body: ReactNode = null;
  let ok = true;
  let hints: ReactNode[] = [];
  if (step === 1 || step === 2) {
    const s = textStep(step === 1 ? "resume" : "jd");
    body = s.body;
    ok = s.ok;
    hints = s.hint;
  } else if (step === 3) {
    body = (
      <>
        <h3 className="wz-label" id={`${uid}-tpl`}>{t("wz.lbl.template")}</h3>
        <div
          className="ftpls"
          role="radiogroup"
          aria-labelledby={`${uid}-tpl`}
          onKeyDown={(e) => arrowKeys(e, TEMPLATES.length, TEMPLATES.findIndex((x) => x.id === tpl), (i) => set({ tpl: TEMPLATES[i]?.id ?? DEFAULT_TEMPLATE }))}
        >
          {TEMPLATES.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={tpl === x.id}
              className={`ftpl${tpl === x.id ? " sel" : ""}`}
              onClick={() => set({ tpl: x.id })}
            >
              <Thumb id={x.id} />
              <span className="flb">
                {t(TPL_KEY[x.id])}
                {x.id === DEFAULT_TEMPLATE ? <span className="ftag"> {t("flow.tpl.default")}</span> : null}
              </span>
            </button>
          ))}
        </div>
        <h3 className="wz-label" id={`${uid}-lang`}>{t("tpl.langLabel")}</h3>
        <div
          className="fseg"
          role="radiogroup"
          aria-labelledby={`${uid}-lang`}
          onKeyDown={(e) => arrowKeys(e, 2, outLang === "zh" ? 0 : 1, (i) => set({ lang: i === 0 ? "zh" : "en" }))}
        >
          {(["zh", "en"] as const).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={outLang === l} className={outLang === l ? "on" : ""} onClick={() => set({ lang: l })}>
              {l === "zh" ? t("tpl.chinese") : t("tpl.english")}
            </button>
          ))}
        </div>
        <h3 className="wz-label" id={`${uid}-mode`}>{t("wz.lbl.mode")}</h3>
        <div
          className="wz-modes"
          role="radiogroup"
          aria-labelledby={`${uid}-mode`}
          onKeyDown={(e) => arrowKeys(e, MODES.length, MODES.indexOf(mode), (i) => set({ mode: MODES[i] ?? "balanced" }))}
        >
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              data-mode={m}
              aria-checked={mode === m}
              aria-labelledby={`${uid}-${m}-t`}
              aria-describedby={`${uid}-${m}-d`}
              className={`wz-mode${mode === m ? " sel" : ""}`}
              onClick={() => set({ mode: m })}
            >
              <span className="wz-mode-t" id={`${uid}-${m}-t`}>
                <span className="wz-radio" aria-hidden="true" />
                {t(MODE_KEY[m])}
              </span>
              <span className="wz-mode-d" id={`${uid}-${m}-d`}>
                {t(MODE_DESC[m])}
              </span>
            </button>
          ))}
        </div>
      </>
    );
  } else if (step === 4) {
    ok = ready;
    hints = keyMissing ? [hint("key", t("flow.hint.key"))] : [];
    const firstLine = jd.split("\n").find((l) => l.trim() !== "") ?? "";
    const row = (k: string, label: string, value: ReactNode, to: Step) => (
      <div className="wz-row" data-row={k}>
        <span>{label}</span>
        <b className="wz-val">{value}</b>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => go(to)}>
          {t("wz.edit")}
        </button>
      </div>
    );
    body = (
      <>
        <div className="wz-sum" data-testid="step4-summary">
          {row("resume", t("wz.sum.resume"), t("wz.sum.len").replace("{n}", fmt(original.length)), 1)}
          {row("jd", t("wz.sum.jd"), <><span className="wz-clip">{firstLine}</span> <span className="wz-len">({t("wz.sum.len").replace("{n}", fmt(jd.length))})</span></>, 2)}
          {row("options", t("wz.sum.options"), `${t(TPL_KEY[tpl])} · ${outLang === "zh" ? t("tpl.chinese") : t("tpl.english")} · ${t(MODE_KEY[mode])}`, 3)}
        </div>
        <KeyArea cfg={cfg} />
        {error ? (
          <p className="field-error" role="alert">
            {t(error)}
          </p>
        ) : null}
        {error && details ? (
          <details>
            <summary>{t("flow.details")}</summary>
            {details.cause !== "" ? <p className="fsmall">{t("flow.details.cause").replace("{cause}", details.cause)}</p> : null}
            {details.tokens !== null ? <p className="fsmall">{t("flow.details.tokens").replace("{n}", fmt(details.tokens))}</p> : null}
          </details>
        ) : null}
      </>
    );
  }

  const stepper = <Stepper step={step} locked={running} onGo={jump} />;

  if (step === 5 && running) {
    return (
      <div ref={root} className="wz">
        {stepper}
        <Progress onCancel={() => setAsking(true)} chars={chars} />
        {asking ? <CancelDialog onKeep={() => setAsking(false)} onConfirm={confirmCancel} /> : null}
      </div>
    );
  }

  if (step === 5 && result && shown) {
    return (
      <div ref={root} className="wz wz-result">
        {stepper}
        <h2 className="wz-sr" data-testid="step-heading" tabIndex={-1}>
          {t("wz.sr.result")}
        </h2>
        <div className="fgrid res">
          <ResultView
            output={result.output}
            shown={shown}
            findings={result.findings}
            decisions={decisions}
            onDecide={decide}
            crossLang={detectLang(result.original) !== result.lang}
            snapshot={result.snapshot}
            tpl={tpl}
            onTemplate={(id) => set({ tpl: id })}
            onEditInput={() => jump(1)}
            onEditResult={(r) => {
              setEditing(r);
              setPhase("editing");
            }}
          />
        </div>
      </div>
    );
  }

  const stepNo = step === 5 ? 4 : step;
  const nextLabel = stepNo === 4 ? t("flow.generate") : t(STEP_NEXT[stepNo] ?? "wz.next.2");
  return (
    <div ref={root} className="wz">
      {stepper}
      <section className="card fcard wz-card">
        <h2 className="wz-h" data-testid="step-heading" tabIndex={-1}>
          {t(`wz.h.${stepNo}` as StrKey)}
        </h2>
        <p className="wz-lead">{t(`wz.lead.${stepNo}` as StrKey)}</p>
        {body}
        <Footer
          step={stepNo as Step}
          nextLabel={nextLabel}
          ok={ok}
          hint={hints}
          onBack={() => go(Math.max(1, stepNo - 1) as Step)}
          onNext={() => (stepNo === 4 ? void generate() : go((stepNo + 1) as Step))}
        />
        {stepNo === 4 ? (
          <>
            <p className="fsmall fcenter">{t("flow.time")}</p>
            <AiConsentLine />
            {result ? (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => jump(5)}>
                {t("flow.back")}
              </button>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
