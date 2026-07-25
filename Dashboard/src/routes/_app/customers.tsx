import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { DataTableFilters } from "@/components/app/data-table-filters";
import { KpiCard } from "@/components/app/kpi-card";
import { CUSTOMERS } from "@/lib/mock/data";
import { formatMoney, formatDateShort } from "@/lib/format";
import { Users, UserCheck, UserX, ShieldAlert } from "lucide-react";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({ meta: [{ title: "Clients — Northwind Bank" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={4} maxWidth={1480} />;
  const verified = CUSTOMERS.filter((c) => c.kyc === "verified").length;
  const review = CUSTOMERS.filter((c) => c.kyc === "review" || c.kyc === "pending").length;
  const rejected = CUSTOMERS.filter((c) => c.kyc === "rejected").length;
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader title="Clients" description="Base client unifiée avec statut KYC et segmentation." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Clients" value={String(CUSTOMERS.length)} icon={Users} delta={2.1} />
        <KpiCard label="KYC vérifié" value={String(verified)} icon={UserCheck} />
        <KpiCard label="À revoir" value={String(review)} icon={ShieldAlert} />
        <KpiCard label="Refusés" value={String(rejected)} icon={UserX} />
      </div>
      <div className="mt-6">
        <SectionCard action={<DataTableFilters placeholder="Nom, email, ID…" />} bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Segment</th>
                <th className="px-5 py-3 font-medium">KYC</th>
                <th className="px-5 py-3 font-medium">Pays</th>
                <th className="px-5 py-3 font-medium">Comptes</th>
                <th className="px-5 py-3 font-medium">Inscrit</th>
                <th className="px-5 py-3 text-right font-medium">Solde global</th>
              </tr>
            </thead>
            <tbody>
              {CUSTOMERS.slice(0, 40).map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <Link to="/customers/$id" params={{ id: c.id }} className="font-medium hover:text-[var(--success)]">{c.name}</Link>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </td>
                  <td className="px-5 py-3 capitalize text-muted-foreground">{c.segment}</td>
                  <td className="px-5 py-3"><StatusBadge value={c.kyc} /></td>
                  <td className="px-5 py-3 text-muted-foreground">{c.city}, {c.country}</td>
                  <td className="px-5 py-3 tabular text-muted-foreground">{c.accounts}</td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDateShort(c.joined)}</td>
                  <td className="px-5 py-3 text-right tabular font-medium">{formatMoney(c.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}