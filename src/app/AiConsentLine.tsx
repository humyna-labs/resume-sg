import { useT } from "../i18n/index.ts";

/** One small line under every button that sends data to the AI. Stores nothing. */
export function AiConsentLine() {
  const t = useT();
  return (
    <p className="consent-line">
      {t("dis.consent.before")}
      <a href="#/disclaimer">{t("dis.link")}</a>
      {t("dis.consent.after")}
    </p>
  );
}
