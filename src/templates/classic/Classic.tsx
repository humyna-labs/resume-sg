import { Fragment } from "react";
import { contactOf } from "../common.ts";
import type { TemplateProps } from "../common.ts";
import { Paged } from "../Paged.tsx";
import "./classic.css";

/** Classic: black and grey, one column, pages measured and filled by Paged. Everything is React text, never HTML. */
export function Classic({ resume, lang }: TemplateProps) {
  const b = resume.basics;
  const contact = contactOf(resume);
  const header =
    b.name.trim() !== "" || b.headline.trim() !== "" || contact.length > 0 ? (
      <header className="hd">
        {b.name.trim() !== "" ? <p className="tc-name">{b.name}</p> : null}
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
    ) : null;
  return <Paged resume={resume} lang={lang} variant="classic" rootClass="tc" header={header} />;
}
