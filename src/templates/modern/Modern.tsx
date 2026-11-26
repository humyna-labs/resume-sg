import { Fragment } from "react";
import { formatRange } from "../../resume/dates.ts";
import { SECTION_NAMES, contactOf, filled, groupLabel, htmlLang, joinLanguages, organisation, sectionsOf } from "../common.ts";
import type { TemplateProps } from "../common.ts";
import "./modern.css";

function Bullets({ items }: { items: readonly string[] }) {
  const list = filled(items);
  if (list.length === 0) return null;
  return (
    <ul className="tm-list">
      {list.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

/** Modern: tinted header block, one accent colour, skills as chips. Everything is React text, never HTML. */
export function Modern({ resume, lang }: TemplateProps) {
  const names = SECTION_NAMES[lang];
  const has = sectionsOf(resume);
  const b = resume.basics;
  const contact = contactOf(resume);

  return (
    <article className="tm" data-template="modern" data-print-root lang={htmlLang(lang)}>
      {b.name.trim() !== "" || b.headline.trim() !== "" || contact.length > 0 ? (
        <header className="tm-head">
          {b.name.trim() !== "" ? <h2 className="tm-name">{b.name}</h2> : null}
          {b.headline.trim() !== "" ? <p className="tm-headline">{b.headline}</p> : null}
          {contact.length > 0 ? (
            <p className="tm-contact">
              {contact.map((c, i) => (
                <Fragment key={i}>
                  {i > 0 ? " " : null}
                  <span className="tm-pill">{c}</span>
                </Fragment>
              ))}
            </p>
          ) : null}
        </header>
      ) : null}

      <div className="tm-body">
        {has.summary ? (
          <section>
            <h3 className="tm-h">{names.summary}</h3>
            <p>{resume.summary}</p>
          </section>
        ) : null}

        {has.experience ? (
          <section>
            <h3 className="tm-h">{names.experience}</h3>
            {resume.experience.map((e) => {
              const bullets = filled(e.bullets);
              return (
                <div className="tm-entry" key={e.id}>
                  <div className="tm-keep">
                    <div className="tm-row">
                      <span className="tm-title">{e.title}</span>
                      <span className="tm-dates">{formatRange(e.start, e.end, lang)}</span>
                    </div>
                    {organisation(e.company, e.location, lang) !== "" ? <div className="tm-org">{organisation(e.company, e.location, lang)}</div> : null}
                    <Bullets items={bullets.slice(0, 1)} />
                  </div>
                  <Bullets items={bullets.slice(1)} />
                </div>
              );
            })}
          </section>
        ) : null}

        {has.education ? (
          <section>
            <h3 className="tm-h">{names.education}</h3>
            {resume.education.map((e) => (
              <div className="tm-entry" key={e.id}>
                <div className="tm-keep">
                  <div className="tm-row">
                    <span className="tm-title">{e.school}</span>
                    <span className="tm-dates">{formatRange(e.start, e.end, lang)}</span>
                  </div>
                  {e.degree !== "" ? <div className="tm-org">{e.degree}</div> : null}
                  <Bullets items={filled(e.details).slice(0, 1)} />
                </div>
                <Bullets items={filled(e.details).slice(1)} />
              </div>
            ))}
          </section>
        ) : null}

        {has.skills ? (
          <section>
            <h3 className="tm-h">{names.skills}</h3>
            {resume.skills.map((g) => (
              <div className="tm-skill" key={g.id}>
                {g.name.trim() !== "" ? <span className="tm-group">{groupLabel(g.name, lang)}</span> : null}
                {filled(g.items).map((item, i) => (
                  <Fragment key={i}>
                    {" "}
                    <span className="tm-chip">{item}</span>
                  </Fragment>
                ))}
              </div>
            ))}
          </section>
        ) : null}

        {has.certificates ? (
          <section>
            <h3 className="tm-h">{names.certificates}</h3>
            <Bullets items={resume.certificates} />
          </section>
        ) : null}

        {has.languages ? (
          <section>
            <h3 className="tm-h">{names.languages}</h3>
            <p>{joinLanguages(resume.languages, lang)}</p>
          </section>
        ) : null}
      </div>
    </article>
  );
}
