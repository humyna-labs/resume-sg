import { useT } from "../i18n/index.ts";

export function Privacy() {
  const t = useT();
  return (
    <section className="page info">
      <h1>{t("page.privacy")}</h1>
      <p>{t("privacy.1")}</p>
      <p>
        {t("privacy.2.before")}
        <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">
          {t("privacy.2.link")}
        </a>
        {t("privacy.2.after")}
      </p>
      <p>{t("privacy.3")}</p>
      <p>
        {t("privacy.4.before")}
        <a href="#/contact">{t("privacy.4.link")}</a>
        {t("privacy.4.after")}
      </p>
    </section>
  );
}
