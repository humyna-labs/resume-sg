import { useEffect } from "react";
import { PageShell } from "../app/PageShell.tsx";
import type { StrKey } from "../i18n/en.ts";
import { useT } from "../i18n/index.ts";

const COUNT = 18;
/** Entries that can be opened by hash, for example #/faq/key-safety. */
const ANCHORS: Record<number, string> = { 5: "key-safety" };

export function Faq() {
  const t = useT();
  const items = Array.from({ length: COUNT }, (_, i) => i + 1);

  useEffect(() => {
    const id = window.location.hash.replace(/^#\/faq\//, "");
    if (id === window.location.hash) return;
    document.getElementById(id)?.scrollIntoView?.({ block: "start" });
  }, []);

  return (
    <PageShell title={t("page.faq")}>
      {items.map((n) => (
        <div className="card faq-item" key={n} id={ANCHORS[n]}>
          <h2>{t(`faq.${n}.q` as StrKey)}</h2>
          <p>{t(`faq.${n}.a` as StrKey)}</p>
        </div>
      ))}
    </PageShell>
  );
}
