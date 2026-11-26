import type { ReactNode } from "react";

/** Alternate-background header block (h1 styled as h2) followed by the page cards. */
export function PageShell({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <>
      <section className="alt page-head">
        <div className="wrap">
          <h1 className="h2">{title}</h1>
          {lead ? <p className="lead">{lead}</p> : null}
        </div>
      </section>
      {children ? (
        <section className="page-body">
          <div className="wrap stack">{children}</div>
        </section>
      ) : null}
    </>
  );
}
