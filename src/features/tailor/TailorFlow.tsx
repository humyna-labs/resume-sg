import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AiConsentLine } from "../../app/AiConsentLine.tsx";
import { AiError } from "../../ai/anthropic.ts";
import { detectLang, factCheck } from "../../ai/factCheck.ts";
import { TailorInvalidError, runTailor } from "../../ai/tailor.ts";
import type { OutputLang, TailorMode } from "../../ai/tailor.ts";
import { MODEL_CHOICES } from "../../ai/settings.ts";
import type { Decision, Finding, TailorOutput } from "../../ai/types.ts";
import type { StrKey } from "../../i18n/en.ts";
import { useLang, useT } from "../../i18n/index.ts";
import type { Resume } from "../../resume/model.ts";
import { DEFAULT_TEMPLATE, TEMPLATES } from "../../templates/index.ts";
import type { TemplateId } from "../../templates/index.ts";
import { useAiConfig } from "../ai-settings/useAiConfig.ts";
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
      <i className="band" />
      <i style={{ width: "88%" }} />
      <i style={{ width: "76%" }} />
      <i style={{ width: "82%" }} />
    </span>
  );
}

function Progress({ onCancel }: { onCancel: () => void }) {
  const t = useT();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const now = STEP_AT.reduce((acc, at, i) => (elapsed >= at ? i : acc), 0);
  const steps: StrKey[] = ["flow.step.1", "flow.step.2", "flow.step.3", "flow.step.4"];
  return (
    <section className="card fcard fwait" data-testid="tailor-progress" aria-live="polite">
      <div className="fwait-head">
        <div className="fspin" data-testid="tailor-spinner" aria-hidden="true" />
        <div>
          <h2>{t("flow.wait.title")}</h2>
          <p className="fsmall">
            {t("flow.elapsed").replace("{n}", String(elapsed))} · {t("flow.time")}
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

export function TailorFlow() {
  const t = useT();
  const { lang: uiLang } = useLang();
  const cfg = useAiConfig();
  const [original, setOriginal] = useState("");
  const [jd, setJd] = useState("");
  const [tpl, setTpl] = useState<TemplateId>(DEFAULT_TEMPLATE);
  const [outLang, setOutLang] = useState<OutputLang>(uiLang);
  const [mode, setMode] = useState<TailorMode>("balanced");
  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<StrKey | null>(null);
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [editing, setEditing] = useState<Resume | null>(null);
  const busy = useRef(false);
  const ctl = useRef<AbortController | null>(null);

  const missing = [
    original.trim() === "" ? "resume" : null,
    jd.trim() === "" ? "jd" : null,
    cfg.key.trim() === "" ? "key" : null,
  ].filter((x): x is "resume" | "jd" | "key" => x !== null);
  const ready = missing.length === 0 && cfg.modelOk;

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
    setAsking(false);
    setPhase("running");
    const c = new AbortController();
    ctl.current = c;
    const run = { key: cfg.key, model: cfg.model, original, jd, lang: outLang, mode, signal: c.signal };
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
      setError(e instanceof TailorInvalidError ? "flow.err.unreadable" : (`ai.msg.${e instanceof AiError ? e.kind : "network"}` as StrKey));
      setPhase("input");
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

  const hintText: Record<"resume" | "jd" | "key", StrKey> = { resume: "flow.hint.resume", jd: "flow.hint.jd", key: "flow.hint.key" };
  const running = phase === "running";

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

  if (phase === "result" && result && shown) {
    return (
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
          onTemplate={setTpl}
          onEditInput={() => setPhase("input")}
          onEditResult={(r) => {
            setEditing(r);
            setPhase("editing");
          }}
        />
      </div>
    );
  }

  return (
    <div className="fgrid">
      <div className="fcol">
        <section className="card fcard">
          <div className="fstep">
            <span className="fnum" aria-hidden="true">1</span>
            <label htmlFor="flow-resume">{t("flow.resumeLabel")}</label>
          </div>
          <textarea
            id="flow-resume"
            className="input input-area ftext"
            rows={running ? 6 : 11}
            readOnly={running}
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
          />
          <div className="fmeta">
            <span>
              {t("flow.resumeHelp")} · {fmt(original.length)} {t("flow.chars")}
            </span>
          </div>
        </section>
        <section className="card fcard">
          <div className="fstep">
            <span className="fnum" aria-hidden="true">2</span>
            <label htmlFor="flow-jd">{t("flow.jdLabel")}</label>
          </div>
          <textarea
            id="flow-jd"
            className="input input-area ftext"
            rows={running ? 4 : 7}
            readOnly={running}
            value={jd}
            onChange={(e) => setJd(e.target.value)}
          />
          <div className="fmeta">
            <span>
              {t("flow.jdHelp")} · {fmt(jd.length)} {t("flow.chars")}
            </span>
          </div>
        </section>
      </div>
      {running ? (
        <div className="fcol">
          <Progress onCancel={() => setAsking(true)} />
        </div>
      ) : (
        <div className="fcol" data-testid="tailor-options">
          <section className="card fcard">
            <h2 className="fstep">
              <span className="fnum" aria-hidden="true">3</span>
              {t("flow.step3")}
            </h2>
            <div className="ftpls" role="radiogroup" aria-label={t("tpl.switchLabel")}>
              {TEMPLATES.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={tpl === x.id}
                  className={`ftpl${tpl === x.id ? " sel" : ""}`}
                  onClick={() => setTpl(x.id)}
                >
                  <Thumb id={x.id} />
                  <span className="flb">
                    {t(TPL_KEY[x.id])}
                    {x.id === DEFAULT_TEMPLATE ? <span className="ftag"> {t("flow.tpl.default")}</span> : null}
                  </span>
                </button>
              ))}
            </div>
            <div className="frow">
              <span className="flbl" id="flow-lang-label">{t("tpl.langLabel")}</span>
              <div className="fseg" role="radiogroup" aria-labelledby="flow-lang-label">
                {(["zh", "en"] as const).map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={outLang === l} className={outLang === l ? "on" : ""} onClick={() => setOutLang(l)}>
                    {l === "zh" ? t("tpl.chinese") : t("tpl.english")}
                  </button>
                ))}
              </div>
            </div>
            <div className="frow">
              <span className="flbl" id="flow-mode-label">{t("flow.modeLabel")}</span>
              <div className="fseg" role="radiogroup" aria-labelledby="flow-mode-label">
                {MODES.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
                    {t(MODE_KEY[m])}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <KeyArea cfg={cfg} />
          <section className="card fcard">
            {error ? (
              <p className="field-error" role="alert">
                {t(error)}
              </p>
            ) : null}
            <button type="button" className="btn btn-lg btn-primary fgo" disabled={!ready} onClick={() => void generate()}>
              {t("flow.generate")}
            </button>
            <div data-testid="generate-hint" className="fhints" aria-live="polite">
              {missing.map((m) => (
                <p key={m} data-hint={m} className="fsmall">
                  {t(hintText[m])}
                </p>
              ))}
            </div>
            <p className="fsmall fcenter">{t("flow.time")}</p>
            <AiConsentLine />
            {result ? (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPhase("result")}>
                {t("flow.back")}
              </button>
            ) : null}
          </section>
          <section className="card fcard fempty" data-testid="resume-preview" aria-label={t("ed.previewLabel")}>
            <p className="fsmall">{t("flow.previewEmpty")}</p>
          </section>
        </div>
      )}
      {asking ? <CancelDialog onKeep={() => setAsking(false)} onConfirm={confirmCancel} /> : null}
    </div>
  );
}
