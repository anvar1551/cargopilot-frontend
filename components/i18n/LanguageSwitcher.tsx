"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/messages";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LanguageSwitcherProps = {
  showLabel?: boolean;
  compact?: boolean;
};

export default function LanguageSwitcher({
  showLabel = false,
  compact = false,
}: LanguageSwitcherProps) {
  const { locale, localeLabels, setLocale, t } = useI18n();

  return (
    <div className="space-y-1.5">
      {showLabel ? <Label>{t("common.language")}</Label> : null}
      <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
        <SelectTrigger className={compact ? "h-9 w-[148px]" : "w-full"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(localeLabels).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
