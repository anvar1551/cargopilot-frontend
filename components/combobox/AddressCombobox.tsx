"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchAddresses, formatAddress, type Address } from "@/lib/addresses";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

export function AddressCombobox(props: {
  value?: string | null;

  /**
   * If provided => manager-mode list addresses for that customer entity.
   * If omitted/null => self-mode (backend returns addresses for logged-in customer context).
   */
  customerEntityId?: string | null;

  placeholder?: string;
  onChange: (id: string | null, address?: Address) => void;

  buttonClassName?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const qDebounced = useDebouncedValue(q, 250);

  // ✅ normalize null -> undefined (self-mode)
  const customerEntityId = props.customerEntityId ?? undefined;
  const scopeKey = customerEntityId ? `cust:${customerEntityId}` : "self";

  const query = useQuery({
    queryKey: ["addresses", scopeKey, qDebounced],
    enabled: open,
    queryFn: ({ signal }) =>
      fetchAddresses(
        {
          customerEntityId,
          q: qDebounced.trim() ? qDebounced.trim() : undefined,
          page: 1,
          limit: 20,
        },
        signal,
      ),
    staleTime: 30_000,
  });

  const data = query.data ?? [];
  const isLoading = query.isFetching;

  const selected = useMemo(
    () => data.find((x) => x.id === props.value),
    [data, props.value],
  );

  const label = selected
    ? formatAddress(selected)
    : (props.placeholder ?? "Select address");

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={props.buttonClassName ?? "w-full justify-between"}
        >
          <span className="truncate">{label}</span>
          <span className="text-muted-foreground">{isLoading ? "…" : "⌄"}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={props.contentClassName ?? "p-0 w-[420px]"}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search street, city, postal code..."
            value={q}
            onValueChange={setQ}
          />

          <CommandEmpty>
            {isLoading ? "Searching..." : "No results"}
          </CommandEmpty>

          <CommandGroup>
            <CommandItem
              onSelect={() => {
                props.onChange(null);
                setOpen(false);
              }}
            >
              Clear selection
            </CommandItem>

            {data.map((a) => (
              <CommandItem
                key={a.id}
                value={a.id}
                onSelect={() => {
                  props.onChange(a.id, a);
                  setOpen(false);
                }}
              >
                <span className="text-sm">{formatAddress(a)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
