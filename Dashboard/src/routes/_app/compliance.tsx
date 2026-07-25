import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { KpiCard } from "@/components/app/kpi-card";
import { ALERTS, CUSTOMERS, kycMonthlySeries } from "@/lib/mock/data";
import { formatDateShort, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, FileSearch, FileWarning } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/compliance")({
  head: () => ({ meta: [{ title: "Conformité — Northwind Bank" }] }),
  component: CompliancePage,
});

function CompliancePage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={4} withChart maxWidth={1480} />;
  const kycQueue = CUSTOMERS.filter((c) => c.kyc === "pending" || c.kyc === "review").slice(0, 12);
  const alerts = ALERTS.filter((a) => a.type === "aml" || a.type === "sanction" || a.type === "kyc").slice(0, 10);
  const kycData = kycMonthlySeries();

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        title="Conformité KYC / AML"
        description="File d'attente, alertes AML et écrans de sanctions."
        actions={<Button>Lancer un screening</Button>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="KYC à traiter" value={String(kycQueue.length)} icon={FileSearch} hint="Délai moyen 18 min" />
        <KpiCard label="Alertes AML ouvertes" value={String(alerts.filter((a) => a.status === "open").length)} icon={ShieldAlert} delta={-4.2} />
        <KpiCard label="Hits sanctions" value="6" icon={FileWarning} delta={1.0} />
        <KpiCard label="Taux conformité" value="98,7 %" icon={ShieldCheck} delta={0.3} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="KYC par statut" description="12 derniers mois">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kycData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="verified" stackId="a" fill="var(--brand)" name="Validés" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pending" stackId="a" fill="var(--warning)" name="En attente" />
                  <Bar dataKey="rejected" stackId="a" fill="var(--danger)" name="Refusés" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="File KYC" description="À traiter en priorité" bodyClassName="p-0">
          <ul className="divide-y">
            {kycQueue.slice(0, 8).map((c) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.id} · depuis {formatDateShort(c.joined)}</div>
                </div>
                <StatusBadge value={c.kyc} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Alertes AML & sanctions" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Alerte</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Sévérité</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Ouverte</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-b hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="font-medium">{a.id}</div>
                    <div className="text-xs text-muted-foreground">{a.reason}</div>
                  </td>
                  <td className="px-5 py-3">{a.customer}</td>
                  <td className="px-5 py-3 uppercase text-muted-foreground">{a.type}</td>
                  <td className="px-5 py-3"><StatusBadge value={a.severity} /></td>
                  <td className="px-5 py-3"><StatusBadge value={a.status} /></td>
                  <td className="px-5 py-3 text-muted-foreground">{relativeTime(a.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}