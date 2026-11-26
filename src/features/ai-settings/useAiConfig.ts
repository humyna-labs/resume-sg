import { useState } from "react";
import { CUSTOM_CHOICE, DEFAULT_MODEL, isValidModel } from "../../ai/settings.ts";
import { getKey, isRemembered, setKey } from "../../security/keyStore.ts";

/** The key and the model choice. Owned by the page so that the full panel and the compact row share them. */
export function useAiConfig() {
  const [key, setKeyState] = useState(getKey);
  const [remember, setRemember] = useState(isRemembered);
  const [choice, setChoice] = useState<string>(DEFAULT_MODEL);
  const [custom, setCustom] = useState<string>(DEFAULT_MODEL);

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
  return { key, remember, choice, custom, isCustom, model, modelOk, onKey, onRemember, setChoice, setCustom };
}
export type AiConfig = ReturnType<typeof useAiConfig>;
