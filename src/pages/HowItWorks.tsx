import type { Dict } from "../i18n/en.ts";
import { useT } from "../i18n/index.ts";

export function HowItWorks() {
  const t = useT();
  const k = (s: string) => t(s as keyof Dict);
  return (
    <section className="page info">
      <h1>{t("page.how")}</h1>
      <ol className="how-steps" aria-label={t("how.stepsLabel")}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <li key={n}>
            <strong>{k(`how.step${n}.title`)}</strong> <span>{k(`how.step${n}.line`)}</span>
          </li>
        ))}
      </ol>
      <div className="how-diagram" role="group" aria-label={t("how.diagramLabel")}>
        <span className="node">{t("how.diagram.you")}</span>
        <span className="arrow" aria-hidden="true">
          ⇄
        </span>
        <span className="node">{t("how.diagram.anthropic")}</span>
        <p className="none">{t("how.diagram.server")}</p>
      </div>
      <div className="how-lists">
        <div>
          <h2>{t("how.does.title")}</h2>
          <ul>
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n}>{k(`how.does.${n}`)}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>{t("how.never.title")}</h2>
          <ul>
            {[1, 2].map((n) => (
              <li key={n}>{k(`how.never.${n}`)}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
