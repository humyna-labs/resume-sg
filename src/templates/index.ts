import type { ComponentType } from "react";
import type { StrKey } from "../i18n/en.ts";
import { Classic } from "./classic/Classic.tsx";
import type { TemplateProps } from "./common.ts";
import { Modern } from "./modern/Modern.tsx";
import "./print.css";

export type TemplateId = "classic" | "modern";

export interface TemplateEntry {
  id: TemplateId;
  nameKey: StrKey;
  component: ComponentType<TemplateProps>;
}

export const TEMPLATES: readonly TemplateEntry[] = [
  { id: "classic", nameKey: "tpl.classic", component: Classic },
  { id: "modern", nameKey: "tpl.modern", component: Modern },
];

export const DEFAULT_TEMPLATE: TemplateId = "classic";

export { referenceSample } from "./referenceSample.ts";
export type { TemplateProps } from "./common.ts";
