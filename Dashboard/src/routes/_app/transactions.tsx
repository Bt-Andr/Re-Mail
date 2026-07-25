import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { DataTableFilters } from "@/components/app/data-table-filters";
import { TRANSACTIONS } from "@/lib/mock/data";
import { formatDate, formatMoney } from "@/lib/format";
import { KpiCard } from "@/components/app/kpi-card";
import { ArrowLeftRight, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Northwind Bank" }] }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={4} maxWidth={1480} />;
  const tx = TRANSACTIONS;
  const totals = {
    count: tx.length,
    success: tx.filter((t) => t.status === "completed").length,
    pending: tx.filter((t) => t.status === "pending").length,
    flagged: tx.filter((t) => t.status === "flagged" || t.status === "failed").length,
  };

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        title="Transactions"
        description="Toutes les opérations passant par les passerelles bancaires."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total période" value={String(totals.count)} icon={ArrowLeftRight} hint="30 derniers jours" />
        <KpiCard label="Réussies" value={String(totals.success)} icon={CheckCircle2} delta={2.1} hint="vs sem. -1" />
        <KpiCard label="En attente" value={String(totals.pending)} icon={Clock} hint="à traiter" />
        <KpiCard label="À investiguer" value={String(totals.flagged)} icon={AlertTriangle} delta={-12.3} />
      </div>

      <div className="mt-6">
        <SectionCard
          title={`${tx.length} transactions`}
          action={<DataTableFilters placeholder="Référence, contrepartie, IBAN…" />}
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Référence</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Contrepartie</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Canal</th>
                  <th className="px-5 py-3 font-medium">Pays</th>
                  <th className="px-5 py-3 font-medium">Risque</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {tx.slice(0, 40).map((t) => (
                  <tr key={t.id} className="border-b hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">
                      <Link to="/transactions/$id" params={{ id: t.id }} className="hover:text-[var(--success)]">{t.id}</Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(t.date)}</td>
                    <td className="px-5 py-3">{t.counterparty}</td>
                    <td className="px-5 py-3 text-muted-foreground">{t.type}</td>
                    <td className="px-5 py-3 text-muted-foreground">{t.channel}</td>
                    <td className="px-5 py-3 text-muted-foreground">{t.country}</td>
                    <td className="px-5 py-3">
                      <RiskBar value={t.risk} />
                    </td>
                    <td className="px-5 py-3"><StatusBadge value={t.status} /></td>
                    <td className="px-5 py-3 text-right tabular font-medium">{formatMoney(t.amount, t.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
            <span>Affichage 1–40 sur {tx.length}</span>
            <div className="flex items-center gap-1">
              <button className="rounded-md border px-2 py-1 hover:bg-muted">Précédent</button>
              <button className="rounded-md border bg-[var(--navy)] px-2 py-1 text-white">1</button>
              <button className="rounded-md border px-2 py-1 hover:bg-muted">2</button>
              <button className="rounded-md border px-2 py-1 hover:bg-muted">3</button>
              <button className="rounded-md border px-2 py-1 hover:bg-muted">Suivant</button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function RiskBar({ value }: { value: number }) {
  const color = value >= 70 ? "var(--danger)" : value >= 40 ? "var(--warning)" : "var(--success)";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="tabular text-xs text-muted-foreground">{value}</span>
    </div>
  );
}