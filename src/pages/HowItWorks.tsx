import { PageShell } from "../app/PageShell.tsx";
import type { StrKey } from "../i18n/en.ts";
import { useLang, useT } from "../i18n/index.ts";
import enSvg from "../assets/illustrations/how-it-works-en.svg";
import zhSvg from "../assets/illustrations/how-it-works-zh.svg";

export function HowItWorks() {
  const t = useT();
  const { lang } = useLang();
  const k = (s: string) => t(s as StrKey);
  return (
    <PageShell title={t("page.how")}>
      <img className="how-illustration" src={lang === "zh" ? zhSvg : enSvg} alt={t("how.illustrationAlt")} />
      <ol className="how-steps" aria-label={t("how.stepsLabel")}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <li key={n}>
            <strong>{k(`how.step${n}.title`)}</strong> <span>{k(`how.step${n}.line`)}</span>
          </li>
        ))}
      </ol>
      <div className="card how-diagram" role="group" aria-label={t("how.diagramLabel")}>
        <span className="node">{t("how.diagram.you")}</span>
        <span className="link-sign" aria-hidden="true">
          ⇄
        </span>
        <span className="node">{t("how.diagram.anthropic")}</span>
        <p className="none">{t("how.diagram.server")}</p>
      </div>
      <div className="how-lists">
        <div className="card">
          <h2>{t("how.does.title")}</h2>
          <ul>
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n}>{k(`how.does.${n}`)}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>{t("how.never.title")}</h2>
          <ul>
            {[1, 2].map((n) => (
              <li key={n}>{k(`how.never.${n}`)}</li>
            ))}
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
