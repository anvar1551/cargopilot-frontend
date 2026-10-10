"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DataListFrameProps = {
  title: string;
  description?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  loadedCount?: number;
  totalCount?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  className?: string;
  bodyClassName?: string;
  minWidthClassName?: string;
};

export function DataListFrame({
  title,
  description,
  searchValue,
  searchPlaceholder = "Search...",
  onSearchChange,
  filters,
  actions,
  children,
  isLoading,
  isEmpty,
  emptyText = "No records matched your filters.",
  loadedCount,
  totalCount,
  hasPreviousPage,
  hasNextPage,
  onPreviousPage,
  onNextPage,
  className,
  bodyClassName,
  minWidthClassName = "min-w-[760px]",
}: DataListFrameProps) {
  const showSearch = typeof searchValue === "string" && onSearchChange;

  return (
    <Card className={cn("rounded-2xl border-border/70", className)}>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        {(showSearch || filters) ? (
          <div className="flex flex-wrap items-center gap-3">
            {showSearch ? (
              <div className="relative min-w-[240px] flex-1 basis-[320px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9"
                />
              </div>
            ) : null}
            {filters}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">
        <div className={cn("max-h-[min(68vh,720px)] overflow-auto rounded-xl border", bodyClassName)}>
          <div className={minWidthClassName}>
            {isLoading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : isEmpty ? (
              <div className="flex h-32 items-center justify-center px-4 text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              children
            )}
          </div>
        </div>

        {(typeof loadedCount === "number" ||
          typeof totalCount === "number" ||
          onPreviousPage ||
          onNextPage) ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <div>
              Loaded {loadedCount ?? 0}
              {typeof totalCount === "number" ? ` of ${totalCount}` : ""}
            </div>
            {(onPreviousPage || onNextPage) ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onPreviousPage}
                  disabled={!hasPreviousPage}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onNextPage}
                  disabled={!hasNextPage}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
