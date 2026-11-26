import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLang, useT } from "../i18n/index.ts";
import { MenuIcon } from "../icons/index.tsx";

const REPO = "https://github.com/humyna-labs/resume-sg";
const BRAND_SUB = { zh: "对岗简历" } as const;

export function Layout({ children }: { children: ReactNode }) {
  const t = useT();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const onHash = () => setOpen(false);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const links = [
    ["#/how-it-works", t("nav.how")],
    ["#/faq", t("nav.faq")],
    ["#/contact", t("nav.contact")],
  ] as const;

  return (
    <div className="shell">
      <header className="nav">
        <div className="wrap nav-bar">
          <a className="brand" href="#/" onClick={close}>
            <span>
              JD<b>2</b>CV
            </span>
            {lang === "zh" ? <small>{BRAND_SUB.zh}</small> : null}
          </a>
          <nav className="links" aria-label={t("nav.label")}>
            {links.map(([href, label]) => (
              <a key={href} className="txt" href={href}>
                {label}
              </a>
            ))}
            <a className="btn btn-sm btn-primary" href="#/app" onClick={close}>
              {t("nav.start")}
            </a>
            <button type="button" className="lang" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
              <span lang={lang === "zh" ? "en" : "zh-CN"}>{t("nav.switch")}</span>
            </button>
            <button
              type="button"
              className="menu"
              aria-label={t("nav.menu")}
              aria-expanded={open}
              aria-controls="nav-sheet"
              onClick={() => setOpen((o) => !o)}
            >
              <MenuIcon open={open} />
            </button>
          </nav>
        </div>
        {open ? (
          <div className="sheet" id="nav-sheet">
            <ul>
              {links.map(([href, label]) => (
                <li key={href}>
                  <a href={href} onClick={close}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>
      <main className="main">{children}</main>
      <footer className="footer">
        <div className="wrap">
          <span>{t("footer.line")}</span>
          <p className="footer-agree">
            {t("dis.footer.before")}
            <a href="#/disclaimer">{t("dis.link")}</a>
            {t("dis.footer.after")}
          </p>
          <nav aria-label={t("footer.privacy")}>
            <a href="#/privacy">{t("footer.privacy")}</a>
            <a href="#/disclaimer">{t("dis.link")}</a>
            <span>{t("footer.licence")}</span>
            <a href={REPO} rel="noopener noreferrer">
              {t("footer.source")}
            </a>
            <a href="#/contact">{t("footer.contact")}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
