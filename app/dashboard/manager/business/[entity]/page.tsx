"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Edit3, Plus, Power, Search } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { createCustomer, fetchCustomers, type CustomerEntity, type CustomerType } from "@/lib/customers";
import {
  createOrganization,
  deactivateOrganization,
  fetchOrganizations,
  updateOrganization,
  type Organization,
  type OrganizationType,
} from "@/lib/organizations";
import {
  createWarehouse,
  fetchWarehouses,
  getWarehouseTypeLabel,
  type Warehouse,
  type WarehouseType,
} from "@/lib/warehouses";

type EntitySlug =
  | "companies"
  | "branches"
  | "agents"
  | "pickup-points"
  | "customers"
  | "warehouses";

type EntityKind = "organization" | "customer" | "warehouse";

type EntityConfig = {
  title: string;
  subtitle: string;
  singular: string;
  kind: EntityKind;
  orgType?: OrganizationType;
  cols: string[];
};

const ENTITY_CONFIG: Record<EntitySlug, EntityConfig> = {
  companies: {
    title: "Companies",
    subtitle: "Legal entities and top-level business ownership.",
    singular: "Company",
    kind: "organization",
    orgType: "company",
    cols: ["Name", "Code", "Parent", "Children", "Status", "Actions"],
  },
  branches: {
    title: "Branches",
    subtitle: "Operational branch units under companies.",
    singular: "Branch",
    kind: "organization",
    orgType: "branch",
    cols: ["Name", "Code", "Parent", "Children", "Status", "Actions"],
  },
  agents: {
    title: "Agents",
    subtitle: "Field and office agents in company/branch scope.",
    singular: "Agent",
    kind: "organization",
    orgType: "agent",
    cols: ["Name", "Code", "Parent", "Children", "Status", "Actions"],
  },
  "pickup-points": {
    title: "Pickup Points",
    subtitle:
      "Business pickup counters in the organization hierarchy. For scan/storage nodes, use Warehouses with type pickup_point.",
    singular: "Pickup Point",
    kind: "organization",
    orgType: "pickup_point",
    cols: ["Name", "Code", "Parent", "Children", "Status", "Actions"],
  },
  customers: {
    title: "Customers",
    subtitle: "Customer entities for person and company profiles.",
    singular: "Customer",
    kind: "customer",
    cols: ["Name", "Type", "Company", "Phone", "Created", "Actions"],
  },
  warehouses: {
    title: "Warehouses",
    subtitle: "Operational storage, scan nodes, and pickup-point warehouse nodes.",
    singular: "Warehouse",
    kind: "warehouse",
    cols: ["Name", "Type", "Location", "Region", "Created", "Actions"],
  },
};

const ALLOWED_PARENT_TYPES: Record<OrganizationType, OrganizationType[]> = {
  company: [],
  branch: ["company"],
  agent: ["company", "branch"],
  pickup_point: ["company", "branch", "agent"],
  carrier: ["company"],
  client: ["company", "branch", "agent", "pickup_point"],
};

function formatOrgType(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function extractApiErrorMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : fallback;
  }

  const payload = err.response?.data as
    | { error?: string; issues?: { fieldErrors?: Record<string, string[]> } }
    | undefined;
  const base = payload?.error || err.message || fallback;
  const fieldErrors = payload?.issues?.fieldErrors
    ? Object.entries(payload.issues.fieldErrors)
        .flatMap(([field, messages]) =>
          (messages ?? []).map((msg) => `${field}: ${msg}`),
        )
        .filter(Boolean)
    : [];

  return fieldErrors.length > 0 ? `${base}. ${fieldErrors.join(" | ")}` : base;
}

export default function BusinessEntityPage() {
  const params = useParams<{ entity?: string | string[] }>();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [customers, setCustomers] = useState<CustomerEntity[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [parentOptions, setParentOptions] = useState<Organization[]>([]);

  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentOrgId, setParentOrgId] = useState("none");
  const [isActive, setIsActive] = useState(true);

  const [customerType, setCustomerType] = useState<CustomerType>("PERSON");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");

  const [warehouseType, setWarehouseType] = useState<WarehouseType>("warehouse");
  const [location, setLocation] = useState("");
  const [region, setRegion] = useState("");

  const entityParam = Array.isArray(params.entity) ? params.entity[0] : params.entity;
  const entityKey =
    entityParam && (entityParam as EntitySlug) in ENTITY_CONFIG
      ? (entityParam as EntitySlug)
      : null;
  const config = entityKey ? ENTITY_CONFIG[entityKey] : null;

  const requiresParent = Boolean(
    config?.kind === "organization" &&
      config.orgType &&
      ALLOWED_PARENT_TYPES[config.orgType].length > 0,
  );

  const filteredParentOptions = useMemo(() => {
    if (!config?.orgType) return [];
    const allowed = new Set(ALLOWED_PARENT_TYPES[config.orgType]);
    return parentOptions.filter((item) => {
      if (editingOrgId && item.id === editingOrgId) return false;
      return allowed.has(item.type);
    });
  }, [config?.orgType, parentOptions, editingOrgId]);

  const resetForm = () => {
    setEditingOrgId(null);
    setName("");
    setCode("");
    setParentOrgId("none");
    setIsActive(true);

    setCustomerType("PERSON");
    setEmail("");
    setPhone("");
    setCompanyName("");
    setTaxId("");

    setWarehouseType("warehouse");
    setLocation("");
    setRegion("");
  };

  const loadData = async () => {
    if (!config) return;

    setLoading(true);
    setError(null);

    try {
      if (config.kind === "organization" && config.orgType) {
        const [list, parents] = await Promise.all([
          fetchOrganizations({
            type: config.orgType,
            q: q.trim() || undefined,
            isActive: status === "all" ? undefined : status === "active",
            page: 1,
            limit: 100,
          }),
          fetchOrganizations({ isActive: true, page: 1, limit: 100 }),
        ]);
        setOrganizations(list.data);
        setParentOptions(parents.data);
        setCustomers([]);
        setWarehouses([]);
      } else if (config.kind === "customer") {
        const list = await fetchCustomers({ q: q.trim() || undefined, page: 1, limit: 200 });
        setCustomers(list.data);
        setOrganizations([]);
        setWarehouses([]);
      } else {
        const list = await fetchWarehouses();
        const query = q.trim().toLowerCase();
        const filtered = !query
          ? list
          : list.filter((item) =>
              [item.name, item.location, item.region, item.type].join(" ").toLowerCase().includes(query),
            );
        setWarehouses(filtered);
        setOrganizations([]);
        setCustomers([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    resetForm();
    setStatus("all");
    setQ("");
  }, [entityKey]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onCreateOrUpdate = async () => {
    if (!config) return;
    const cleanName = name.trim();

    if (!cleanName) {
      toast.error("Name is required");
      return;
    }
    if (cleanName.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }

    setSubmitting(true);
    try {
      if (config.kind === "organization" && config.orgType) {
        const normalizedParentId = parentOrgId === "none" ? null : parentOrgId;
        if (requiresParent && !normalizedParentId) {
          toast.error("Parent organization is required for this entity type");
          return;
        }

        const payload = {
          name: cleanName,
          type: config.orgType,
          code: code.trim() || null,
          parentOrgId: normalizedParentId,
          isActive,
        };

        if (editingOrgId) {
          await updateOrganization(editingOrgId, payload);
          toast.success(`${config.singular} updated`);
        } else {
          await createOrganization(payload);
          toast.success(`${config.singular} created`);
        }
      } else if (config.kind === "customer") {
        if (customerType === "COMPANY") {
          if (!companyName.trim()) {
            toast.error("Company name is required for COMPANY customer");
            return;
          }
          if (!taxId.trim()) {
            toast.error("Tax ID is required for COMPANY customer");
            return;
          }
        }

        const payload = {
          type: customerType,
          name: cleanName,
          email: email.trim() || null,
          phone: phone.trim() || null,
          companyName: customerType === "COMPANY" ? companyName.trim() || null : null,
          taxId: customerType === "COMPANY" ? taxId.trim() || null : null,
        };
        await createCustomer(payload);
        toast.success("Customer created");
      } else {
        if (!location.trim()) {
          toast.error("Location is required");
          return;
        }
        await createWarehouse({
          name: cleanName,
          type: warehouseType,
          location: location.trim(),
          region: region.trim() || undefined,
        });
        toast.success("Warehouse created");
      }

      setOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      const message = extractApiErrorMessage(err, "Operation failed");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onEditOrganization = (org: Organization) => {
    setEditingOrgId(org.id);
    setName(org.name);
    setCode(org.code ?? "");
    setParentOrgId(org.parentOrgId ?? "none");
    setIsActive(org.isActive);
    setOpen(true);
  };

  const onToggleOrganization = async (org: Organization) => {
    try {
      if (org.isActive) {
        await deactivateOrganization(org.id);
        toast.success("Organization deactivated");
      } else {
        await updateOrganization(org.id, { isActive: true });
        toast.success("Organization activated");
      }
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update organization";
      toast.error(message);
    }
  };

  if (!config || !entityKey) {
    return (
      <div className="w-full p-8">
        <Card className="rounded-2xl border-slate-200">
          <CardContent className="py-12 text-center text-sm text-slate-500">
            This business module is not active yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.22),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(14,116,144,0.16),transparent_40%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge className="mb-3 border-white/20 bg-white/10 text-slate-100 hover:bg-white/15">Business Directory</Badge>
            <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200/85">{config.subtitle}</p>
          </div>

          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2 bg-white text-slate-900 hover:bg-slate-100" onClick={resetForm}>
                <Plus className="h-4 w-4" />
                Create {config.singular}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingOrgId ? `Edit ${config.singular}` : `Create ${config.singular}`}</DialogTitle>
                <DialogDescription>
                  {config.kind === "organization"
                    ? "Configure hierarchy and activation directly via new RBAC organization model."
                    : config.kind === "warehouse"
                      ? "Operational warehouse nodes can be standard warehouses or pickup-point warehouses."
                      : "Create person/company customer entities for order ownership and routing."}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${config.singular} name`} />

                {config.kind === "organization" ? (
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (optional)" />
                ) : config.kind === "customer" ? (
                  <Select value={customerType} onValueChange={(value) => setCustomerType(value as CustomerType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Customer type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSON">PERSON</SelectItem>
                      <SelectItem value="COMPANY">COMPANY</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={warehouseType} onValueChange={(value) => setWarehouseType(value as WarehouseType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Warehouse type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warehouse">Warehouse</SelectItem>
                      <SelectItem value="pickup_point">Pickup point</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {config.kind === "organization" ? (
                  <Select value={parentOrgId} onValueChange={setParentOrgId}>
                    <SelectTrigger>
                      <SelectValue placeholder={requiresParent ? "Parent organization (required)" : "Parent organization (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No parent</SelectItem>
                      {filteredParentOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({formatOrgType(item.type)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : config.kind === "customer" ? (
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" />
                ) : (
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
                )}

                {config.kind === "organization" ? (
                  <Select value={isActive ? "active" : "inactive"} onValueChange={(value) => setIsActive(value === "active")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                ) : config.kind === "customer" ? (
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" />
                ) : (
                  <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region (optional)" />
                )}

                {config.kind === "customer" && customerType === "COMPANY" ? (
                  <>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" />
                    <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="Tax ID" />
                  </>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={onCreateOrUpdate} disabled={submitting}>
                  {submitting ? "Saving..." : editingOrgId ? "Save changes" : `Create ${config.singular}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <Card className="rounded-[28px] border-slate-200/80 shadow-sm shadow-black/5">
        <CardHeader>
          <CardTitle>Directory List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${config.title.toLowerCase()}...`}
                className="pl-9"
              />
            </div>

            {config.kind === "organization" ? (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  {config.cols.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={config.cols.length} className="py-12 text-center text-sm text-slate-500">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : config.kind === "organization" ? (
                  organizations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={config.cols.length} className="py-12 text-center text-sm text-slate-500">
                        No organizations matched your filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    organizations.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.code || "-"}</TableCell>
                        <TableCell>{row.parentOrg?.name || "-"}</TableCell>
                        <TableCell>{row._count?.childOrgs ?? 0}</TableCell>
                        <TableCell>
                          {row.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => onEditOrganization(row)}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => void onToggleOrganization(row)}>
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )
                ) : config.kind === "customer" ? (
                  customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={config.cols.length} className="py-12 text-center text-sm text-slate-500">
                        No customers matched your filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customers.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.companyName || "-"}</TableCell>
                        <TableCell>{row.phone || "-"}</TableCell>
                        <TableCell>{formatDate(row.createdAt)}</TableCell>
                        <TableCell className="text-slate-400">-</TableCell>
                      </TableRow>
                    ))
                  )
                ) : warehouses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={config.cols.length} className="py-12 text-center text-sm text-slate-500">
                      No warehouses matched your filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  warehouses.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{getWarehouseTypeLabel(row.type)}</TableCell>
                      <TableCell>{row.location}</TableCell>
                      <TableCell>{row.region || "-"}</TableCell>
                      <TableCell>{formatDate(row.createdAt)}</TableCell>
                      <TableCell className="text-slate-400">-</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
