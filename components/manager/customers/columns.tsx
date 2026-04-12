"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import type { CustomerEntity } from "@/lib/customerEntities";
import { Badge } from "@/components/ui/badge";

type Translate = (key: string) => string;

export function getCustomerColumns(t: Translate): ColumnDef<CustomerEntity>[] {
  return [
    {
      accessorKey: "type",
      header: t("type"),
      cell: ({ row }) => {
        const type = row.original.type;
        return (
          <Badge variant={type === "COMPANY" ? "secondary" : "outline"}>
            {type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "name",
      header: t("name"),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/manager/customers/${row.original.id}`}
          className="font-medium text-foreground transition-colors hover:text-primary"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "companyName",
      header: t("company"),
      cell: ({ row }) => row.original.companyName ?? "-",
    },
    {
      accessorKey: "email",
      header: t("email"),
      cell: ({ row }) => row.original.email ?? "-",
    },
    {
      accessorKey: "phone",
      header: t("phone"),
      cell: ({ row }) => row.original.phone ?? "-",
    },
    {
      id: "orders",
      header: t("orders"),
      cell: ({ row }) => row.original._count?.orders ?? 0,
    },
    {
      accessorKey: "createdAt",
      header: t("created"),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
  ];
}
