import { useEffect, useRef, useState } from "react";
import { PageShell } from "../app/PageShell.tsx";
import { CONTACT_EMAIL } from "../config.ts";
import { useT } from "../i18n/index.ts";

export function Contact() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const addressRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const selectAddress = () => {
    const el = addressRef.current;
    const sel = window.getSelection();
    if (!el || !sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      selectAddress();
    }
  };

  return (
    <PageShell title={t("page.contact")} lead={t("contact.line")}>
      <div className="card">
        <div className="contact-actions">
          <a className="btn btn-lg btn-primary" href={`mailto:${CONTACT_EMAIL}?subject=JD2CV%20feedback`}>
            {t("contact.button")}
          </a>
          <button type="button" className="btn btn-lg btn-ghost" aria-label={t("contact.copy")} onClick={copy}>
            {copied ? t("contact.copied") : t("contact.copy")}
          </button>
          <a
            className="btn btn-lg btn-ghost"
            href={`https://mail.google.com/mail/?view=cm&to=${CONTACT_EMAIL}&su=JD2CV%20feedback`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("contact.gmail")}
          </a>
        </div>
        <p className="contact-hint">{t("contact.noMailApp")}</p>
        <p>
          {t("contact.addressLabel")}{" "}
          <span className="address" ref={addressRef}>
            {CONTACT_EMAIL}
          </span>
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
