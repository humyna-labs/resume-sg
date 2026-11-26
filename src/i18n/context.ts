import { createContext, useContext } from "react";
import en from "./en.ts";
import zh from "./zh.ts";
import type { Dict, Rich, StrKey } from "./en.ts";

export type Lang = "en" | "zh";

export const dictionaries: Record<Lang, Dict> = { en, zh };

export interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const LangContext = createContext<LangState>({ lang: "en", setLang: () => undefined });

export function useLang(): LangState {
  return useContext(LangContext);
}

export function useT(): (key: StrKey) => string {
  const { lang } = useLang();
  return (key) => dictionaries[lang][key];
}

export function useRich(): Rich {
  const { lang } = useLang();
  return dictionaries[lang].rich;
}

export function detectLang(): Lang {
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}
