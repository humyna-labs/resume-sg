import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AiConsentLine } from "../../app/AiConsentLine.tsx";
import { AiError, callAnthropic } from "../../ai/anthropic.ts";
import { CUSTOM_CHOICE, MODEL_CHOICES } from "../../ai/settings.ts";
import type { StrKey } from "../../i18n/en.ts";
import { useT } from "../../i18n/index.ts";
import { getKey } from "../../security/keyStore.ts";
import type { AiConfig } from "./useAiConfig.ts";

const REL = "noopener noreferrer";

/** Confirm dialog of "Delete all my data". Esc and Cancel close it; the caller returns the focus to the button. */
function DeleteDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const t = useT();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") onCancel();
    if (e.key === "Tab") {
      e.preventDefault();
      (document.activeElement === cancelRef.current ? confirmRef.current : cancelRef.current)?.focus();
    }
  }
  return (
    <div className="fmodal">
      <div className="fdialog" role="alertdialog" aria-modal="true" aria-labelledby="ai-delete-ask" onKeyDown={onKey}>
        <p id="ai-delete-ask">{t("ai.deleteAll.ask")}</p>
        <div className="frow end">
          <button type="button" ref={confirmRef} className="btn btn-sm btn-secondary" data-testid="delete-all-confirm" onClick={onConfirm}>
            {t("ai.deleteAll.yes")}
          </button>
          <button type="button" ref={cancelRef} className="btn btn-sm btn-primary" data-testid="delete-all-cancel" onClick={onCancel}>
            {t("ai.deleteAll.no")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AiSettings({ cfg, bare = false, onDeleteAll }: { cfg: AiConfig; bare?: boolean; onDeleteAll?: () => void }) {
  const t = useT();
  const { key, remember, choice, custom, isCustom, model, modelOk, onKey, onRemember, setChoice, setCustom } = cfg;
  const [shown, setShown] = useState(false);
  const [helpOpen, setHelpOpen] = useState(() => getKey() === "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StrKey | null>(null);
  const running = useRef(false);
  const keyRef = useRef<HTMLInputElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);

  // Uncontrolled: the key is set as a property from the store, never as a value attribute.
  useEffect(() => {
    if (keyRef.current && keyRef.current.value !== key) keyRef.current.value = key;
  }, [key]);

  function closeDelete() {
    setConfirming(false);
    deleteRef.current?.focus();
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
    <section className={bare ? "ai-settings" : "card ai-settings"} aria-labelledby="ai-title">
      <h2 id="ai-title">{t("ai.title")}</h2>

      <div className="field">
        <label htmlFor="ai-key">{t("ai.keyLabel")}</label>
        <div className="field-row">
          <input
            id="ai-key"
            className="input"
            type={shown ? "text" : "password"}
            placeholder="sk-ant-..."
            ref={keyRef}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            autoCapitalize="off"
            spellCheck={false}
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
      <div className="test-row">
        <button type="button" ref={deleteRef} className="btn btn-sm btn-secondary" onClick={() => setConfirming(true)}>
          {t("ai.deleteAll")}
        </button>
      </div>
      {confirming ? (
        <DeleteDialog
          onCancel={closeDelete}
          onConfirm={() => {
            setConfirming(false);
            if (onDeleteAll) onDeleteAll();
            else cfg.forgetKey();
          }}
        />
      ) : null}
    </section>
  );
}
