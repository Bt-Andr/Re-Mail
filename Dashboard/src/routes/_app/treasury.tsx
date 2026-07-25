import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { KpiCard } from "@/components/app/kpi-card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { Banknote, TrendingUp, ShieldCheck, Wallet } from "lucide-react";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/treasury")({
  head: () => ({ meta: [{ title: "Trésorerie — Northwind Bank" }] }),
  component: TreasuryPage,
});

const LIQUIDITY = Array.from({ length: 30 }, (_, i) => ({
  d: `J-${29 - i}`,
  hqla: 1200 + Math.sin(i / 3) * 80 + i * 2,
  outflows: 900 + Math.cos(i / 4) * 60,
}));

const POSITIONS = [
  { devise: "EUR", net: 482, change: "—" },
  { devise: "USD", net: 124, change: "1,0820" },
  { devise: "GBP", net: 38, change: "0,8540" },
  { devise: "XOF", net: 220, change: "655,96" },
  { devise: "JPY", net: -42, change: "162,30" },
];

function TreasuryPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={4} withChart maxWidth={1480} />;
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader title="Trésorerie" description="Liquidité, ratios prudentiels et positions de change." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="HQLA" value="€ 1,28 Md" icon={Wallet} delta={1.2} />
        <KpiCard label="Ratio LCR" value="142 %" icon={ShieldCheck} delta={2.4} hint="Min. 100 %" />
        <KpiCard label="NSFR" value="118 %" icon={TrendingUp} delta={0.6} />
        <KpiCard label="Coût refi." value="3,42 %" icon={Banknote} delta={-0.1} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Liquidité HQLA vs sorties nettes" description="30 derniers jours, en M€">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={LIQUIDITY}>
                  <defs>
                    <linearGradient id="hqla" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="out" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--warning)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="d" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                  <Area type="monotone" dataKey="hqla" stroke="var(--brand)" fill="url(#hqla)" strokeWidth={2} />
                  <Area type="monotone" dataKey="outflows" stroke="var(--warning)" fill="url(#out)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Positions de change" description="Net en M€" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Devise</th>
                <th className="px-5 py-3 font-medium">Cours</th>
                <th className="px-5 py-3 text-right font-medium">Position</th>
              </tr>
            </thead>
            <tbody>
              {POSITIONS.map((p) => (
                <tr key={p.devise} className="border-b">
                  <td className="px-5 py-3 font-medium">{p.devise}</td>
                  <td className="px-5 py-3 tabular text-muted-foreground">{p.change}</td>
                  <td className={`px-5 py-3 text-right tabular font-medium ${p.net < 0 ? "text-[var(--danger)]" : ""}`}>
                    {p.net > 0 ? "+" : ""}{p.net}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Flux de trésorerie projetés" description="14 jours">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={LIQUIDITY.slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="d" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                <Bar dataKey="hqla" fill="var(--navy)" name="Entrées" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outflows" fill="var(--info)" name="Sorties" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}