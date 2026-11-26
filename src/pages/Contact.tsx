import { CONTACT_EMAIL } from "../config.ts";
import { useT } from "../i18n/index.ts";

export function Contact() {
  const t = useT();
  return (
    <section className="page info">
      <h1>{t("page.contact")}</h1>
      <p>{t("contact.line")}</p>
      <a className="btn-primary" href={`mailto:${CONTACT_EMAIL}?subject=JD2CV%20feedback`}>
        {t("contact.button")}
      </a>
      <p>
        {t("contact.addressLabel")} <span className="address">{CONTACT_EMAIL}</span>
      </p>
      <h2>{t("contact.includeTitle")}</h2>
      <ul>
        <li>{t("contact.include.1")}</li>
        <li>{t("contact.include.2")}</li>
        <li>{t("contact.include.3")}</li>
        <li>{t("contact.include.4")}</li>
      </ul>
      <p className="note">{t("contact.note")}</p>
      <p>
        <a href="#/faq">{t("contact.faq")}</a> · <a href="#/how-it-works">{t("contact.how")}</a>
      </p>
    </section>
  );
}
