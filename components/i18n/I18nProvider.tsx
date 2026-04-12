"use client";

import * as React from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  localeLabels,
  messages,
  type Locale,
} from "@/lib/i18n/messages";

type TranslateValues = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: TranslateValues) => string;
  localeLabels: Record<Locale, string>;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

function getNestedValue(source: Record<string, unknown>, key: string): string | null {
  const parts = key.split(".");
  let current: unknown = source;

  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : null;
}

function interpolate(template: string, values?: TranslateValues) {
  if (!values) return template;

  return Object.entries(values).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
}

function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (saved === "en" || saved === "ru" || saved === "uz") {
    return saved;
  }

  const browserLocale = window.navigator.language.toLowerCase();
  if (browserLocale.startsWith("ru")) return "ru";
  if (browserLocale.startsWith("uz")) return "uz";
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = React.useState<Locale>(DEFAULT_LOCALE);

  React.useEffect(() => {
    setLocale(resolveInitialLocale());
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = React.useMemo<I18nContextValue>(() => {
    const dictionary =
      messages?.[locale] ?? messages?.[DEFAULT_LOCALE] ?? ({} as Record<string, unknown>);

    return {
      locale,
      setLocale,
      localeLabels,
      t: (key, values) => {
        const localized = getNestedValue(dictionary as Record<string, unknown>, key);
        const fallback = getNestedValue(
          messages[DEFAULT_LOCALE] as Record<string, unknown>,
          key,
        );
        return interpolate(localized ?? fallback ?? key, values);
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = React.useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

