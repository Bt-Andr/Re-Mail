import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { KpiCard } from "@/components/app/kpi-card";
import { DataTableFilters } from "@/components/app/data-table-filters";
import { TICKETS } from "@/lib/mock/data";
import { relativeTime } from "@/lib/format";
import { LifeBuoy, Clock, CheckCircle2, MessageSquare } from "lucide-react";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/support")({
  head: () => ({ meta: [{ title: "Support — Northwind Bank" }] }),
  component: SupportPage,
});

function SupportPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={4} maxWidth={1480} />;
  const open = TICKETS.filter((t) => t.status === "open").length;
  const inProg = TICKETS.filter((t) => t.status === "in_progress").length;
  const resolved = TICKETS.filter((t) => t.status === "resolved").length;
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader title="Support" description="Tickets clients, SLA et conversations." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Tickets ouverts" value={String(open)} icon={LifeBuoy} delta={-3.2} />
        <KpiCard label="En cours" value={String(inProg)} icon={Clock} />
        <KpiCard label="Résolus 7j" value={String(resolved)} icon={CheckCircle2} delta={6.1} />
        <KpiCard label="CSAT" value="4,6 / 5" icon={MessageSquare} delta={0.2} />
      </div>

      <div className="mt-6">
        <SectionCard action={<DataTableFilters placeholder="Sujet, client, ID…" />} bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Ticket</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Canal</th>
                <th className="px-5 py-3 font-medium">Priorité</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Assigné</th>
                <th className="px-5 py-3 font-medium">Ouvert</th>
              </tr>
            </thead>
            <tbody>
              {TICKETS.map((t) => (
                <tr key={t.id} className="border-b hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="font-medium">{t.subject}</div>
                    <div className="text-xs text-muted-foreground">{t.id}</div>
                  </td>
                  <td className="px-5 py-3">{t.customer}</td>
                  <td className="px-5 py-3 capitalize text-muted-foreground">{t.channel}</td>
                  <td className="px-5 py-3"><StatusBadge value={t.priority} /></td>
                  <td className="px-5 py-3"><StatusBadge value={t.status} /></td>
                  <td className="px-5 py-3 text-muted-foreground">{t.assignee}</td>
                  <td className="px-5 py-3 text-muted-foreground">{relativeTime(t.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}