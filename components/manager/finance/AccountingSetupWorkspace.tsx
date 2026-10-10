"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookCopy,
  CalendarRange,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  FinanceEmptyState,
  FinancePager,
  FinanceStatusBadge,
  financeErrorMessage,
  formatDate,
} from "@/components/manager/finance/finance-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  bootstrapFinanceAccounts,
  changeFinancePeriodStatus,
  configureFinanceLegalEntity,
  createFinanceAccount,
  createFinancePeriod,
  getFinanceLegalEntity,
  listFinanceAccounts,
  listFinancePeriods,
  type FinanceAccountType,
  type FinanceCurrency,
  type FiscalPeriodStatus,
} from "@/lib/finance";
import { hasPermission, type AuthUser } from "@/lib/auth";

const CURRENCIES: FinanceCurrency[] = ["UZS", "USD", "CNY"];
const ACCOUNT_TYPES: FinanceAccountType[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
];

function pageCursor(stack: Array<string | undefined>, page: number) {
  return stack[Math.max(page - 1, 0)];
}

export default function AccountingSetupWorkspace({
  user,
}: {
  user: AuthUser | null;
}) {
  const client = useQueryClient();
  const canSettingsRead = hasPermission(user, "finance.settings.read");
  const canSettingsManage = hasPermission(user, "finance.settings.manage");
  const canAccountsRead = hasPermission(user, "finance.accounts.read");
  const canAccountsManage = hasPermission(user, "finance.accounts.manage");
  const canPeriodsRead = hasPermission(user, "finance.periods.read");
  const canPeriodsManage = hasPermission(user, "finance.periods.manage");
  const canPeriodsClose = hasPermission(user, "finance.periods.close");
  const initialTab = canSettingsRead
    ? "entity"
    : canAccountsRead
      ? "accounts"
      : "periods";

  const [entityOpen, setEntityOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [accountPage, setAccountPage] = useState(1);
  const [accountCursors, setAccountCursors] = useState<
    Array<string | undefined>
  >([undefined]);
  const [periodPage, setPeriodPage] = useState(1);
  const [periodCursors, setPeriodCursors] = useState<Array<string | undefined>>(
    [undefined],
  );

  const entity = useQuery({
    queryKey: ["finance", "entity"],
    queryFn: getFinanceLegalEntity,
    enabled: canSettingsRead,
    retry: false,
  });
  const accounts = useQuery({
    queryKey: [
      "finance",
      "accounts",
      accountPage,
      pageCursor(accountCursors, accountPage),
    ],
    queryFn: () =>
      listFinanceAccounts({
        cursor: pageCursor(accountCursors, accountPage),
        limit: 25,
      }),
    enabled: canAccountsRead,
  });
  const periods = useQuery({
    queryKey: [
      "finance",
      "periods",
      periodPage,
      pageCursor(periodCursors, periodPage),
    ],
    queryFn: () =>
      listFinancePeriods({
        cursor: pageCursor(periodCursors, periodPage),
        limit: 25,
      }),
    enabled: canPeriodsRead,
  });

  const [entityForm, setEntityForm] = useState({
    baseCurrency: "UZS" as FinanceCurrency,
    reportingCurrency: "UZS" as FinanceCurrency,
    fiscalYearStartMonth: "1",
    timezone: "Asia/Tashkent",
  });
  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    type: "asset" as FinanceAccountType,
    parentId: "none",
    allowPosting: true,
    isControlAccount: false,
    currency: "none",
    description: "",
  });
  const [periodForm, setPeriodForm] = useState({
    fiscalYear: String(new Date().getFullYear()),
    periodNumber: "1",
    name: "",
    startDate: "",
    endDate: "",
  });

  const accountOptions = useMemo(
    () => accounts.data?.items ?? [],
    [accounts.data],
  );

  const saveEntity = useMutation({
    mutationFn: () =>
      configureFinanceLegalEntity({
        baseCurrency: entityForm.baseCurrency,
        reportingCurrency: entityForm.reportingCurrency,
        fiscalYearStartMonth: Number(entityForm.fiscalYearStartMonth),
        timezone: entityForm.timezone.trim(),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance"] });
      setEntityOpen(false);
      toast.success("Finance legal entity configured");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not configure finance")),
  });

  const bootstrap = useMutation({
    mutationFn: bootstrapFinanceAccounts,
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["finance", "accounts"] });
      toast.success(
        result.idempotent
          ? "Standard chart was already installed"
          : "Standard logistics chart installed",
      );
    },
    onError: (error) =>
      toast.error(
        financeErrorMessage(error, "Could not install chart of accounts"),
      ),
  });

  const addAccount = useMutation({
    mutationFn: () =>
      createFinanceAccount({
        code: accountForm.code.trim(),
        name: accountForm.name.trim(),
        type: accountForm.type,
        parentId: accountForm.parentId === "none" ? null : accountForm.parentId,
        allowPosting: accountForm.allowPosting,
        isControlAccount: accountForm.isControlAccount,
        currency:
          accountForm.currency === "none"
            ? null
            : (accountForm.currency as FinanceCurrency),
        description: accountForm.description.trim() || null,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "accounts"] });
      setAccountOpen(false);
      setAccountForm({
        code: "",
        name: "",
        type: "asset",
        parentId: "none",
        allowPosting: true,
        isControlAccount: false,
        currency: "none",
        description: "",
      });
      toast.success("Ledger account created");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not create account")),
  });

  const addPeriod = useMutation({
    mutationFn: () =>
      createFinancePeriod({
        fiscalYear: Number(periodForm.fiscalYear),
        periodNumber: Number(periodForm.periodNumber),
        name: periodForm.name.trim(),
        startDate: periodForm.startDate,
        endDate: periodForm.endDate,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "periods"] });
      setPeriodOpen(false);
      toast.success("Fiscal period created");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not create period")),
  });

  const updatePeriod = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FiscalPeriodStatus }) =>
      changeFinancePeriodStatus(id, status),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "periods"] });
      toast.success("Fiscal period status updated");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not update period")),
  });

  const openEntityDialog = () => {
    if (entity.data) {
      setEntityForm({
        baseCurrency: entity.data.baseCurrency,
        reportingCurrency:
          entity.data.reportingCurrency ?? entity.data.baseCurrency,
        fiscalYearStartMonth: String(entity.data.fiscalYearStartMonth),
        timezone: entity.data.timezone,
      });
    }
    setEntityOpen(true);
  };

  const goAccountNext = () => {
    const next = accounts.data?.pageInfo.nextCursor;
    if (!next) return;
    setAccountCursors((current) => {
      const copy = [...current];
      copy[accountPage] = next;
      return copy;
    });
    setAccountPage((value) => value + 1);
  };
  const goPeriodNext = () => {
    const next = periods.data?.pageInfo.nextCursor;
    if (!next) return;
    setPeriodCursors((current) => {
      const copy = [...current];
      copy[periodPage] = next;
      return copy;
    });
    setPeriodPage((value) => value + 1);
  };

  return (
    <Tabs defaultValue={initialTab} className="space-y-4">
      <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl border bg-white p-1.5">
        {canSettingsRead ? (
          <TabsTrigger
            value="entity"
            className="h-10 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            <Landmark /> Legal entity
          </TabsTrigger>
        ) : null}
        {canAccountsRead ? (
          <TabsTrigger
            value="accounts"
            className="h-10 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            <BookCopy /> Accounts
          </TabsTrigger>
        ) : null}
        {canPeriodsRead ? (
          <TabsTrigger
            value="periods"
            className="h-10 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            <CalendarRange /> Fiscal periods
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="entity">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Legal accounting entity</CardTitle>
              <CardDescription>
                Controls base currency, reporting currency, fiscal calendar, and
                posting timezone.
              </CardDescription>
            </div>
            {canSettingsManage ? (
              <Button onClick={openEntityDialog}>
                {entity.data ? "Edit configuration" : "Configure finance"}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {entity.isLoading ? (
              <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
            ) : entity.data ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Base currency
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {entity.data.baseCurrency}
                  </p>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Reporting currency
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {entity.data.reportingCurrency ?? entity.data.baseCurrency}
                  </p>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Fiscal year starts
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    Month {entity.data.fiscalYearStartMonth}
                  </p>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Posting timezone
                  </p>
                  <p className="mt-2 text-lg font-bold">
                    {entity.data.timezone}
                  </p>
                </div>
              </div>
            ) : (
              <FinanceEmptyState
                title="Finance is not configured"
                description="Create the company legal accounting entity before installing accounts or posting journals."
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="accounts">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Chart of accounts</CardTitle>
              <CardDescription>
                Operational ledger structure used by posting rules and manual
                journals.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void accounts.refetch()}>
                <RefreshCw /> Refresh
              </Button>
              {canAccountsManage ? (
                <Button
                  variant="outline"
                  onClick={() => bootstrap.mutate()}
                  disabled={bootstrap.isPending}
                >
                  <Sparkles /> Install standard chart
                </Button>
              ) : null}
              {canAccountsManage ? (
                <Button onClick={() => setAccountOpen(true)}>
                  <Plus /> Add account
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {accounts.data?.items.length ? (
              <div className="overflow-hidden rounded-2xl border">
                <div className="max-h-[520px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-white">
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Parent</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Controls</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.data.items.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-mono font-semibold">
                            {account.code}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{account.name}</p>
                            {account.description ? (
                              <p className="text-xs text-slate-500">
                                {account.description}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="capitalize">
                            {account.type}
                          </TableCell>
                          <TableCell>
                            {account.parent
                              ? `${account.parent.code} ${account.parent.name}`
                              : "-"}
                          </TableCell>
                          <TableCell>{account.currency ?? "Any"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {account.isControlAccount ? (
                                <Badge variant="secondary">Control</Badge>
                              ) : null}
                              <Badge variant="outline">
                                {account.allowPosting ? "Postable" : "Header"}
                              </Badge>
                              <FinanceStatusBadge status={account.status} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="px-4 pb-4">
                  <FinancePager
                    page={accountPage}
                    canPrevious={accountPage > 1}
                    canNext={Boolean(accounts.data.pageInfo.hasMore)}
                    onPrevious={() => setAccountPage((value) => value - 1)}
                    onNext={goAccountNext}
                  />
                </div>
              </div>
            ) : (
              <FinanceEmptyState
                title="No ledger accounts"
                description="Install the standard logistics chart or create a controlled custom account."
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="periods">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Fiscal periods</CardTitle>
              <CardDescription>
                Only open periods accept postings. Closing a period protects the
                audit trail.
              </CardDescription>
            </div>
            {canPeriodsManage ? (
              <Button onClick={() => setPeriodOpen(true)}>
                <Plus /> Add period
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {periods.data?.items.length ? (
              <div className="overflow-hidden rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Closed</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.data.items.map((period) => (
                      <TableRow key={period.id}>
                        <TableCell>
                          <p className="font-semibold">{period.name}</p>
                          <p className="text-xs text-slate-500">
                            FY {period.fiscalYear} / P{period.periodNumber}
                          </p>
                        </TableCell>
                        <TableCell>
                          {formatDate(period.startDate)} -{" "}
                          {formatDate(period.endDate)}
                        </TableCell>
                        <TableCell>
                          <FinanceStatusBadge status={period.status} />
                        </TableCell>
                        <TableCell>
                          {formatDate(period.closedAt, true)}
                        </TableCell>
                        <TableCell className="text-right">
                          {canPeriodsClose ? (
                            <Select
                              value={period.status}
                              onValueChange={(status) =>
                                updatePeriod.mutate({
                                  id: period.id,
                                  status: status as FiscalPeriodStatus,
                                })
                              }
                            >
                              <SelectTrigger className="ml-auto w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="restricted">
                                  Restricted
                                </SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="px-4 pb-4">
                  <FinancePager
                    page={periodPage}
                    canPrevious={periodPage > 1}
                    canNext={Boolean(periods.data.pageInfo.hasMore)}
                    onPrevious={() => setPeriodPage((value) => value - 1)}
                    onNext={goPeriodNext}
                  />
                </div>
              </div>
            ) : (
              <FinanceEmptyState
                title="No fiscal periods"
                description="Create at least one open period before posting operational or manual journals."
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <Dialog open={entityOpen} onOpenChange={setEntityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure legal entity</DialogTitle>
            <DialogDescription>
              These settings establish the accounting boundary for this company.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Base currency</Label>
              <Select
                value={entityForm.baseCurrency}
                onValueChange={(value) =>
                  setEntityForm((form) => ({
                    ...form,
                    baseCurrency: value as FinanceCurrency,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reporting currency</Label>
              <Select
                value={entityForm.reportingCurrency}
                onValueChange={(value) =>
                  setEntityForm((form) => ({
                    ...form,
                    reportingCurrency: value as FinanceCurrency,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fiscal year start month</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={entityForm.fiscalYearStartMonth}
                onChange={(event) =>
                  setEntityForm((form) => ({
                    ...form,
                    fiscalYearStartMonth: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input
                value={entityForm.timezone}
                onChange={(event) =>
                  setEntityForm((form) => ({
                    ...form,
                    timezone: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntityOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveEntity.mutate()}
              disabled={saveEntity.isPending || !entityForm.timezone.trim()}
            >
              {saveEntity.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}{" "}
              Save configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create ledger account</DialogTitle>
            <DialogDescription>
              Add a postable or structural account to the current chart.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Account code</Label>
              <Input
                value={accountForm.code}
                onChange={(event) =>
                  setAccountForm((form) => ({
                    ...form,
                    code: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={accountForm.name}
                onChange={(event) =>
                  setAccountForm((form) => ({
                    ...form,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={accountForm.type}
                onValueChange={(value) =>
                  setAccountForm((form) => ({
                    ...form,
                    type: value as FinanceAccountType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parent account</Label>
              <Select
                value={accountForm.parentId}
                onValueChange={(value) =>
                  setAccountForm((form) => ({ ...form, parentId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent</SelectItem>
                  {accountOptions.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency restriction</Label>
              <Select
                value={accountForm.currency}
                onValueChange={(value) =>
                  setAccountForm((form) => ({ ...form, currency: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any currency</SelectItem>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={accountForm.description}
                onChange={(event) =>
                  setAccountForm((form) => ({
                    ...form,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl border p-3">
              <Checkbox
                checked={accountForm.allowPosting}
                onCheckedChange={(checked) =>
                  setAccountForm((form) => ({
                    ...form,
                    allowPosting: checked === true,
                  }))
                }
              />
              <span>
                <strong className="block text-sm">Allow posting</strong>
                <span className="text-xs text-slate-500">
                  Journal lines may target this account.
                </span>
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-xl border p-3">
              <Checkbox
                checked={accountForm.isControlAccount}
                onCheckedChange={(checked) =>
                  setAccountForm((form) => ({
                    ...form,
                    isControlAccount: checked === true,
                  }))
                }
              />
              <span>
                <strong className="block text-sm">Control account</strong>
                <span className="text-xs text-slate-500">
                  Reserved for automated subledger posting.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addAccount.mutate()}
              disabled={
                addAccount.isPending ||
                !accountForm.code.trim() ||
                !accountForm.name.trim()
              }
            >
              {addAccount.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}{" "}
              Create account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={periodOpen} onOpenChange={setPeriodOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create fiscal period</DialogTitle>
            <DialogDescription>
              Periods may not overlap and should follow the configured fiscal
              calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fiscal year</Label>
              <Input
                type="number"
                value={periodForm.fiscalYear}
                onChange={(event) =>
                  setPeriodForm((form) => ({
                    ...form,
                    fiscalYear: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Period number</Label>
              <Input
                type="number"
                min={1}
                max={53}
                value={periodForm.periodNumber}
                onChange={(event) =>
                  setPeriodForm((form) => ({
                    ...form,
                    periodNumber: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Name</Label>
              <Input
                placeholder="January 2026"
                value={periodForm.name}
                onChange={(event) =>
                  setPeriodForm((form) => ({
                    ...form,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                value={periodForm.startDate}
                onChange={(event) =>
                  setPeriodForm((form) => ({
                    ...form,
                    startDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input
                type="date"
                value={periodForm.endDate}
                onChange={(event) =>
                  setPeriodForm((form) => ({
                    ...form,
                    endDate: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPeriodOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addPeriod.mutate()}
              disabled={
                addPeriod.isPending ||
                !periodForm.name.trim() ||
                !periodForm.startDate ||
                !periodForm.endDate
              }
            >
              Create period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
