import type { Dict } from "../i18n/en.ts";
import { useT } from "../i18n/index.ts";

const COUNT = 18;

export function Faq() {
  const t = useT();
  const items = Array.from({ length: COUNT }, (_, i) => i + 1);
  return (
    <section className="page info">
      <h1>{t("page.faq")}</h1>
      {items.map((n) => (
        <div className="faq-item" key={n}>
          <h2>{t(`faq.${n}.q` as keyof Dict)}</h2>
          <p>{t(`faq.${n}.a` as keyof Dict)}</p>
        </div>
      ))}
    </section>
  );
}
