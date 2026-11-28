// The "Match analysis" tab: a button before a run, a plain-text analysis after. Every model string is rendered as a React text node.
import type { MatchOutput, MatchStatus } from "../../ai/types.ts";
import type { StrKey } from "../../i18n/en.ts";
import { useT } from "../../i18n/index.ts";

export interface MatchState {
  output: MatchOutput;
  dropped: number;
}

export interface MatchPanelProps {
  match: MatchState | null;
  running: boolean;
  error: StrKey | null;
  onGenerate: () => void;
  onCancel: () => void;
}

const STATUSES: MatchStatus[] = ["evidence", "partial", "missing"];
const COUNT_KEY: Record<MatchStatus, StrKey> = { evidence: "match.count.evidence", partial: "match.count.partial", missing: "match.count.missing" };
const STATUS_KEY: Record<MatchStatus, StrKey> = { evidence: "match.status.evidence", partial: "match.status.partial", missing: "match.status.missing" };

export function MatchPanel(p: MatchPanelProps) {
  const t = useT();
  if (p.match === null) {
    return (
      <>
        {p.running ? (
          <>
            <p className="fsmall" role="status">{t("match.running")}</p>
            <div className="frow">
              <button type="button" className="btn btn-sm btn-secondary" onClick={p.onCancel}>
                {t("flow.cancel")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="fsmall">{t("match.lead")}</p>
            <div className="frow">
              <button type="button" className="btn btn-sm btn-primary" onClick={p.onGenerate}>
                {t("match.generate")}
              </button>
            </div>
          </>
        )}
        {p.error ? (
          <p className="field-error" role="alert">
            {t(p.error)}
          </p>
        ) : null}
      </>
    );
  }
  const { output: o, dropped } = p.match;
  return (
    <div className="fmatch" data-testid="match-result">
      <div className="fmatch-counts">
        {STATUSES.map((s) => (
          <span key={s} className={`fcnt ${s === "evidence" ? "g" : "r"}`} data-testid={`match-count-${s}`}>
            {t(COUNT_KEY[s])} {o.requirements.filter((r) => r.status === s).length}
          </span>
        ))}
      </div>
      {dropped > 0 ? <p className="fsmall" role="status">{t("match.removed").replace("{n}", String(dropped))}</p> : null}
      {o.requirements.length > 0 ? (
        <section className="fgroup">
          <h3 className="fsub">{t("match.h.requirements")}</h3>
          <ul className="flist">
            {o.requirements.map((r, i) => (
              <li key={i}>
                <b>{t(STATUS_KEY[r.status])}</b> · {r.jdQuote}
                <div className="fsmall">{r.note}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {o.strengths.length > 0 ? (
        <section className="fgroup">
          <h3 className="fsub">{t("match.h.strengths")}</h3>
          {o.strengths.map((s, i) => (
            <div key={i} className="ffind" data-testid="match-strength">
              <div className="fq">{s.jdQuote}</div>
              <div className="fsmall">{s.note}</div>
              <div className="fsmall">
                <b>{t("match.how")}</b>: {s.howToTell}
              </div>
            </div>
          ))}
        </section>
      ) : null}
      {o.gaps.length > 0 ? (
        <section className="fgroup">
          <h3 className="fsub">{t("match.h.gaps")}</h3>
          {o.gaps.map((g, i) => (
            <div key={i} className="ffind amber" data-testid="match-gap">
              <div className="fq">{g.jdQuote}</div>
              <div className="fsmall">{g.howToAddress}</div>
            </div>
          ))}
        </section>
      ) : null}
      <section className="fgroup">
        <h3 className="fsub">{t("match.h.questions")}</h3>
        {o.interviewQuestions.map((q, i) => (
          <div key={i} className="ffind" data-testid="match-question">
            <div className="fq">{q.question}</div>
            <div className="fsmall"><b>{t("match.star")}</b></div>
            <ul className="flist">
              {q.starPoints.map((s, j) => (
                <li key={j}>{s}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section className="fgroup">
        <h3 className="fsub">{t("match.h.ask")}</h3>
        <ul className="flist">
          {o.questionsToAsk.map((q, i) => (
            <li key={i} data-testid="match-ask">{q}</li>
          ))}
        </ul>
      </section>
      <p className="fsmall">{t("match.footer")}</p>
    </div>
  );
}
