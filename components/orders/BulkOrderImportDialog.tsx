"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import type { ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  confirmOrderImport,
  downloadOrderImportTemplate,
  previewOrderImport,
  type OrderImportPreview,
} from "@/lib/orders";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BulkOrderImportDialogProps = {
  customerEntityId: string;
  customerLabel: string;
  trigger?: ReactNode;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null) return fallback;

  const maybeAxios = error as {
    response?: { data?: { error?: string } };
    message?: string;
  };

  return maybeAxios.response?.data?.error ?? maybeAxios.message ?? fallback;
}

export default function BulkOrderImportDialog({
  customerEntityId,
  customerLabel,
  trigger,
}: BulkOrderImportDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<OrderImportPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const templateMutation = useMutation({
    mutationFn: downloadOrderImportTemplate,
    onSuccess: (blob) => {
      downloadBlob(blob, "order-import-template-v1.csv");
      toast.success(t("bulkOrderImport.templateDownloaded"));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("bulkOrderImport.templateDownloadFailed")));
    },
  });

  const previewMutation = useMutation({
    mutationFn: (payload: { csvText: string; customerEntityId: string }) =>
      previewOrderImport(payload),
    onSuccess: (data) => {
      setPreview(data);
      if (data.invalidRows > 0) {
        toast.error(t("bulkOrderImport.previewInvalidRows"));
        return;
      }
      toast.success(t("bulkOrderImport.previewReady", { count: data.validRows }));
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("bulkOrderImport.validateFailed")));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (payload: { csvText: string; customerEntityId: string }) =>
      confirmOrderImport(payload),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({
          queryKey: ["customer", customerEntityId],
        }),
      ]);

      toast.success(t("bulkOrderImport.importSuccess", { count: result.count }));
      setOpen(false);
      setCsvText("");
      setFileName(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, t("bulkOrderImport.importFailed")));
    },
  });

  const visibleRows = useMemo(
    () => preview?.rows.slice(0, 25) ?? [],
    [preview],
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setCsvText(text);
      setFileName(file.name);
      setPreview(null);
    } catch {
      toast.error(t("bulkOrderImport.readFileFailed"));
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) return;
    setCsvText("");
    setFileName(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="rounded-2xl">
            <Upload className="h-4 w-4" />
            {t("bulkOrderImport.trigger")}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="h-[min(92vh,860px)] w-[96vw] max-w-[96vw] overflow-hidden p-0 sm:max-w-[1180px]">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-xl">{t("bulkOrderImport.title")}</DialogTitle>
          <DialogDescription>
            {t("bulkOrderImport.description", { customerLabel })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid h-[calc(92vh-92px)] max-h-[calc(860px-92px)] gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="border-b bg-muted/20 p-6 xl:border-b-0 xl:border-r">
            <div className="space-y-4">
              <div className="rounded-3xl border border-border/60 bg-background p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{t("bulkOrderImport.summaryTitle")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("bulkOrderImport.summaryHint")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border/60 bg-background p-4">
                <p className="text-sm font-medium">{t("bulkOrderImport.workflowTitle")}</p>
                <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>1. {t("bulkOrderImport.workflowStep1")}</li>
                  <li>2. {t("bulkOrderImport.workflowStep2")}</li>
                  <li>3. {t("bulkOrderImport.workflowStep3")}</li>
                  <li>4. {t("bulkOrderImport.workflowStep4")}</li>
                </ol>
              </div>

              <Button
                type="button"
                variant="secondary"
                className="w-full rounded-2xl"
                onClick={() => templateMutation.mutate()}
                disabled={templateMutation.isPending}
              >
                {templateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t("bulkOrderImport.downloadTemplate")}
              </Button>

              <div className="rounded-3xl border border-dashed border-border/70 bg-background p-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">{t("bulkOrderImport.csvFile")}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                  {fileName
                    ? t("bulkOrderImport.loadedFile", { fileName })
                    : t("bulkOrderImport.noFileSelected")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() =>
                    previewMutation.mutate({ csvText, customerEntityId })
                  }
                  disabled={!csvText.trim() || previewMutation.isPending}
                >
                  {previewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t("bulkOrderImport.validate")}
                </Button>

                <Button
                  type="button"
                  className="rounded-2xl"
                  onClick={() =>
                    confirmMutation.mutate({ csvText, customerEntityId })
                  }
                  disabled={
                    !preview ||
                    preview.invalidRows > 0 ||
                    preview.validRows === 0 ||
                    confirmMutation.isPending
                  }
                >
                  {confirmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {t("bulkOrderImport.importValidRows")}
                </Button>
              </div>
            </div>
          </div>

          <div className="min-w-0 p-6">
            {!preview ? (
              <div className="flex min-h-96 items-center justify-center rounded-3xl border border-dashed border-border/70 bg-muted/15 p-8 text-center">
                <div className="max-w-md space-y-3">
                  <div className="mx-auto w-fit rounded-2xl bg-amber-500/10 p-3 text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-semibold">{t("bulkOrderImport.previewEmptyTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("bulkOrderImport.previewEmptyHint")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-3xl border border-border/60 bg-background p-4">
                    <p className="text-sm text-muted-foreground">{t("bulkOrderImport.rows")}</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {preview.totalRows}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="text-sm text-muted-foreground">{t("bulkOrderImport.valid")}</p>
                    <p className="mt-2 text-3xl font-semibold text-emerald-700">
                      {preview.validRows}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-4">
                    <p className="text-sm text-muted-foreground">{t("bulkOrderImport.invalid")}</p>
                    <p className="mt-2 text-3xl font-semibold text-rose-700">
                      {preview.invalidRows}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-border/60 bg-background">
                  <div className="flex items-center justify-between px-4 py-4">
                    <div>
                      <p className="font-medium">{t("bulkOrderImport.validationPreview")}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("bulkOrderImport.showingFirstRows", { count: visibleRows.length })}
                        {preview.rows.length > visibleRows.length
                          ? t("bulkOrderImport.ofRows", { count: preview.rows.length })
                          : ""}
                        .
                      </p>
                    </div>
                    <Badge variant="outline">{customerLabel}</Badge>
                  </div>

                  <Separator />

                  <ScrollArea className="h-[520px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("bulkOrderImport.row")}</TableHead>
                          <TableHead>{t("bulkOrderImport.status")}</TableHead>
                          <TableHead>{t("bulkOrderImport.receiver")}</TableHead>
                          <TableHead>{t("bulkOrderImport.route")}</TableHead>
                          <TableHead>{t("bulkOrderImport.service")}</TableHead>
                          <TableHead>{t("bulkOrderImport.issues")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleRows.map((row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell className="font-medium">
                              {row.rowNumber}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  row.valid ? "secondary" : "destructive"
                                }
                              >
                                {row.valid ? t("bulkOrderImport.valid") : t("bulkOrderImport.invalid")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {row.summary.receiverName || "-"}
                            </TableCell>
                            <TableCell className="max-w-[280px]">
                              <div className="space-y-1 text-sm">
                                <p className="truncate">
                                  {row.summary.pickupAddress || "-"}
                                </p>
                                <p className="truncate text-muted-foreground">
                                  {row.summary.dropoffAddress || "-"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {row.summary.serviceType || "-"}
                            </TableCell>
                            <TableCell className="max-w-[320px]">
                              {row.errors.length > 0 ? (
                                <div className="space-y-1 text-sm text-rose-600">
                                  {row.errors.map((error) => (
                                    <p key={error}>{error}</p>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {t("bulkOrderImport.noIssues")}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
