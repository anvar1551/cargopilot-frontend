"use client";

import { useEffect, useState, useRef } from "react";
import { requestLogin, type MembershipChoice } from "@/lib/session-contract";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  hasActiveSession,
  saveAuth,
  dashboardPathForUser,
  AuthUser,
  getUser,
  authEpoch,
} from "@/lib/auth";
import { toast } from "sonner";
import { postLoginDestination } from "@/lib/acceptance-corrections";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, ShieldCheck, Truck } from "lucide-react";

type LoginResponse = {
  token: string;
  refreshToken?: string;
  accessTokenExpiresInSec?: number;
  user: AuthUser | Record<string, unknown>;
};

function extractErrorMessage(err: unknown) {
  if (!err || typeof err !== "object") return "Login failed";
  const maybe = err as {
    response?: { data?: { error?: string; message?: string } };
    message?: string;
  };
  return (
    maybe.response?.data?.error ||
    maybe.response?.data?.message ||
    maybe.message ||
    "Login failed"
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [choices, setChoices] = useState<MembershipChoice[]>([]);
  const [selected, setSelected] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!hasActiveSession()) return;
    const user = getUser();
    if (!user) return;
    const next = searchParams.get("next");
    router.replace(postLoginDestination(user, next, dashboardPathForUser(user)));
  }, [router, searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    if (choices.length && !selected) { toast.error("Choose your company membership"); return; }
    busy.current = true;
    const epoch = authEpoch();
    setIsSubmitting(true);

    try {
      const result = await requestLogin((path, body) => api.post<LoginResponse>(path, body), { email, password }, choices, selected || undefined);
      if (!mounted.current || epoch !== authEpoch()) return;
      if (result.choices) { setChoices(result.choices); setSelected(""); return; }
      const { token, refreshToken, user } = result.session!;

      saveAuth(token, user, {
        refreshToken, expectedEpoch: epoch,
      });

      toast.success("Logged in successfully");

      const next = searchParams.get("next");
      const storedUser = getUser();
      setPassword(""); setChoices([]);
      router.replace(postLoginDestination(storedUser, next, dashboardPathForUser(storedUser)));
    } catch (err: unknown) {
      if (mounted.current) { setPassword(""); setChoices([]); setSelected(""); toast.error(extractErrorMessage(err)); }
    } finally {
      busy.current = false;
      if (mounted.current) setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-20 h-72 w-72 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,23,42,0.04),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(14,116,144,0.08),transparent_50%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center gap-6 lg:justify-between">
        <div className="hidden max-w-md space-y-4 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure access
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            CargoPilot Control Desk
          </h1>
          <p className="text-sm text-slate-600">
            Sign in to manage dispatch, warehouse flows, and live shipment tracking.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <Truck className="h-4 w-4" />
              Unified logistics workspace
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Role-based access, status orchestration, and parcel-level visibility.
            </p>
          </div>
        </div>

        <Card className="w-full max-w-md border-slate-200 bg-white/90 shadow-xl backdrop-blur">
          <CardHeader className="space-y-2 pb-2">
            <CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle>
            <p className="text-sm text-muted-foreground">
              Use your company credentials to continue.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    disabled={isSubmitting}
                    onChange={(e) => { setEmail(e.target.value); setChoices([]); setSelected(""); }}
                    placeholder="you@company.com"
                    className="h-11 pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    disabled={isSubmitting}
                    onChange={(e) => { setPassword(e.target.value); setChoices([]); setSelected(""); }}
                    placeholder="Enter your password"
                    className="h-11 pl-10"
                    required
                  />
                </div>
              </div>

              {choices.length > 0 && <div className="space-y-2">
                <Label htmlFor="membership">Choose tenant and company</Label>
                <select id="membership" className="w-full rounded border p-2" value={selected} disabled={isSubmitting} onChange={e => setSelected(e.target.value)}>
                  <option value="">Select a membership</option>
                  {choices.map(choice => <option key={choice.companyMembershipId} value={choice.companyMembershipId}>{choice.tenantName} / {choice.companyName}</option>)}
                </select>
                <p className="text-sm">Changing context requires logout and a fresh login.</p>
              </div>}
              <Button className="h-11 w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
