import { useState } from "react";
import { CUSTOM_CHOICE, MODEL_CHOICES } from "../../ai/settings.ts";
import { useT } from "../../i18n/index.ts";
import { AiSettings } from "../ai-settings/AiSettings.tsx";
import type { AiConfig } from "../ai-settings/useAiConfig.ts";

const mask = (key: string): string => `${key.startsWith("sk-ant-") ? "sk-ant-" : ""}••••••••${key.slice(-4)}`;

/**
 * Part of step 4, inside its card. With a key that is not remembered on this device: a compact row (masked key,
 * state, Change) and the model. Without a key, or with a remembered one: the full AI settings panel with the 3-step help.
 */
export function KeyArea({ cfg, onDeleteAll }: { cfg: AiConfig; onDeleteAll?: () => void }) {
  const t = useT();
  const [compact, setCompact] = useState(() => cfg.key !== "" && !cfg.remember);
  if (!compact) {
    return (
      <div data-testid="key-row">
        <AiSettings cfg={cfg} bare onDeleteAll={onDeleteAll} />
      </div>
    );
  }
  return (
    <div className="fkey" data-testid="key-row">
      <h3 className="wz-label">{t("flow.key.row")}</h3>
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
    </div>
  );
}
