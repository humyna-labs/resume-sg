import { useState } from "react";
import { CUSTOM_CHOICE, MODEL_CHOICES } from "../../ai/settings.ts";
import { useT } from "../../i18n/index.ts";
import { AiSettings } from "../ai-settings/AiSettings.tsx";
import type { AiConfig } from "../ai-settings/useAiConfig.ts";

const mask = (key: string): string => `${key.startsWith("sk-ant-") ? "sk-ant-" : ""}••••••••${key.slice(-4)}`;

/**
 * Step 4. With a key that is not remembered on this device: a compact row (masked key, state, Change) and the model.
 * Without a key, or with a remembered one: the full AI settings panel with the 3-step help.
 */
export function KeyArea({ cfg }: { cfg: AiConfig }) {
  const t = useT();
  const [compact, setCompact] = useState(() => cfg.key !== "" && !cfg.remember);
  if (!compact) return <AiSettings cfg={cfg} />;
  return (
    <section className="card fcard fkey" aria-labelledby="fkey-title">
      <h2 id="fkey-title" className="fstep">
        <span className="fnum" aria-hidden="true">4</span>
        {t("flow.step4")}
      </h2>
      <div className="fkeybox">
        <span>
          <b>{mask(cfg.key)}</b> <span className="fok">✓ {t("flow.key.connected")}</span>
        </span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCompact(false)}>
          {t("flow.key.change")}
        </button>
      </div>
      <div className="field">
        <label htmlFor="fkey-model">{t("ai.modelSelect")}</label>
        <select
          id="fkey-model"
          className="input"
          value={cfg.choice}
          onChange={(e) => {
            cfg.setChoice(e.target.value);
            if (e.target.value === CUSTOM_CHOICE) setCompact(false);
          }}
        >
          {MODEL_CHOICES.map((m) => (
            <option key={m.value} value={m.value}>
              {t(m.labelKey)}
            </option>
          ))}
          <option value={CUSTOM_CHOICE}>{t("ai.model.other")}</option>
        </select>
      </div>
      <p className="fsmall">{t("flow.key.note")}</p>
    </section>
  );
}
