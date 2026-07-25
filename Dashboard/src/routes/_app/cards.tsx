import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { KpiCard } from "@/components/app/kpi-card";
import { CUSTOMERS } from "@/lib/mock/data";
import { Button } from "@/components/ui/button";
import { CreditCard, Wifi, Plus, Lock, Snowflake } from "lucide-react";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/cards")({
  head: () => ({ meta: [{ title: "Cartes — Northwind Bank" }] }),
  component: CardsPage,
});

const CARDS = CUSTOMERS.slice(0, 12).map((c, i) => ({
  id: `CRD-${4000 + i}`,
  holder: c.name,
  customerId: c.id,
  scheme: i % 3 === 0 ? "Visa" : i % 3 === 1 ? "Mastercard" : "Amex",
  type: i % 2 === 0 ? "Débit" : "Crédit",
  last4: String(1000 + i * 137).slice(-4),
  status: i % 7 === 0 ? "frozen" : i % 11 === 0 ? "closed" : "active",
  monthly: Math.round(Math.random() * 5000 + 200),
  limit: 8000,
}));

export function CardsPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={4} maxWidth={1480} />;
  const active = CARDS.filter((c) => c.status === "active").length;
  const frozen = CARDS.filter((c) => c.status === "frozen").length;
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        title="Cartes"
        description="Émission, plafonds et gestion des cartes bancaires."
        actions={<Button><Plus className="mr-2 h-4 w-4" /> Émettre une carte</Button>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Cartes émises" value={String(CARDS.length)} icon={CreditCard} />
        <KpiCard label="Actives" value={String(active)} icon={Wifi} delta={1.2} />
        <KpiCard label="Gelées" value={String(frozen)} icon={Snowflake} />
        <KpiCard label="Volume mensuel" value="1,42M €" icon={CreditCard} delta={3.4} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {CARDS.slice(0, 6).map((c) => (
          <div key={c.id} className="rounded-2xl border bg-[var(--navy)] p-5 text-[var(--navy-foreground)]">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/60">{c.scheme} · {c.type}</span>
              <Wifi className="h-4 w-4 text-white/70" />
            </div>
            <p className="mt-8 tabular text-lg font-medium">•••• •••• •••• {c.last4}</p>
            <div className="mt-6 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-white/60">Titulaire</p>
                <p className="text-sm font-medium">{c.holder}</p>
              </div>
              <StatusBadge value={c.status} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <SectionCard title="Toutes les cartes" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Carte</th>
                <th className="px-5 py-3 font-medium">Titulaire</th>
                <th className="px-5 py-3 font-medium">Réseau</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 text-right font-medium">Conso mensuelle</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {CARDS.map((c) => (
                <tr key={c.id} className="border-b hover:bg-muted/30">
                  <td className="px-5 py-3 tabular">{c.id} · •••{c.last4}</td>
                  <td className="px-5 py-3">{c.holder}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.scheme} {c.type}</td>
                  <td className="px-5 py-3"><StatusBadge value={c.status} /></td>
                  <td className="px-5 py-3 text-right tabular">{c.monthly} € / {c.limit} €</td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost"><Lock className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}