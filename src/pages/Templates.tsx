import { useEffect, useRef, useState } from "react";
import { PageShell } from "../app/PageShell.tsx";
import { TemplateSwitch } from "../features/templates/TemplateSwitch.tsx";
import { TemplateView } from "../features/templates/TemplateView.tsx";
import { useLang, useT } from "../i18n/index.ts";
import type { Lang } from "../i18n/index.ts";
import { DEFAULT_TEMPLATE, referenceSample } from "../templates/index.ts";
import type { TemplateId } from "../templates/index.ts";

/** The two templates with the made-up reference person, in a chosen output language. */
export function Templates() {
  const t = useT();
  const { lang: uiLang } = useLang();
  const [tpl, setTpl] = useState<TemplateId>(DEFAULT_TEMPLATE);
  const [lang, setLang] = useState<Lang>("en");
  const prevUi = useRef(uiLang);

  // The output language starts in English and follows the site language when that changes.
  useEffect(() => {
    if (prevUi.current !== uiLang) {
      prevUi.current = uiLang;
      setLang(uiLang);
    }
  }, [uiLang]);

  return (
    <PageShell title={t("page.templates")} lead={t("tpl.lead")} wide>
      <div className="card tpl-bar">
        <TemplateSwitch value={tpl} onChange={setTpl} />
        <div className="tpl-switch" role="radiogroup" aria-label={t("tpl.langLabel")}>
          {(["en", "zh"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={lang === l}
              className={lang === l ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"}
              onClick={() => setLang(l)}
            >
              {l === "en" ? t("tpl.english") : t("tpl.chinese")}
            </button>
          ))}
        </div>
      </div>
      <div className="tpl-stage">
        <TemplateView id={tpl} resume={referenceSample(lang)} lang={lang} />
      </div>
    </PageShell>
  );
}
