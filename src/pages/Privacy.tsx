import { PageShell } from "../app/PageShell.tsx";
import { useT } from "../i18n/index.ts";

export function Privacy() {
  const t = useT();
  return (
    <PageShell title={t("page.privacy")}>
      <div className="card">
        <p>{t("privacy.1")}</p>
      </div>
      <div className="card">
        <p>
          {t("privacy.2.before")}
          <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">
            {t("privacy.2.link")}
          </a>
          {t("privacy.2.after")}
        </p>
      </div>
      <div className="card">
        <p>{t("privacy.3")}</p>
        <p>
          {t("privacy.4.before")}
          <a href="#/contact">{t("privacy.4.link")}</a>
          {t("privacy.4.after")}
        </p>
      </div>
      <div className="card">
        <p>
          {t("privacy.5.before")}
          <a href="#/disclaimer">{t("dis.link")}</a>
          {t("privacy.5.after")}
        </p>
      </div>
    </PageShell>
  );
}
