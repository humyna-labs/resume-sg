import type { Dict } from "../i18n/en.ts";
import { useT } from "../i18n/index.ts";

export function Placeholder({ titleKey }: { titleKey: keyof Dict }) {
  const t = useT();
  return (
    <section className="page">
      <h1>{t(titleKey)}</h1>
    </section>
  );
}
