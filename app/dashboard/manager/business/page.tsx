import Link from "next/link";
import { Building, Building2, Users } from "lucide-react";

const modules = [
  { title: "Customers", href: "/dashboard/manager/business/customers", icon: Users, desc: "Customer entities and contacts" },
  { title: "Companies", href: "/dashboard/manager/business/companies", icon: Building, desc: "Legal companies and ownership" },
  { title: "Branches", href: "/dashboard/manager/business/branches", icon: Building2, desc: "Operational branch units" },
  { title: "Agents", href: "/dashboard/manager/business/agents", icon: Users, desc: "Field and office agents" },
  { title: "Pickup Points", href: "/dashboard/manager/business/pickup-points", icon: Building2, desc: "Business pickup counters and partner desks" },
];

export default function ManagerBusinessOverviewPage() {
  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white">
        <h1 className="text-2xl font-semibold tracking-tight">Business</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Entity management hub for customers and legal hierarchy entities (company, branch, agent, pickup point). Warehouses stay in Operations; carrier APIs live in Integrations.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
            >
              <Icon className="h-5 w-5 text-teal-600" />
              <h2 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
