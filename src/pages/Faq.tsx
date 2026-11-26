import { PageShell } from "../app/PageShell.tsx";
import type { StrKey } from "../i18n/en.ts";
import { useT } from "../i18n/index.ts";

const COUNT = 18;

export function Faq() {
  const t = useT();
  const items = Array.from({ length: COUNT }, (_, i) => i + 1);
  return (
    <PageShell title={t("page.faq")}>
      {items.map((n) => (
        <div className="card faq-item" key={n}>
          <h2>{t(`faq.${n}.q` as StrKey)}</h2>
          <p>{t(`faq.${n}.a` as StrKey)}</p>
        </div>
      ))}
    </PageShell>
  );
}
