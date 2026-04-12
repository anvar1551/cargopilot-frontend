"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { fetchCustomers, type CustomerType } from "@/lib/customerEntities";
import { useDebounce } from "@/lib/hooks/useDebounce";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import { getCustomerColumns } from "./columns";

const copy = {
  en: {
    searchPlaceholder: "Search by name, email, or tax ID...",
    allTypes: "All types",
    person: "Person",
    company: "Company",
    updating: "Updating results...",
    pageOf: "Page {page} of {pageCount}",
    previous: "Previous",
    next: "Next",
  },
  ru: {
    searchPlaceholder: "Поиск по имени, email или ИНН...",
    allTypes: "Все типы",
    person: "Физлицо",
    company: "Компания",
    updating: "Обновление результатов...",
    pageOf: "Страница {page} из {pageCount}",
    previous: "Назад",
    next: "Далее",
  },
  uz: {
    searchPlaceholder: "Ism, email yoki STIR bo'yicha qidiring...",
    allTypes: "Barcha turlar",
    person: "Jismoniy shaxs",
    company: "Kompaniya",
    updating: "Natijalar yangilanmoqda...",
    pageOf: "{pageCount} dan {page}-sahifa",
    previous: "Oldingi",
    next: "Keyingi",
  },
} as const;

const headerLabels = {
  en: {
    type: "Type",
    name: "Name",
    company: "Company",
    email: "Email",
    phone: "Phone",
    orders: "Orders",
    created: "Created",
  },
  ru: {
    type: "Тип",
    name: "Имя",
    company: "Компания",
    email: "Email",
    phone: "Телефон",
    orders: "Заказы",
    created: "Создан",
  },
  uz: {
    type: "Turi",
    name: "Ism",
    company: "Kompaniya",
    email: "Email",
    phone: "Telefon",
    orders: "Buyurtmalar",
    created: "Yaratilgan",
  },
} as const;

export default function CustomersTable() {
  const { locale } = useI18n();
  const text = copy[locale];

  const [searchInput, setSearchInput] = useState("");
  const [type, setType] = useState<CustomerType | "all">("all");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(searchInput, 400);
  const query = useQuery({
    queryKey: ["customers", debouncedSearch, type, page],
    queryFn: () =>
      fetchCustomers({
        q: debouncedSearch,
        type: type === "all" ? undefined : type,
        page,
        limit: 10,
      }),
    enabled: debouncedSearch.length === 0 || debouncedSearch.length >= 2,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, type]);

  const data = useMemo(() => query.data?.data ?? [], [query.data]);

  const columns = useMemo(
    () =>
      getCustomerColumns((key) => {
        const labels = headerLabels[locale];
        return labels[key as keyof typeof labels] ?? key;
      }),
    [locale],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder={text.searchPlaceholder}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="max-w-sm"
        />

        <Select value={type} onValueChange={(value) => setType(value as CustomerType | "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={text.allTypes} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{text.allTypes}</SelectItem>
            <SelectItem value="PERSON">{text.person}</SelectItem>
            <SelectItem value="COMPANY">{text.company}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isFetching ? (
        <div className="text-xs text-muted-foreground">{text.updating}</div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {text.pageOf
            .replace("{page}", String(query.data?.page ?? page))
            .replace("{pageCount}", String(query.data?.pageCount ?? 1))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            {text.previous}
          </Button>
          <Button
            variant="outline"
            disabled={!query.data || page >= query.data.pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            {text.next}
          </Button>
        </div>
      </div>
    </div>
  );
}
