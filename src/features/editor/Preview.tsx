import { useState } from "react";
import { ExportButtons } from "../../export/ExportButtons.tsx";
import { useLang, useT } from "../../i18n/index.ts";
import type { Resume } from "../../resume/model.ts";
import { DEFAULT_TEMPLATE } from "../../templates/index.ts";
import type { TemplateId } from "../../templates/index.ts";
import { isBlank } from "../../templates/common.ts";
import { TemplateSwitch } from "../templates/TemplateSwitch.tsx";
import { TemplateView } from "../templates/TemplateView.tsx";

/** The live preview: the chosen template, with the switcher above it. Only the template changes, never the data. */
export function Preview({ resume }: { resume: Resume }) {
  const t = useT();
  const { lang } = useLang();
  const [tpl, setTpl] = useState<TemplateId>(DEFAULT_TEMPLATE);

  return (
    <article className="card preview" data-testid="resume-preview" aria-label={t("ed.previewLabel")}>
      <TemplateSwitch value={tpl} onChange={setTpl} />
      <div className="ftoolbar">
        <ExportButtons resume={resume} lang={lang} />
      </div>
      {isBlank(resume) ? <p className="pv-empty">{t("ed.previewEmpty")}</p> : null}
      <div className="tpl-stage">
        <TemplateView id={tpl} resume={resume} lang={lang} />
      </div>
    </article>
  );
}
