import { PageShell } from "../app/PageShell.tsx";
import type { StrKey } from "../i18n/en.ts";
import { useT } from "../i18n/index.ts";

export function Placeholder({ titleKey }: { titleKey: StrKey }) {
  const t = useT();
  return <PageShell title={t(titleKey)} />;
}
