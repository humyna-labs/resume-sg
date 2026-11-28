import { useState } from "react";
import { CUSTOM_CHOICE, DEFAULT_MODEL, MODEL_CHOICES, isValidModel } from "../../ai/settings.ts";
import { clearKey, getKey, isRemembered, setKey } from "../../security/keyStore.ts";

/** The key and the model choice. Owned by the page so that the full panel and the compact row share them. */
export function useAiConfig(initialModel: string = DEFAULT_MODEL) {
  const known = MODEL_CHOICES.some((m) => m.value === initialModel);
  const [key, setKeyState] = useState(getKey);
  const [remember, setRemember] = useState(isRemembered);
  const [choice, setChoice] = useState<string>(known ? initialModel : CUSTOM_CHOICE);
  const [custom, setCustom] = useState<string>(initialModel);

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
  /** Clear all: forget the key in memory and on this device. */
  function forgetKey() {
    clearKey();
    setKeyState("");
    setRemember(false);
  }
  /** Clear all: back to the default model. */
  function resetModel() {
    setChoice(DEFAULT_MODEL);
    setCustom(DEFAULT_MODEL);
  }
  return { key, remember, choice, custom, isCustom, model, modelOk, onKey, onRemember, forgetKey, resetModel, setChoice, setCustom };
}
export type AiConfig = ReturnType<typeof useAiConfig>;
