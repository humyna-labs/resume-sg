import { PageShell } from "../app/PageShell.tsx";
import { CONTACT_EMAIL } from "../config.ts";
import { useT } from "../i18n/index.ts";

export function Contact() {
  const t = useT();
  return (
    <PageShell title={t("page.contact")} lead={t("contact.line")}>
      <div className="card">
        <a className="btn btn-lg btn-primary" href={`mailto:${CONTACT_EMAIL}?subject=JD2CV%20feedback`}>
          {t("contact.button")}
        </a>
        <p>
          {t("contact.addressLabel")} <span className="address">{CONTACT_EMAIL}</span>
        </p>
      </div>
      <div className="card">
        <h2>{t("contact.includeTitle")}</h2>
        <ul>
          <li>{t("contact.include.1")}</li>
          <li>{t("contact.include.2")}</li>
          <li>{t("contact.include.3")}</li>
          <li>{t("contact.include.4")}</li>
        </ul>
        <p className="callout">{t("contact.note")}</p>
      </div>
      <div className="card">
        <p>
          <a href="#/faq">{t("contact.faq")}</a> · <a href="#/how-it-works">{t("contact.how")}</a>
        </p>
      </div>
    </PageShell>
  );
}
