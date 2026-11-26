import { PageShell } from "../app/PageShell.tsx";
import type { StrKey } from "../i18n/en.ts";
import { useT } from "../i18n/index.ts";

const N = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function Disclaimer() {
  const t = useT();
  return (
    <PageShell title={t("page.disclaimer")}>
      <div className="card">
        <p className="field-hint">{t("dis.updated")}</p>
        <ol className="disclaimer-list">
          {N.map((n) => (
            <li key={n}>
              <strong>{t(`dis.${n}.lead` as StrKey)}</strong> {t(`dis.${n}.body` as StrKey)}
            </li>
          ))}
        </ol>
      </div>
    </PageShell>
  );
}
