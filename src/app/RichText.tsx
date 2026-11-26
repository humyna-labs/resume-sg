import type { RichLine } from "../i18n/en.ts";

/** Builds the structured dictionary entries into React elements (no HTML strings). */
export function RichText({ parts }: { parts: RichLine }) {
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === "string") return p;
        if ("mark" in p) return <mark key={i}>{p.mark}</mark>;
        if ("b" in p) return <b key={i}>{p.b}</b>;
        return <span key={i}>{p.span}</span>;
      })}
    </>
  );
}
