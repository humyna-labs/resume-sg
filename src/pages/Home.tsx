import { RichText } from "../app/RichText.tsx";
import { useRich, useT } from "../i18n/index.ts";
import { CheckIcon, FreeIcon, LockIcon, TickIcon } from "../icons/index.tsx";
import type { StrKey } from "../i18n/en.ts";

const REASON_ICONS = [FreeIcon, LockIcon, CheckIcon];
const N = [1, 2, 3] as const;

export function Home() {
  const t = useT();
  const rich = useRich();
  const k = (s: string) => t(s as StrKey);
  return (
    <>
      <div className="wrap hero">
        <div className="eyebrow">{N.map((n) => k(`home.eyebrow.${n}`)).join(" · ")}</div>
        <h1 className="h1">
          <RichText parts={rich["home.h1"]} />
        </h1>
        <p className="sub">{t("home.sub")}</p>
        <div className="ctas">
          <a className="btn btn-lg btn-primary" href="#/app">
            {t("nav.start")}
          </a>
          <a className="btn btn-lg btn-ghost" href="#/how-it-works">
            {t("home.how")}
          </a>
        </div>
        <div className="visual">
          <div className="card jd">
            <div className="tag">{t("home.jdTag")}</div>
            <div className="t">{t("home.jdTitle")}</div>
            {rich["home.jd"].map((line, i) => (
              <p key={i}>
                <RichText parts={line} />
              </p>
            ))}
          </div>
          <div className="arrow">
            <span>{t("home.arrow")}</span>
          </div>
          <div className="card cv">
            <div className="tag">{t("home.cvTag")}</div>
            <div className="t">{t("home.cvTitle")}</div>
            {rich["home.cv"].map((line, i) => (
              <div className="row" key={i}>
                <span className="ok">
                  <TickIcon />
                </span>
                <span>
                  <RichText parts={line} />
                </span>
              </div>
            ))}
            <div className="badge">
              <TickIcon /> {t("home.badge")}
            </div>
          </div>
        </div>
        <p className="note">{t("home.note")}</p>
      </div>

      <section className="section alt">
        <div className="wrap">
          <h2 className="h2">{t("home.reasons.title")}</h2>
          <p className="lead">{t("home.reasons.lead")}</p>
          <div className="grid3">
            {N.map((n, i) => {
              const Icon = REASON_ICONS[i] ?? FreeIcon;
              return (
                <div className="feat" key={n}>
                  <div className="ico">
                    <Icon />
                  </div>
                  <h3>{k(`home.reason.${n}.title`)}</h3>
                  <p>{k(`home.reason.${n}.body`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2 className="h2">{t("home.steps.title")}</h2>
          <p className="lead">{t("home.steps.lead")}</p>
          <div className="grid3">
            {N.map((n) => (
              <div className="step" key={n}>
                <div className="num">{n}</div>
                <h3>{k(`home.step.${n}.title`)}</h3>
                <p>{k(`home.step.${n}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="alt band">
        <div className="wrap">
          <h2 className="h2">{t("home.band")}</h2>
          <div className="ctas">
            <a className="btn btn-lg btn-primary" href="#/app">
              {t("nav.start")}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
