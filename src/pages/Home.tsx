import { useT } from "../i18n/index.ts";

export function Home() {
  const t = useT();
  return (
    <section className="home">
      <p className="intro">{t("home.intro")}</p>
      <h1>{t("home.title")}</h1>
      <p className="lead">{t("home.lead")}</p>
      <a className="btn-primary" href="#/app">
        {t("home.cta")}
      </a>
      <ul className="values">
        <li>{t("home.value1")}</li>
        <li>{t("home.value2")}</li>
        <li>{t("home.value3")}</li>
      </ul>
      <ol className="steps" aria-label={t("home.stepsLabel")}>
        <li>{t("home.step1")}</li>
        <li>{t("home.step2")}</li>
        <li>{t("home.step3")}</li>
      </ol>
    </section>
  );
}
