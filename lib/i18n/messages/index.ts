import { en } from "./en";
import { ru } from "./ru";
import { uz } from "./uz";

export type Locale = "en" | "ru" | "uz";

type MessageValue = string | { [key: string]: MessageValue };

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "cp.locale";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  uz: "O'zbekcha",
};

export const messages: Record<Locale, Record<string, MessageValue>> = {
  en,
  ru,
  uz,
};
