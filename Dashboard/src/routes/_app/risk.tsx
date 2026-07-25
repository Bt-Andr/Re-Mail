import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { KpiCard } from "@/components/app/kpi-card";
import { ALERTS, TRANSACTIONS } from "@/lib/mock/data";
import { formatMoney, relativeTime } from "@/lib/format";
import { AlertTriangle, ShieldAlert, TrendingDown, Activity } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/risk")({
  head: () => ({ meta: [{ title: "Risque & Fraude — Northwind Bank" }] }),
  component: RiskPage,
});

function RiskPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={4} withChart maxWidth={1480} />;
  const fraudAlerts = ALERTS.filter((a) => a.type === "fraud" || a.type === "limit").slice(0, 12);
  const flagged = TRANSACTIONS.filter((t) => t.status === "flagged" || t.risk > 75).slice(0, 10);
  const series = Array.from({ length: 14 }, (_, i) => ({
    day: `J-${13 - i}`,
    score: Math.round(40 + Math.sin(i) * 12 + (i / 3)),
    blocked: Math.round(8 + Math.cos(i / 2) * 4 + (i % 3)),
  }));

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader title="Risque & Fraude" description="Détection en temps réel et scoring comportemental." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Alertes fraude" value={String(fraudAlerts.length)} icon={ShieldAlert} delta={5.3} />
        <KpiCard label="Tx bloquées 24h" value="42" icon={AlertTriangle} delta={-2.1} />
        <KpiCard label="Perte évitée" value="€ 384k" icon={TrendingDown} delta={12.4} />
        <KpiCard label="Score risque moyen" value="38/100" icon={Activity} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Score risque & blocages" description="14 derniers jours">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" stroke="var(--warning)" strokeWidth={2} dot={false} name="Score moyen" />
                  <Line type="monotone" dataKey="blocked" stroke="var(--danger)" strokeWidth={2} dot={false} name="Blocages" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Règles actives">
          <ul className="space-y-3 text-sm">
            {[
              { name: "Velocity > 10 tx / 5 min", state: "active" },
              { name: "Montant > 50k€ hors UE", state: "active" },
              { name: "Géo nouvelle, > 1k€", state: "active" },
              { name: "Multiples cartes même device", state: "active" },
              { name: "Pays liste FATF gris", state: "active" },
            ].map((r) => (
              <li key={r.name} className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                <span>{r.name}</span>
                <StatusBadge value="active" />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Transactions à haut risque" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Référence</th>
                <th className="px-5 py-3 font-medium">Contrepartie</th>
                <th className="px-5 py-3 font-medium">Pays</th>
                <th className="px-5 py-3 font-medium">Score</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((t) => (
                <tr key={t.id} className="border-b hover:bg-muted/30">
                  <td className="px-5 py-3 tabular">{t.reference}</td>
                  <td className="px-5 py-3">{t.counterparty}</td>
                  <td className="px-5 py-3 text-muted-foreground">{t.country}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-[var(--danger)]" style={{ width: `${t.risk}%` }} />
                      </div>
                      <span className="tabular text-xs">{t.risk}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3"><StatusBadge value={t.status} /></td>
                  <td className="px-5 py-3 text-right tabular font-medium">{formatMoney(t.amount, t.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Dernières alertes fraude" bodyClassName="p-0">
          <ul className="divide-y">
            {fraudAlerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{a.reason}</div>
                  <div className="text-xs text-muted-foreground">{a.customer} · {relativeTime(a.date)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={a.severity} />
                  <StatusBadge value={a.status} />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}