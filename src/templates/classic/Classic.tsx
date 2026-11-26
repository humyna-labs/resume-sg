import { Fragment } from "react";
import { formatRange } from "../../resume/dates.ts";
import {
  SECTION_NAMES,
  contactOf,
  filled,
  groupLabel,
  htmlLang,
  joinItems,
  joinLanguages,
  organisation,
  sectionsOf,
} from "../common.ts";
import type { TemplateProps } from "../common.ts";
import "./classic.css";

function Bullets({ items }: { items: readonly string[] }) {
  const list = filled(items);
  if (list.length === 0) return null;
  return (
    <ul className="tc-list">
      {list.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

/** Classic: black and grey, one column. Everything is React text, never HTML. */
export function Classic({ resume, lang }: TemplateProps) {
  const names = SECTION_NAMES[lang];
  const has = sectionsOf(resume);
  const b = resume.basics;
  const contact = contactOf(resume);

  return (
    <article className="tc" data-template="classic" data-print-root lang={htmlLang(lang)}>
      {b.name.trim() !== "" || b.headline.trim() !== "" || contact.length > 0 ? (
        <header className="tc-head">
          {b.name.trim() !== "" ? <h2 className="tc-name">{b.name}</h2> : null}
          {b.headline.trim() !== "" ? <p className="tc-headline">{b.headline}</p> : null}
          {contact.length > 0 ? (
            <p className="tc-contact">
              {contact.map((c, i) => (
                <Fragment key={i}>
                  {i > 0 ? (
                    <span className="tc-sep" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  <span>{c}</span>
                </Fragment>
              ))}
            </p>
          ) : null}
        </header>
      ) : null}

      {has.summary ? (
        <section>
          <h3 className="tc-h">{names.summary}</h3>
          <p>{resume.summary}</p>
        </section>
      ) : null}

      {has.experience ? (
        <section>
          <h3 className="tc-h">{names.experience}</h3>
          {resume.experience.map((e) => {
            const bullets = filled(e.bullets);
            return (
              <div className="tc-entry" key={e.id}>
                <div className="tc-keep">
                  <div className="tc-row">
                    <span className="tc-lead">
                      <span className="tc-title">{e.title}</span>
                      {organisation(e.company, e.location, lang) !== "" ? (
                        <span className="tc-org">
                          {lang === "zh" ? "　" : " — "}
                          {organisation(e.company, e.location, lang)}
                        </span>
                      ) : null}
                    </span>
                    <span className="tc-dates">{formatRange(e.start, e.end, lang)}</span>
                  </div>
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
          <h3 className="tc-h">{names.education}</h3>
          {resume.education.map((e) => (
            <div className="tc-entry" key={e.id}>
              <div className="tc-keep">
                <div className="tc-row">
                  <span className="tc-lead">
                    <span className="tc-title">{e.degree !== "" ? e.degree : e.school}</span>
                    {e.degree !== "" && e.school.trim() !== "" ? (
                      <span className="tc-org">
                        {lang === "zh" ? "　" : " — "}
                        {e.school}
                      </span>
                    ) : null}
                  </span>
                  <span className="tc-dates">{formatRange(e.start, e.end, lang)}</span>
                </div>
                <Bullets items={filled(e.details).slice(0, 1)} />
              </div>
              <Bullets items={filled(e.details).slice(1)} />
            </div>
          ))}
        </section>
      ) : null}

      {has.skills ? (
        <section>
          <h3 className="tc-h">{names.skills}</h3>
          {resume.skills.map((g) => (
            <p className="tc-skill" key={g.id}>
              {g.name.trim() !== "" ? <strong>{groupLabel(g.name, lang)}</strong> : null}
              {joinItems(g.items, lang)}
            </p>
          ))}
        </section>
      ) : null}

      {has.certificates ? (
        <section>
          <h3 className="tc-h">{names.certificates}</h3>
          <Bullets items={resume.certificates} />
        </section>
      ) : null}

      {has.languages ? (
        <section>
          <h3 className="tc-h">{names.languages}</h3>
          <p>{joinLanguages(resume.languages, lang)}</p>
        </section>
      ) : null}
    </article>
  );
}
