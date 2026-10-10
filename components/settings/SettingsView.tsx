"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  BellRing,
  Building2,
  Database,
  FileText,
  Globe2,
  KeyRound,
  Languages,
  Lock,
  LogOut,
  Palette,
  RefreshCw,
  Save,
  Settings2,
  Shield,
  SlidersHorizontal,
  Truck,
  UserCircle2,
  Workflow,
} from "lucide-react";

import { clearAuth, getUser, hasPermission, type Role } from "@/lib/auth";
import { fetchManagerOpsMetrics, type ManagerOpsMetrics } from "@/lib/manager";
import { fetchOrganizations } from "@/lib/organizations";
import { useRealtimeFallbackInterval } from "@/lib/use-realtime-fallback";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function equalSettings(a: UserSettings, b: UserSettings) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatPercent(value: number | null | undefined) {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(Number(value) * 100)}%`;
}

function formatMs(value: number | null | undefined) {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(Number(value))} ms`;
}

function formatShortRef(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Not attached";
  if (normalized.length <= 12) return normalized;
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function formatRoleLabel(roleCodes: string[] | null | undefined) {
  const codes = Array.isArray(roleCodes) ? roleCodes.filter(Boolean) : [];
  if (codes.length === 0) return "Workspace member";
  return codes
    .slice(0, 2)
    .map((code) =>
      code
        .split(/[_\-\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    )
    .join(" + ");
}

function statusBadge(status: "active" | "ready" | "planned" | "warning") {
  const styles = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ready: "border-cyan-200 bg-cyan-50 text-cyan-700",
    planned: "border-slate-200 bg-slate-50 text-slate-600",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
  } satisfies Record<typeof status, string>;

  return styles[status];
}

function SettingTile({
  icon: Icon,
  title,
  value,
  hint,
  status = "ready",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  hint: string;
  status?: "active" | "ready" | "planned" | "warning";
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-black/5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-950">{title}</p>
            <Badge
              variant="outline"
              className={`rounded-full ${statusBadge(status)}`}
            >
              {status === "planned" ? "API needed" : status}
            </Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-sm text-slate-500">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function PolicyRow({
  title,
  description,
  enabled,
  badge,
  onCheckedChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  badge?: string;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-950">{title}</p>
          {badge ? (
            <Badge variant="outline" className="rounded-full">
              {badge}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <Switch
        checked={enabled}
        disabled={!onCheckedChange}
        onCheckedChange={onCheckedChange}
        aria-label={title}
      />
    </div>
  );
}

function OpsHealthPanel({ data }: { data?: ManagerOpsMetrics }) {
  const redisOk =
    data?.redis?.enabled && data.redis.sharedClientStatus === "ready";
  const workerOk = data
    ? !data.alerts.workerLagHigh && data.worker.errorCount === 0
    : false;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SettingTile
        icon={Database}
        title="Redis and cache"
        value={data?.redis?.sharedClientStatus ?? "Not loaded"}
        hint={`Analytics cache hit ratio ${formatPercent(data?.analytics.totals.cacheHitRatio)}`}
        status={redisOk ? "active" : data ? "warning" : "planned"}
      />
      <SettingTile
        icon={Workflow}
        title="Worker pipeline"
        value={data ? `${data.worker.eventsConsumed} events` : "Not loaded"}
        hint={`Last lag ${formatMs(data?.worker.lastLagMs)}. Errors ${data?.worker.errorCount ?? "-"}`}
        status={workerOk ? "active" : data ? "warning" : "planned"}
      />
      <SettingTile
        icon={Activity}
        title="Analytics read model"
        value={formatMs(data?.analytics.summary.p95Ms)}
        hint="Summary p95 latency from the operational dashboard cache."
        status={
          data?.alerts.summaryP95Slow ? "warning" : data ? "active" : "planned"
        }
      />
      <SettingTile
        icon={RefreshCw}
        title="Realtime channels"
        value={`${data?.sse.analytics.active ?? 0} analytics / ${data?.sse.liveMap.active ?? 0} map`}
        hint="Active SSE clients currently connected to backend streams."
        status={data ? "active" : "planned"}
      />
    </div>
  );
}
function PersonalWorkspaceSettings({
  settings,
  setSettings,
}: {
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Workspace preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>UI density</Label>
              <Select
                value={settings.uiDensity}
                onValueChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    uiDensity: value as UserSettings["uiDensity"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Realtime fallback refresh</Label>
              <Select
                value={settings.autoRefreshSec}
                onValueChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    autoRefreshSec: value as UserSettings["autoRefreshSec"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Used only when SSE/Redis realtime is disconnected.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 px-4 py-3">
            <LanguageSwitcher showLabel />
            <p className="mt-2 text-xs text-slate-500">
              Applies to dashboard labels and operational screens where
              translations are available.
            </p>
          </div>

          <PolicyRow
            title="Play scan sound"
            description="Use audio feedback after successful scan actions."
            enabled={settings.playScanSound}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, playScanSound: checked }))
            }
          />
          <PolicyRow
            title="Confirm bulk apply"
            description="Ask before bulk status or assignment actions are submitted."
            enabled={settings.confirmBulkApply}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, confirmBulkApply: checked }))
            }
          />
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4" />
            Personal notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
            <div>
              <p className="font-medium text-slate-950">Shipment exceptions</p>
              <p className="text-sm text-slate-500">
                Notify me when an order needs manual attention.
              </p>
            </div>
            <Switch
              checked={settings.notifyExceptions}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, notifyExceptions: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
            <div>
              <p className="font-medium text-slate-950">Delivery movement</p>
              <p className="text-sm text-slate-500">
                Notify me about key pickup and delivery updates.
              </p>
            </div>
            <Switch
              checked={settings.notifyDelivery}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, notifyDelivery: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
            <div>
              <p className="font-medium text-slate-950">Payments</p>
              <p className="text-sm text-slate-500">
                Notify me about paid, failed, and overdue payment events.
              </p>
            </div>
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
  );
}

function AccountSecurity({
  currentPassword,
  newPassword,
  confirmPassword,
  isChangingPassword,
  setCurrentPassword,
  setNewPassword,
  setConfirmPassword,
  onSubmit,
  onLogout,
}: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  isChangingPassword: boolean;
  setCurrentPassword: (value: string) => void;
  setNewPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  onSubmit: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Change password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Current password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <Button
            onClick={onSubmit}
            disabled={isChangingPassword}
            className="gap-2"
          >
            <Lock className="h-4 w-4" />
            {isChangingPassword ? "Updating..." : "Update password"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle2 className="h-4 w-4" />
            Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-500">
            Sign out clears the current browser token and returns this device to
            the login screen.
          </p>
          <Button
            variant="outline"
            onClick={onLogout}
            className="w-full justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
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
  const [settings, setSettings] = React.useState<UserSettings>(
    DEFAULT_USER_SETTINGS,
  );
  const [initialSettings, setInitialSettings] = React.useState<UserSettings>(
    DEFAULT_USER_SETTINGS,
  );
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  const isAdminSettings = role === "manager";
  const diagnosticsFallbackInterval = useRealtimeFallbackInterval({
    isPageVisible: true,
    realtimeConnected: false,
  });
  const canViewOpsDiagnostics =
    isAdminSettings &&
    (hasPermission(user, "audit.read") ||
      hasPermission(user, "finance.viewLedger"));

  const opsMetricsQuery = useQuery({
    queryKey: ["manager-ops-metrics", "settings"],
    queryFn: fetchManagerOpsMetrics,
    enabled: canViewOpsDiagnostics,
    staleTime: 45_000,
    refetchInterval: diagnosticsFallbackInterval,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const companiesQuery = useQuery({
    queryKey: ["settings-company-scope", user?.companyId],
    queryFn: () =>
      fetchOrganizations({
        type: "company",
        isActive: true,
        page: 1,
        limit: 100,
      }),
    enabled: isAdminSettings && Boolean(user?.companyId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    const loaded = loadUserSettings();
    setSettings(loaded);
    setInitialSettings(loaded);
  }, []);

  const hasChanges = !equalSettings(settings, initialSettings);
  const companyId = user?.companyId ?? null;
  const membershipId = user?.membershipId ?? null;
  const company = companiesQuery.data?.data.find((item) => item.id === companyId);
  const companyDisplayName =
    company?.name ??
    (companiesQuery.isLoading
      ? "Loading company..."
      : companyId
        ? "Current company"
        : "Company scope not attached");
  const companyCode = company?.code ?? formatShortRef(companyId);
  const accessProfileLabel = formatRoleLabel(user?.roleCodes);

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
      toast.success(result.message || "Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: unknown } } }).response
          ?.data?.error === "string"
          ? (error as { response?: { data?: { error?: string } } }).response
              ?.data?.error
          : t("settingsPage.passwordUpdateFailed");
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const pageTitle =
    title ?? (isAdminSettings ? "ERP Settings" : "Workspace Settings");
  const pageSubtitle = isAdminSettings
    ? "Company defaults, operational guardrails, localization, documents, security, notifications, and system health."
    : "Personal workspace preferences, notifications, language, password, and session settings.";

  if (!isAdminSettings) {
    return (
      <PageShell>
        <div className="space-y-6">
          <Card className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(135deg,#0f172a,#1e293b,#0e7490)] text-white shadow-sm shadow-black/10">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
            <CardContent className="relative p-6 lg:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                    <Settings2 className="h-6 w-6" />
                  </div>
                  <h1 className="mt-5 text-3xl font-semibold tracking-tight">
                    {pageTitle}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-slate-100/80">
                    {pageSubtitle}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={reset}>
                    Reset
                  </Button>
                  <Button
                    onClick={save}
                    disabled={!hasChanges}
                    className="gap-2 bg-white text-slate-950 hover:bg-slate-100"
                  >
                    <Save className="h-4 w-4" />
                    Save preferences
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <PersonalWorkspaceSettings
            settings={settings}
            setSettings={setSettings}
          />
          <AccountSecurity
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            isChangingPassword={isChangingPassword}
            setCurrentPassword={setCurrentPassword}
            setNewPassword={setNewPassword}
            setConfirmPassword={setConfirmPassword}
            onSubmit={submitPasswordChange}
            onLogout={logout}
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_85%_10%,rgba(34,211,238,0.22),transparent_35%),linear-gradient(135deg,#0f172a,#1e293b_48%,#0e7490)] text-white shadow-sm shadow-black/10">
          <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-sky-300/10 blur-3xl" />
          <CardContent className="relative p-6 lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner shadow-white/10">
                  <Settings2 className="h-7 w-7" />
                </div>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight lg:text-4xl">
                  {pageTitle}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-100/85">
                  {pageSubtitle}
                </p>
              </div>
              <div className="grid min-w-[280px] gap-3 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur md:grid-cols-2 xl:grid-cols-1">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                    Company scope
                  </p>
                  <p className="mt-1 truncate font-semibold">{companyDisplayName}</p>
                  <p className="mt-0.5 truncate text-xs text-white/55">
                    {company?.code ? `Code ${company.code}` : `Ref ${companyCode}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                    Access profile
                  </p>
                  <p className="mt-1 truncate font-semibold">{accessProfileLabel}</p>
                  <p className="mt-0.5 truncate text-xs text-white/55">
                    Ref {formatShortRef(membershipId)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SettingTile
            icon={Building2}
            title="Company defaults"
            value="UZS / USD / CNY"
            hint="Primary currencies and organization profile baseline."
            status="ready"
          />
          <SettingTile
            icon={Truck}
            title="Operations"
            value="Cash first"
            hint="Default payment type, delivery payer, label and carrier policy."
            status="ready"
          />
          <SettingTile
            icon={Shield}
            title="Security posture"
            value="RBAC enforced"
            hint="Roles, permissions, audit, and session controls."
            status="active"
          />
          <SettingTile
            icon={Activity}
            title="System health"
            value={opsMetricsQuery.data?.redis?.sharedClientStatus ?? "Live"}
            hint="Redis, workers, analytics cache, and realtime channels."
            status={
              opsMetricsQuery.data?.redis?.sharedClientStatus === "ready"
                ? "active"
                : "ready"
            }
          />
        </div>

        <Tabs defaultValue="company" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm shadow-black/5 md:grid-cols-4 xl:grid-cols-8">
            {[
              ["company", "Company"],
              ["operations", "Operations"],
              ["localization", "Localization"],
              ["documents", "Documents"],
              ["security", "Security"],
              ["notifications", "Notifications"],
              ["health", "Health"],
              ["personal", "Personal"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-xl py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="company" className="space-y-4">
            <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
              <CardContent className="space-y-5 p-5 lg:p-6">
                <SectionHeader
                  icon={Building2}
                  title="Company profile"
                  description="Legal identity and operational home company. Provider, pricing, RBAC, and audit records attach to this company scope."
                />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <ReadOnlyField
                    label="Display name"
                    value={companyDisplayName}
                    hint={company?.code ? `Organization code ${company.code}` : "Resolved from organization directory."}
                  />
                  <ReadOnlyField
                    label="Legal country"
                    value="Uzbekistan"
                    hint="Default launch market."
                  />
                  <ReadOnlyField
                    label="Timezone"
                    value="Asia/Tashkent"
                    hint="Operational SLA and cutoff basis."
                  />
                  <ReadOnlyField
                    label="Branding"
                    value="Logo configured"
                    hint="Browser and sidebar assets loaded."
                  />
                </div>
                <div className="rounded-3xl border border-dashed border-cyan-200 bg-cyan-50/70 p-4 text-sm text-cyan-900">
                  Server persistence for company profile should be added as a
                  small settings-core endpoint. For now this page displays the
                  ERP structure without pretending to save company master data.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operations" className="space-y-4">
            <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
              <CardContent className="space-y-5 p-5 lg:p-6">
                <SectionHeader
                  icon={SlidersHorizontal}
                  title="Operational defaults"
                  description="Defaults that shape order creation and exception handling. These should later become server-backed company settings."
                />
                <div className="grid gap-3 lg:grid-cols-2">
                  <PolicyRow
                    title="Default payment type: cash"
                    description="Order creation starts with cash unless the operator selects card or provider checkout."
                    enabled
                    badge="current default"
                  />
                  <PolicyRow
                    title="Delivery charged by sender"
                    description="New orders default to sender-paid delivery charge."
                    enabled
                    badge="current default"
                  />
                  <PolicyRow
                    title="Recipient unavailable: call sender"
                    description="Exception flow asks operations to call sender first when recipient cannot receive."
                    enabled
                    badge="current default"
                  />
                  <PolicyRow
                    title="Service charge unpaid by default"
                    description="Service charge starts unpaid until cash collection or online payment confirmation."
                    enabled
                    badge="current default"
                  />
                  <PolicyRow
                    title="Auto-create labels"
                    description="Label worker creates documents asynchronously after eligible order creation."
                    enabled
                    badge="worker"
                  />
                  <PolicyRow
                    title="Auto-book carriers by rule"
                    description="Carrier rules can book matching route legs without manual order-by-order action."
                    enabled
                    badge="integrations"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="localization" className="space-y-4">
            <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
              <CardContent className="space-y-5 p-5 lg:p-6">
                <SectionHeader
                  icon={Globe2}
                  title="Localization and currency"
                  description="Currency, language, time, and measurement defaults used across pricing, analytics, documents, and operations."
                />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <ReadOnlyField
                    label="Enabled currencies"
                    value="UZS, USD, CNY"
                    hint="Matches current ERP architecture."
                  />
                  <ReadOnlyField
                    label="Default currency"
                    value="UZS"
                    hint="Domestic Uzbekistan operations."
                  />
                  <ReadOnlyField
                    label="Weight unit"
                    value="Kilogram"
                    hint="Pricing uses kg buckets."
                  />
                  <ReadOnlyField
                    label="Distance unit"
                    value="Kilometer"
                    hint="Routing and maps use metric units."
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
                    <Languages className="h-4 w-4" />
                    Personal language override
                  </div>
                  <LanguageSwitcher showLabel />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
              <CardContent className="space-y-5 p-5 lg:p-6">
                <SectionHeader
                  icon={FileText}
                  title="Documents and numbering"
                  description="Label, invoice, order numbering, and PDF defaults. Generation stays asynchronous through workers."
                />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <ReadOnlyField
                    label="Order number format"
                    value="#990000000001"
                    hint="Sequential business number for humans."
                  />
                  <ReadOnlyField
                    label="Label generation"
                    value="Async worker"
                    hint="Safe fallback if worker is down."
                  />
                  <ReadOnlyField
                    label="Invoice currency"
                    value="Order currency"
                    hint="USD orders remain USD, UZS orders remain UZS."
                  />
                  <ReadOnlyField
                    label="Document storage"
                    value="S3 aware"
                    hint="Order delete cleanup removes generated labels."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
              <CardContent className="space-y-5 p-5 lg:p-6">
                <SectionHeader
                  icon={Shield}
                  title="Security and compliance"
                  description="RBAC, auditability, sessions, webhook verification, and sensitive provider secret handling."
                />
                <div className="grid gap-3 lg:grid-cols-2">
                  <PolicyRow
                    title="RBAC permission checks"
                    description="Access is permission and scope based, not hardcoded legacy roles."
                    enabled
                    badge="active"
                  />
                  <PolicyRow
                    title="Provider secret encryption"
                    description="Payment and integration credentials are encrypted before storage."
                    enabled
                    badge="active"
                  />
                  <PolicyRow
                    title="Webhook HMAC verification"
                    description="Carrier and payment callbacks require provider-specific signature verification."
                    enabled
                    badge="active"
                  />
                  <PolicyRow
                    title="Audit log retention policy"
                    description="Retention duration should be persisted in settings-core before publish."
                    enabled={false}
                    badge="API needed"
                  />
                </div>
                <Separator />
                <AccountSecurity
                  currentPassword={currentPassword}
                  newPassword={newPassword}
                  confirmPassword={confirmPassword}
                  isChangingPassword={isChangingPassword}
                  setCurrentPassword={setCurrentPassword}
                  setNewPassword={setNewPassword}
                  setConfirmPassword={setConfirmPassword}
                  onSubmit={submitPasswordChange}
                  onLogout={logout}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
              <CardContent className="space-y-5 p-5 lg:p-6">
                <SectionHeader
                  icon={BellRing}
                  title="Notification rules"
                  description="ERP events that should notify support, customers, drivers, finance, and operations. Provider wiring belongs to integrations."
                />
                <div className="grid gap-3 lg:grid-cols-2">
                  <PolicyRow
                    title="Support ticket assignment"
                    description="Notify queue owners when a new ticket is assigned or escalated."
                    enabled
                    badge="support"
                  />
                  <PolicyRow
                    title="Payment status changes"
                    description="Notify finance and customer after paid, failed, refunded, or expired payment states."
                    enabled
                    badge="payments"
                  />
                  <PolicyRow
                    title="Driver assignment"
                    description="Notify driver app when an order or route leg is assigned."
                    enabled
                    badge="driver app"
                  />
                  <PolicyRow
                    title="Customer tracking"
                    description="Notify customer on pickup, in transit, out for delivery, delivered, or exception."
                    enabled={false}
                    badge="provider needed"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
              <CardContent className="space-y-5 p-5 lg:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <SectionHeader
                    icon={Activity}
                    title="System health"
                    description="Read-only production diagnostics for Redis, analytics cache, workers, and realtime channels."
                  />
                  <Button
                    variant="outline"
                    onClick={() => opsMetricsQuery.refetch()}
                    disabled={
                      !canViewOpsDiagnostics || opsMetricsQuery.isFetching
                    }
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                {!canViewOpsDiagnostics ? (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    You need audit or finance-ledger permission to view system
                    diagnostics.
                  </div>
                ) : opsMetricsQuery.isError ? (
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    Failed to load operational diagnostics.
                  </div>
                ) : (
                  <OpsHealthPanel data={opsMetricsQuery.data} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="personal" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-black/5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Personal preferences
                </h2>
                <p className="text-sm text-slate-500">
                  These preferences are stored locally in this browser.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={reset}>
                  Reset
                </Button>
                <Button onClick={save} disabled={!hasChanges} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save preferences
                </Button>
              </div>
            </div>
            <PersonalWorkspaceSettings
              settings={settings}
              setSettings={setSettings}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
