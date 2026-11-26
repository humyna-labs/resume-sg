import { useLang, useT } from "../../i18n/index.ts";
import { formatRange } from "../../resume/dates.ts";
import type { Resume } from "../../resume/model.ts";

const filled = (list: readonly string[]) => list.filter((s) => s.trim() !== "");

/** One plain layout. Everything is rendered as React text, never as HTML. */
export function Preview({ resume }: { resume: Resume }) {
  const t = useT();
  const { lang } = useLang();
  const b = resume.basics;
  const contact = filled([b.email, b.phone, b.location, ...b.links]);
  const hasHeader = b.name.trim() !== "" || b.headline.trim() !== "" || contact.length > 0;
  const empty =
    !hasHeader &&
    resume.summary.trim() === "" &&
    resume.experience.length === 0 &&
    resume.education.length === 0 &&
    resume.skills.length === 0 &&
    filled(resume.certificates).length === 0 &&
    filled(resume.languages).length === 0;
  const certificates = filled(resume.certificates);
  const languages = filled(resume.languages);

  return (
    <article className="card preview" data-testid="resume-preview" aria-label={t("ed.previewLabel")}>
      {empty ? <p className="pv-empty">{t("ed.previewEmpty")}</p> : null}
      {hasHeader ? (
        <header className="pv-head">
          {b.name.trim() !== "" ? <h2 className="pv-name">{b.name}</h2> : null}
          {b.headline.trim() !== "" ? <p className="pv-headline">{b.headline}</p> : null}
          {contact.length > 0 ? <p className="pv-contact">{contact.join(" · ")}</p> : null}
        </header>
      ) : null}

      {resume.summary.trim() !== "" ? (
        <section>
          <h3>{t("ed.summary")}</h3>
          <p className="pv-text">{resume.summary}</p>
        </section>
      ) : null}

      {resume.experience.length > 0 ? (
        <section>
          <h3>{t("ed.experience")}</h3>
          {resume.experience.map((e) => (
            <div className="pv-entry" key={e.id}>
              <div className="pv-line">
                <strong>{[e.title, e.company].filter((s) => s !== "").join(" · ")}</strong>
                <span className="pv-dates">{formatRange(e.start, e.end, lang)}</span>
              </div>
              {e.location !== "" ? <p className="pv-sub">{e.location}</p> : null}
              {filled(e.bullets).length > 0 ? (
                <ul>
                  {e.bullets.map((x, i) => (x.trim() !== "" ? <li key={i}>{x}</li> : null))}
                </ul>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {resume.education.length > 0 ? (
        <section>
          <h3>{t("ed.education")}</h3>
          {resume.education.map((e) => (
            <div className="pv-entry" key={e.id}>
              <div className="pv-line">
                <strong>{[e.school, e.degree].filter((s) => s !== "").join(" · ")}</strong>
                <span className="pv-dates">{formatRange(e.start, e.end, lang)}</span>
              </div>
              {filled(e.details).length > 0 ? (
                <ul>
                  {e.details.map((x, i) => (x.trim() !== "" ? <li key={i}>{x}</li> : null))}
                </ul>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {resume.skills.length > 0 ? (
        <section>
          <h3>{t("ed.skills")}</h3>
          {resume.skills.map((g) => (
            <p className="pv-text" key={g.id}>
              {g.name !== "" ? <strong>{g.name}: </strong> : null}
              {filled(g.items).join(", ")}
            </p>
          ))}
        </section>
      ) : null}

      {certificates.length > 0 ? (
        <section>
          <h3>{t("ed.certificates")}</h3>
          <ul>
            {certificates.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {languages.length > 0 ? (
        <section>
          <h3>{t("ed.languages")}</h3>
          <p className="pv-text">{languages.join(", ")}</p>
        </section>
      ) : null}
    </article>
  );
}
