"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Power, RefreshCw, Split, Trash2 } from "lucide-react";
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
import {
  changeFinancePostingRuleStatus,
  createFinancePostingRule,
  getFinanceSetupCatalog,
  listFinanceAccounts,
  listFinancePostingRules,
  type PostingRuleInput,
} from "@/lib/finance";
import { hasPermission, type AuthUser } from "@/lib/auth";

type RuleLineForm = {
  side: "debit" | "credit";
  accountId: string;
  amountKey: string;
  descriptionTemplate: string;
};

export default function PostingRulesWorkspace({
  user,
}: {
  user: AuthUser | null;
}) {
  const client = useQueryClient();
  const canManage = hasPermission(user, "finance.postingRules.manage");
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    sourceType: "invoice",
    eventType: "invoice.issued",
    priority: "100",
    validFrom: "",
    validTo: "",
    lines: [
      {
        side: "debit",
        accountId: "",
        amountKey: "gross_amount",
        descriptionTemplate: "",
      } as RuleLineForm,
      {
        side: "credit",
        accountId: "",
        amountKey: "gross_amount",
        descriptionTemplate: "",
      } as RuleLineForm,
    ],
  });
  const cursor = cursors[page - 1];
  const rules = useQuery({
    queryKey: ["finance", "posting-rules", page, cursor],
    queryFn: () => listFinancePostingRules({ cursor, limit: 25 }),
  });
  const catalog = useQuery({
    queryKey: ["finance", "setup-catalog"],
    queryFn: getFinanceSetupCatalog,
  });
  const accounts = useQuery({
    queryKey: ["finance", "accounts", "rule-selector"],
    queryFn: () => listFinanceAccounts({ limit: 100 }),
  });
  const postableAccounts = useMemo(
    () =>
      accounts.data?.items.filter(
        (account) => account.allowPosting && account.status === "active",
      ) ?? [],
    [accounts.data],
  );
  const sourceTypes = Object.keys(catalog.data?.postingEvents ?? {});
  const eventTypes = catalog.data?.postingEvents[form.sourceType] ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      createFinancePostingRule({
        code: form.code.trim(),
        name: form.name.trim(),
        sourceType: form.sourceType,
        eventType: form.eventType,
        priority: Number(form.priority),
        validFrom: form.validFrom
          ? new Date(form.validFrom).toISOString()
          : null,
        validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
        lines: form.lines.map((line) => ({
          side: line.side,
          accountId: line.accountId,
          amountKey: line.amountKey,
          descriptionTemplate: line.descriptionTemplate.trim() || null,
        })),
      } satisfies PostingRuleInput),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["finance", "posting-rules"],
      });
      setOpen(false);
      toast.success("Posting rule created");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not create posting rule")),
  });
  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "active" | "inactive";
    }) => changeFinancePostingRuleStatus(id, status),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["finance", "posting-rules"],
      });
      toast.success("Posting rule status updated");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not update posting rule")),
  });

  const updateLine = (index: number, patch: Partial<RuleLineForm>) =>
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  const addBalancedPair = () => {
    const amountKey = catalog.data?.amountKeys[0] ?? "gross_amount";
    setForm((current) => ({
      ...current,
      lines: [
        ...current.lines,
        { side: "debit", accountId: "", amountKey, descriptionTemplate: "" },
        { side: "credit", accountId: "", amountKey, descriptionTemplate: "" },
      ],
    }));
  };
  const next = () => {
    const nextCursor = rules.data?.pageInfo.nextCursor;
    if (!nextCursor) return;
    setCursors((current) => {
      const copy = [...current];
      copy[page] = nextCursor;
      return copy;
    });
    setPage((value) => value + 1);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Posting rules</CardTitle>
          <CardDescription>
            Translate operational events into deterministic debit and credit
            entries.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void rules.refetch()}>
            <RefreshCw /> Refresh
          </Button>
          {canManage ? (
            <Button onClick={() => setOpen(true)}>
              <Plus /> New rule
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {rules.data?.items.length ? (
          <div className="overflow-hidden rounded-2xl border">
            <div className="max-h-[560px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Source event</TableHead>
                    <TableHead>Mapping</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.data.items.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <p className="font-semibold">{rule.name}</p>
                        <p className="font-mono text-xs text-slate-500">
                          {rule.code} / v{rule.version} / priority{" "}
                          {rule.priority}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{rule.eventType}</p>
                        <p className="text-xs capitalize text-slate-500">
                          {rule.sourceType.replaceAll("_", " ")}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-72 flex-wrap gap-1">
                          {rule.lines.map((line) => (
                            <Badge
                              key={line.id}
                              variant="outline"
                              className={
                                line.side === "debit"
                                  ? "border-blue-200 bg-blue-50"
                                  : "border-emerald-200 bg-emerald-50"
                              }
                            >
                              {line.side === "debit" ? "Dr" : "Cr"}{" "}
                              {line.account.code} · {line.amountExpression}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p>{formatDate(rule.validFrom)}</p>
                        <p className="text-xs text-slate-500">
                          to {formatDate(rule.validTo)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <FinanceStatusBadge status={rule.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              statusMutation.mutate({
                                id: rule.id,
                                status:
                                  rule.status === "active"
                                    ? "inactive"
                                    : "active",
                              })
                            }
                          >
                            <Power />{" "}
                            {rule.status === "active"
                              ? "Deactivate"
                              : "Activate"}
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 pb-4">
              <FinancePager
                page={page}
                canPrevious={page > 1}
                canNext={Boolean(rules.data.pageInfo.hasMore)}
                onPrevious={() => setPage((value) => value - 1)}
                onNext={next}
              />
            </div>
          </div>
        ) : (
          <FinanceEmptyState
            title="No posting rules"
            description="Create event mappings after installing the standard chart of accounts. Operational events remain visible as exceptions until a matching active rule exists."
          />
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Create posting rule</DialogTitle>
            <DialogDescription>
              Each amount key requires exactly one debit and one credit mapping.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Rule code</Label>
              <Input
                placeholder="invoice.standard"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    code: event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_.-]/g, "_"),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input
                type="number"
                min={0}
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={form.sourceType}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    sourceType: value,
                    eventType: catalog.data?.postingEvents[value]?.[0] ?? "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceTypes.map((source) => (
                    <SelectItem
                      key={source}
                      value={source}
                      className="capitalize"
                    >
                      {source.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Event</Label>
              <Select
                value={form.eventType}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, eventType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((event) => (
                    <SelectItem key={event} value={event}>
                      {event}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valid from (optional)</Label>
              <Input
                type="datetime-local"
                value={form.validFrom}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    validFrom: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Valid to (optional)</Label>
              <Input
                type="datetime-local"
                value={form.validTo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    validTo: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Ledger mapping</h3>
                <p className="text-xs text-slate-500">
                  Use matching amount keys on both sides.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addBalancedPair}>
                <Split /> Add balanced pair
              </Button>
            </div>
            {form.lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-2xl border bg-slate-50/60 p-4 sm:grid-cols-[0.6fr_1.5fr_1fr_1.2fr_auto]"
              >
                <div className="space-y-2">
                  <Label>Side</Label>
                  <Select
                    value={line.side}
                    onValueChange={(value) =>
                      updateLine(index, { side: value as "debit" | "credit" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select
                    value={line.accountId}
                    onValueChange={(value) =>
                      updateLine(index, { accountId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {postableAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount key</Label>
                  <Select
                    value={line.amountKey}
                    onValueChange={(value) =>
                      updateLine(index, { amountKey: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {catalog.data?.amountKeys.map((key) => (
                        <SelectItem key={key} value={key}>
                          {key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description template</Label>
                  <Input
                    value={line.descriptionTemplate}
                    onChange={(event) =>
                      updateLine(index, {
                        descriptionTemplate: event.target.value,
                      })
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="self-end"
                  disabled={form.lines.length <= 2}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      lines: current.lines.filter(
                        (_, lineIndex) => lineIndex !== index,
                      ),
                    }))
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                form.code.trim().length < 2 ||
                form.name.trim().length < 2 ||
                !form.eventType ||
                form.lines.some((line) => !line.accountId)
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}{" "}
              Create rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
