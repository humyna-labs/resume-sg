import type { ReactNode } from "react";
import { useLang, useT } from "../i18n/index.ts";

const REPO = "https://github.com/humyna-labs/resume-sg";

export function Layout({ children }: { children: ReactNode }) {
  const t = useT();
  const { lang, setLang } = useLang();
  return (
    <div className="shell">
      <header className="topbar">
        <nav className="nav" aria-label={t("nav.label")}>
          <a className="logo" href="#/">
            {t("nav.logo")}
          </a>
          <ul className="nav-links">
            <li>
              <a href="#/app">{t("nav.start")}</a>
            </li>
            <li>
              <a href="#/how-it-works">{t("nav.how")}</a>
            </li>
            <li>
              <a href="#/faq">{t("nav.faq")}</a>
            </li>
            <li>
              <a href="#/contact">{t("nav.contact")}</a>
            </li>
          </ul>
          <button
            type="button"
            className="lang-switch"
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          >
            <span lang={lang === "zh" ? "en" : "zh-CN"}>{t("nav.switch")}</span>
          </button>
        </nav>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">
        <a href="#/privacy">{t("footer.privacy")}</a>
        <span>{t("footer.licence")}</span>
        <a href={REPO} rel="noopener noreferrer">
          {t("footer.source")}
        </a>
      </footer>
    </div>
  );
}
