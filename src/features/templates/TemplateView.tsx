import { TEMPLATES } from "../../templates/index.ts";
import type { TemplateId, TemplateProps } from "../../templates/index.ts";

/** Renders the chosen template. Its root carries data-template and data-print-root. */
export function TemplateView({ id, resume, lang }: TemplateProps & { id: TemplateId }) {
  const entry = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
  if (!entry) return null;
  const C = entry.component;
  return <C resume={resume} lang={lang} />;
}
