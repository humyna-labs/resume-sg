import { useRef, useState } from "react";
import { AiConsentLine } from "../../app/AiConsentLine.tsx";
import { AiError, callAnthropic } from "../../ai/anthropic.ts";
import { CUSTOM_CHOICE, DEFAULT_MODEL, MODEL_CHOICES, isValidModel } from "../../ai/settings.ts";
import type { StrKey } from "../../i18n/en.ts";
import { useT } from "../../i18n/index.ts";
import { getKey, isRemembered, setKey } from "../../security/keyStore.ts";

const REL = "noopener noreferrer";

export function AiSettings() {
  const t = useT();
  const [key, setKeyState] = useState(getKey);
  const [remember, setRemember] = useState(isRemembered);
  const [shown, setShown] = useState(false);
  const [helpOpen, setHelpOpen] = useState(() => getKey() === "");
  const [choice, setChoice] = useState<string>(DEFAULT_MODEL);
  const [custom, setCustom] = useState<string>(DEFAULT_MODEL);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StrKey | null>(null);
  const running = useRef(false);

  const isCustom = choice === CUSTOM_CHOICE;
  const model = isCustom ? custom : choice;
  const modelOk = isCustom ? isValidModel(custom) : true;

  function onKey(value: string) {
    setKeyState(value);
    setKey(value, remember);
  }

  function onRemember(checked: boolean) {
    setRemember(checked);
    setKey(key, checked);
  }

  async function onTest() {
    if (running.current || key === "" || !modelOk) return;
    running.current = true;
    setBusy(true);
    setResult(null);
    try {
      await callAnthropic({ key, model, system: "Reply with one word.", user: "ping", maxTokens: 1 });
      setResult("ai.msg.ok");
    } catch (e) {
      const kind = e instanceof AiError ? e.kind : "network";
      setResult(`ai.msg.${kind}` as StrKey);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="card ai-settings" aria-labelledby="ai-title">
      <h2 id="ai-title">{t("ai.title")}</h2>

      <div className="field">
        <label htmlFor="ai-key">{t("ai.keyLabel")}</label>
        <div className="field-row">
          <input
            id="ai-key"
            className="input"
            type={shown ? "text" : "password"}
            placeholder="sk-ant-..."
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={key}
            onChange={(e) => onKey(e.target.value)}
          />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShown((s) => !s)}>
            {shown ? t("ai.hide") : t("ai.show")}
          </button>
        </div>
        {key !== "" && !key.startsWith("sk-ant-") ? <p className="field-hint">{t("ai.hint")}</p> : null}
      </div>

      <div className="key-help">
        <button
          type="button"
          className="help-toggle"
          aria-expanded={helpOpen}
          aria-controls="ai-help"
          onClick={() => setHelpOpen((o) => !o)}
        >
          {t("ai.help")}
        </button>
        {helpOpen ? (
          <div id="ai-help">
            <ol className="key-steps">
              <li>
                {t("ai.step1.before")}
                <a href="https://platform.claude.com" target="_blank" rel={REL}>
                  {t("ai.step1.link")}
                </a>
                {t("ai.step1.after")}
              </li>
              <li>{t("ai.step2")}</li>
              <li>
                {t("ai.step3.before")}
                <a href="https://platform.claude.com/settings/keys" target="_blank" rel={REL}>
                  {t("ai.step3.link")}
                </a>
                {t("ai.step3.after")}
              </li>
            </ol>
            <p className="field-hint">{t("ai.tip")}</p>
          </div>
        ) : null}
        <p>
          <a className="protect-link" href="#/faq/key-safety">
            {t("ai.protect")}
          </a>
        </p>
      </div>

      <div className="check">
        <label htmlFor="ai-remember">
          <input id="ai-remember" type="checkbox" checked={remember} onChange={(e) => onRemember(e.target.checked)} />
          <span>{t("ai.remember")}</span>
        </label>
        {remember ? <p className="callout">{t("ai.warn")}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="ai-model-select">{t("ai.modelSelect")}</label>
        <select
          id="ai-model-select"
          className="input"
          value={choice}
          aria-describedby="ai-model-help"
          onChange={(e) => setChoice(e.target.value)}
        >
          {MODEL_CHOICES.map((m) => (
            <option key={m.value} value={m.value}>
              {t(m.labelKey)}
            </option>
          ))}
          <option value={CUSTOM_CHOICE}>{t("ai.model.other")}</option>
        </select>
        <p id="ai-model-help" className="field-hint">
          {t("ai.modelHelp")}
        </p>
      </div>

      {isCustom ? (
        <div className="field">
          <label htmlFor="ai-model">{t("ai.modelLabel")}</label>
          <input
            id="ai-model"
            className="input"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={custom}
            aria-invalid={modelOk ? undefined : true}
            aria-describedby={modelOk ? undefined : "ai-model-error"}
            onChange={(e) => setCustom(e.target.value)}
          />
          {modelOk ? null : (
            <p id="ai-model-error" className="field-error" role="alert">
              {t("ai.modelInvalid")}
            </p>
          )}
        </div>
      ) : null}

      <div className="test-row">
        <button type="button" className="btn btn-sm btn-primary" disabled={busy || key === "" || !modelOk} onClick={() => void onTest()}>
          {t("ai.test")}
        </button>
        <p className="test-result" role="status">
          {result ? t(result) : null}
        </p>
      </div>
      <AiConsentLine />
    </section>
  );
}
