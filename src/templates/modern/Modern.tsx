import { Fragment } from "react";
import { contactOf } from "../common.ts";
import type { TemplateProps } from "../common.ts";
import { Paged } from "../Paged.tsx";
import "./modern.css";

/** Modern: tinted header block, one accent colour, skills as chips. Everything is React text, never HTML. */
export function Modern({ resume, lang }: TemplateProps) {
  const b = resume.basics;
  const contact = contactOf(resume);
  const header =
    b.name.trim() !== "" || b.headline.trim() !== "" || contact.length > 0 ? (
      <header className="top">
        {b.name.trim() !== "" ? <p className="tm-name">{b.name}</p> : null}
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
    ) : null;
  return <Paged resume={resume} lang={lang} variant="modern" rootClass="tm" header={header} />;
}
