"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BellRing,
  Building2,
  Palette,
  Save,
  Settings2,
  Shield,
  UserCircle2,
} from "lucide-react";

import { clearAuth, getUser, roleToDashboardPath, type Role } from "@/lib/auth";
import {
  DEFAULT_USER_SETTINGS,
  loadUserSettings,
  saveUserSettings,
  type UserSettings,
} from "@/lib/user-settings";
import { changePassword } from "@/lib/users";

import { useI18n } from "@/components/i18n/I18nProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import PageShell from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

function equalSettings(a: UserSettings, b: UserSettings) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function SettingsView({
  role,
  title,
}: {
  role: Role;
  title?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [user] = React.useState(() => getUser());
  const [settings, setSettings] = React.useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [initialSettings, setInitialSettings] = React.useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  React.useEffect(() => {
    const loaded = loadUserSettings();
    setSettings(loaded);
    setInitialSettings(loaded);
  }, []);

  const hasChanges = !equalSettings(settings, initialSettings);

  const save = () => {
    saveUserSettings(settings);
    setInitialSettings(settings);
    toast.success(t("settingsPage.saveSuccess"));
  };

  const reset = () => {
    setSettings(DEFAULT_USER_SETTINGS);
    saveUserSettings(DEFAULT_USER_SETTINGS);
    setInitialSettings(DEFAULT_USER_SETTINGS);
    toast.success(t("settingsPage.resetSuccess"));
  };

  const logout = () => {
    clearAuth();
    router.replace("/login");
  };

  const submitPasswordChange = async () => {
    if (!currentPassword) {
      toast.error(t("settingsPage.passwordCurrentRequired"));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t("settingsPage.passwordMinLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("settingsPage.passwordConfirmMismatch"));
      return;
    }

    if (currentPassword === newPassword) {
      toast.error(t("settingsPage.passwordDifferent"));
      return;
    }

    try {
      setIsChangingPassword(true);
      const result = await changePassword({ currentPassword, newPassword });
      toast.success(result.message || t("settingsPage.changePassword"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: unknown } } }).response?.data
          ?.error === "string"
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : t("settingsPage.passwordUpdateFailed");

      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const pageTitle = title ?? t(`settingsPage.title.${role}`);
  const pageSubtitle = t(`settingsPage.subtitle.${role}`);

  return (
    <PageShell>
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-zinc-900 via-zinc-800 to-slate-900 text-white">
          <div className="absolute -right-12 -top-14 h-48 w-48 rounded-full bg-cyan-400/15 blur-2xl" />
          <CardContent className="relative p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs">
                  <Settings2 className="h-3.5 w-3.5" />
                  {t("settingsPage.workspaceSettings")}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
                <p className="max-w-2xl text-sm text-zinc-200/90">{pageSubtitle}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={reset}>
                  {t("common.reset")}
                </Button>
                <Button onClick={save} disabled={!hasChanges} className="gap-2">
                  <Save className="h-4 w-4" />
                  {t("common.save")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <Card className="rounded-2xl border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Palette className="h-4 w-4" />
                  {t("settingsPage.workspace")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("settingsPage.uiDensity")}</Label>
                    <Select
                      value={settings.uiDensity}
                      onValueChange={(value: "comfortable" | "compact") =>
                        setSettings((prev) => ({ ...prev, uiDensity: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comfortable">
                          {t("settingsPage.uiDensityComfortable")}
                        </SelectItem>
                        <SelectItem value="compact">
                          {t("settingsPage.uiDensityCompact")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t("settingsPage.autoRefresh")}</Label>
                    <Select
                      value={settings.autoRefreshSec}
                      onValueChange={(value: "off" | "15" | "30" | "60") =>
                        setSettings((prev) => ({ ...prev, autoRefreshSec: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">{t("settingsPage.autoRefreshOff")}</SelectItem>
                        <SelectItem value="15">{t("settingsPage.autoRefresh15")}</SelectItem>
                        <SelectItem value="30">{t("settingsPage.autoRefresh30")}</SelectItem>
                        <SelectItem value="60">{t("settingsPage.autoRefresh60")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border px-3 py-3">
                    <LanguageSwitcher showLabel />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("settingsPage.languageSectionHint")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{t("settingsPage.playScanSound")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("settingsPage.playScanSoundHint")}
                      </p>
                    </div>
                    <Switch
                      checked={settings.playScanSound}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({ ...prev, playScanSound: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border px-3 py-2 sm:col-span-2">
                    <div>
                      <p className="text-sm font-medium">{t("settingsPage.confirmBulkApply")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("settingsPage.confirmBulkApplyHint")}
                      </p>
                    </div>
                    <Switch
                      checked={settings.confirmBulkApply}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({ ...prev, confirmBulkApply: checked }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BellRing className="h-4 w-4" />
                  {t("settingsPage.notifications")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <p className="text-sm font-medium">{t("settingsPage.exceptionAlerts")}</p>
                  <Switch
                    checked={settings.notifyExceptions}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, notifyExceptions: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <p className="text-sm font-medium">{t("settingsPage.deliveryAlerts")}</p>
                  <Switch
                    checked={settings.notifyDelivery}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, notifyDelivery: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <p className="text-sm font-medium">{t("settingsPage.paymentAlerts")}</p>
                  <Switch
                    checked={settings.notifyPayments}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, notifyPayments: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="rounded-2xl border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCircle2 className="h-4 w-4" />
                  {t("settingsPage.account")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t("settingsPage.name")}</p>
                  <p className="font-medium">{user?.name ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("settingsPage.email")}</p>
                  <p className="font-medium">{user?.email ?? "-"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{t("settingsPage.role")}</p>
                  <Badge variant="secondary" className="capitalize">
                    {t(`common.role.${user?.role ?? role}`)}
                  </Badge>
                </div>
                {user?.warehouseId ? (
                  <div>
                    <p className="text-xs text-muted-foreground">{t("settingsPage.warehouse")}</p>
                    <p className="text-xs font-medium">{t("settingsPage.warehouseLinked")}</p>
                  </div>
                ) : null}
                {user?.customerEntityId ? (
                  <div>
                    <p className="text-xs text-muted-foreground">{t("settingsPage.customerProfile")}</p>
                    <p className="text-xs font-medium">{t("settingsPage.customerProfileLinked")}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  {t("settingsPage.security")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">{t("settingsPage.currentPassword")}</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder={t("settingsPage.currentPasswordPlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">{t("settingsPage.newPassword")}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder={t("settingsPage.newPasswordPlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">{t("settingsPage.confirmNewPassword")}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={t("settingsPage.confirmNewPasswordPlaceholder")}
                  />
                </div>
                <Button onClick={submitPasswordChange} disabled={isChangingPassword} className="w-full">
                  {isChangingPassword
                    ? t("settingsPage.changingPassword")
                    : t("settingsPage.changePassword")}
                </Button>
                <Separator />
                <Button
                  variant="outline"
                  onClick={() => router.push(roleToDashboardPath(role))}
                  className="w-full"
                >
                  {t("settingsPage.backToDashboard")}
                </Button>
                <Button variant="destructive" onClick={logout} className="w-full">
                  {t("common.logout")}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 bg-muted/20">
              <CardContent className="p-4 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{t("settingsPage.localStorageHint")}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
