import { PageShell } from "../app/PageShell.tsx";
import { TailorFlow } from "../features/tailor/TailorFlow.tsx";
import { useT } from "../i18n/index.ts";

export function AppPage() {
  const t = useT();
  return (
    <PageShell title={t("page.app")} lead={t("flow.lead")} wide>
      <TailorFlow />
    </PageShell>
  );
}
