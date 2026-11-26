import { useT } from "../../i18n/index.ts";
import { TEMPLATES } from "../../templates/index.ts";
import type { TemplateId } from "../../templates/index.ts";

/** Radio group: Classic or Modern. */
export function TemplateSwitch({ value, onChange }: { value: TemplateId; onChange: (id: TemplateId) => void }) {
  const t = useT();
  return (
    <div className="tpl-switch" role="radiogroup" aria-label={t("tpl.switchLabel")}>
      {TEMPLATES.map((x) => (
        <button
          key={x.id}
          type="button"
          role="radio"
          aria-checked={value === x.id}
          className={value === x.id ? "btn btn-sm btn-primary" : "btn btn-sm btn-ghost"}
          onClick={() => onChange(x.id)}
        >
          {t(x.nameKey)}
        </button>
      ))}
    </div>
  );
}
