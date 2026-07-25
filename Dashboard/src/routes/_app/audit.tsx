import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { DataTableFilters } from "@/components/app/data-table-filters";
import { KpiCard } from "@/components/app/kpi-card";
import { AUDIT_LOGS } from "@/lib/mock/data";
import { formatDate } from "@/lib/format";
import { ScrollText, ShieldCheck, AlertOctagon, UserCheck } from "lucide-react";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/audit")({
  head: () => ({ meta: [{ title: "Journal d'audit — Northwind Bank" }] }),
  component: AuditPage,
});

function AuditPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={4} maxWidth={1480} />;
  const denied = AUDIT_LOGS.filter((l) => l.outcome === "denied").length;
  const errors = AUDIT_LOGS.filter((l) => l.outcome === "error").length;
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader title="Journal d'audit" description="Traçabilité complète des actions du back-office." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Événements 24h" value={String(AUDIT_LOGS.length)} icon={ScrollText} />
        <KpiCard label="Succès" value={String(AUDIT_LOGS.length - denied - errors)} icon={ShieldCheck} delta={0.4} />
        <KpiCard label="Refusés" value={String(denied)} icon={AlertOctagon} delta={1.1} />
        <KpiCard label="Acteurs actifs" value="24" icon={UserCheck} />
      </div>

      <div className="mt-6">
        <SectionCard action={<DataTableFilters placeholder="Acteur, action, cible…" />} bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Acteur</th>
                <th className="px-5 py-3 font-medium">Rôle</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Cible</th>
                <th className="px-5 py-3 font-medium">IP</th>
                <th className="px-5 py-3 font-medium">Résultat</th>
              </tr>
            </thead>
            <tbody>
              {AUDIT_LOGS.map((l) => (
                <tr key={l.id} className="border-b hover:bg-muted/30">
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(l.date)}</td>
                  <td className="px-5 py-3 font-medium">{l.actor}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.role}</td>
                  <td className="px-5 py-3">{l.action}</td>
                  <td className="px-5 py-3 tabular text-muted-foreground">{l.target}</td>
                  <td className="px-5 py-3 tabular text-muted-foreground">{l.ip}</td>
                  <td className="px-5 py-3"><StatusBadge value={l.outcome} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}