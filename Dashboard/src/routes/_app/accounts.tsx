import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { DataTableFilters } from "@/components/app/data-table-filters";
import { KpiCard } from "@/components/app/kpi-card";
import { ACCOUNTS } from "@/lib/mock/data";
import { formatMoney } from "@/lib/format";
import { Wallet, TrendingUp, Snowflake, Banknote } from "lucide-react";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/accounts")({
  head: () => ({ meta: [{ title: "Comptes — Northwind Bank" }] }),
  component: AccountsPage,
});

function AccountsPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={4} maxWidth={1480} />;
  const total = ACCOUNTS.reduce((s, a) => s + a.balance, 0);
  const active = ACCOUNTS.filter((a) => a.status === "active").length;
  const frozen = ACCOUNTS.filter((a) => a.status === "frozen").length;
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader title="Comptes" description="Tous les comptes ouverts dans la banque." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total comptes" value={String(ACCOUNTS.length)} icon={Wallet} />
        <KpiCard label="Encours total" value={formatMoney(total, "EUR")} icon={Banknote} delta={3.4} />
        <KpiCard label="Actifs" value={String(active)} icon={TrendingUp} />
        <KpiCard label="Gelés" value={String(frozen)} icon={Snowflake} />
      </div>
      <div className="mt-6">
        <SectionCard action={<DataTableFilters placeholder="IBAN, client…" />} bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Compte</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Devise</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 text-right font-medium">Solde</th>
              </tr>
            </thead>
            <tbody>
              {ACCOUNTS.slice(0, 30).map((a) => (
                <tr key={a.id} className="border-b hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <Link to="/accounts/$id" params={{ id: a.id }} className="font-medium hover:text-[var(--success)]">{a.id}</Link>
                    <div className="tabular text-xs text-muted-foreground">{a.iban}</div>
                  </td>
                  <td className="px-5 py-3">{a.customer}</td>
                  <td className="px-5 py-3 text-muted-foreground">{a.type}</td>
                  <td className="px-5 py-3 text-muted-foreground">{a.currency}</td>
                  <td className="px-5 py-3"><StatusBadge value={a.status} /></td>
                  <td className="px-5 py-3 text-right tabular font-medium">{formatMoney(a.balance, a.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}