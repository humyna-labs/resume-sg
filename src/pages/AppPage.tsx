import { PageShell } from "../app/PageShell.tsx";
import { ResumeEditor } from "../features/editor/ResumeEditor.tsx";
import { AiSettings } from "../features/ai-settings/AiSettings.tsx";
import { useT } from "../i18n/index.ts";

export function AppPage() {
  const t = useT();
  return (
    <PageShell title={t("page.app")} wide>
      <ResumeEditor />
      <AiSettings />
    </PageShell>
  );
}
