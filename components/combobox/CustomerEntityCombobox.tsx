"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/lib/hooks/useDebounce";

import { fetchCustomers, type CustomerEntity } from "@/lib/customerEntities";

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

export function CustomerEntityCombobox(props: {
  value?: string | null;
  onChange: (id: string | null, entity?: CustomerEntity) => void;
  buttonClassName?: string;
  contentClassName?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const debouncedQ = useDebounce(q, 350);

  const query = useQuery({
    queryKey: ["customer-entities", debouncedQ],
    queryFn: () =>
      fetchCustomers({
        q: debouncedQ || undefined,
        page: 1,
        limit: 20,
      }),
    enabled: open,
  });

  const entities = useMemo(() => query.data?.data ?? [], [query.data]);

  const selected = useMemo(() => {
    if (!props.value) return null;

    // try to find in current page
    const inList = entities.find((x) => x.id === props.value);
    return inList ?? null;
  }, [entities, props.value]);

  const label =
    selected?.companyName ||
    selected?.name ||
    selected?.email ||
    (props.value
      ? "Selected customer"
      : (props.placeholder ?? "Select customer entity"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={props.buttonClassName ?? "w-full justify-between"}
        >
          <span className="truncate">{label}</span>
          <span className="text-muted-foreground">
            {query.isFetching ? "…" : "⌄"}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={props.contentClassName ?? "p-0 w-[360px]"}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search company, name, email..."
            value={q}
            onValueChange={setQ}
          />

          <CommandEmpty>
            {query.isFetching ? "Searching..." : "No results"}
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

            {entities.map((e) => {
              const title = e.companyName || e.name || "Unnamed";
              const subtitle = e.email || e.phone || "";

              return (
                <CommandItem
                  key={e.id}
                  value={e.id}
                  onSelect={() => {
                    props.onChange(e.id, e);
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{title}</span>
                    {subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
