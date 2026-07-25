import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  ShieldAlert,
  UserPlus,
  Activity,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  KpiRowSkeleton,
  ChartSkeleton,
  TableSkeleton,
  ListSkeleton,
  PageHeaderSkeleton,
} from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";
import {
  TRANSACTIONS,
  ALERTS,
  txVolumeSeries,
  CHANNEL_BREAKDOWN,
  TX_TYPE_BREAKDOWN,
  kycMonthlySeries,
  heatmapData,
  FUNNEL_DATA,
  TOP_CORRIDORS,
} from "@/lib/mock/data";
import { formatCompact, formatMoney, relativeTime } from "@/lib/format";
import { useRole, ROLES } from "@/lib/role-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Northwind Bank" },
      { name: "description", content: "Vue d'ensemble back-office bancaire : transactions, alertes, KYC, trésorerie." },
    ],
  }),
  component: Overview,
});

function OverviewSkeleton() {
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeaderSkeleton />
      <KpiRowSkeleton count={4} />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Volume entrées vs sorties" bodyClassName="p-0">
            <ChartSkeleton height={300} />
          </SectionCard>
        </div>
        <SectionCard title="Répartition par type">
          <ChartSkeleton height={240} />
        </SectionCard>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Transactions par canal"><ChartSkeleton height={240} /></SectionCard>
        <SectionCard title="Évolution KYC"><ChartSkeleton height={240} /></SectionCard>
        <SectionCard title="Performance opérationnelle"><ChartSkeleton height={240} /></SectionCard>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Dernières transactions" bodyClassName="p-0">
            <TableSkeleton rows={6} cols={5} />
          </SectionCard>
        </div>
        <SectionCard title="Alertes prioritaires" bodyClassName="p-0">
          <ListSkeleton rows={5} />
        </SectionCard>
      </div>
    </div>
  );
}

function Overview() {
  const isLoading = useMountLoading(700);
  const { role } = useRole();
  const roleLabel = ROLES.find((r) => r.id === role)?.label ?? "";
  const series = txVolumeSeries(30);
  const kyc = kycMonthlySeries();
  const heat = heatmapData();
  const recentTx = TRANSACTIONS.slice(0, 6);
  const topAlerts = [...ALERTS].sort((a, b) => sevWeight(b.severity) - sevWeight(a.severity)).slice(0, 5);

  const slaGauge = [{ name: "SLA", value: 96.4, fill: "var(--brand)" }];
  const uptimeGauge = [{ name: "Uptime", value: 99.97, fill: "var(--info)" }];

  if (isLoading) return <OverviewSkeleton />;

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        title={`Bonjour Amina — vue ${roleLabel}`}
        description="Synthèse des opérations bancaires des dernières 24 heures."
        actions={
          <>
            <Button variant="outline" className="h-10 rounded-lg border-border bg-card">Exporter</Button>
            <Button className="h-10 rounded-lg bg-[var(--brand)] text-[var(--navy)] font-semibold hover:bg-[var(--brand)]/90">
              Nouveau virement
            </Button>
          </>
        }
      />

      {/* KPI ROW */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Volume transactions (24h)"
          value={formatMoney(2_847_320, "EUR")}
          delta={12.4}
          hint="vs hier"
          icon={ArrowLeftRight}
        />
        <KpiCard
          label="Nouveaux comptes"
          value="148"
          delta={4.2}
          hint="vs semaine passée"
          icon={UserPlus}
        />
        <KpiCard
          label="Alertes ouvertes"
          value="27"
          delta={-8.6}
          hint="dont 4 critiques"
          icon={ShieldAlert}
        />
        <KpiCard
          label="Taux de réussite paiements"
          value="98.7 %"
          delta={0.3}
          hint="cible 98 %"
          icon={Activity}
        />
      </div>

      {/* CHART ROW 1 */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Volume entrées vs sorties"
          description="Flux quotidiens des 30 derniers jours (EUR)"
          action={
            <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5 text-xs">
              {["7j", "30j", "90j", "1a"].map((p, i) => (
                <button
                  key={p}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium",
                    i === 1 ? "bg-[var(--navy)] text-white" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          }
          bodyClassName="p-0"
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={series} margin={{ top: 20, right: 24, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--navy)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--navy)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => formatCompact(v as number)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => formatMoney(v, "EUR")}
              />
              <Area type="monotone" dataKey="in" stroke="var(--brand)" strokeWidth={2} fill="url(#gIn)" name="Entrées" />
              <Area type="monotone" dataKey="out" stroke="var(--navy)" strokeWidth={2} fill="url(#gOut)" name="Sorties" />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Répartition par type" description="Transactions des 30 derniers jours">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={TX_TYPE_BREAKDOWN}
                dataKey="value"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                strokeWidth={0}
              >
                {TX_TYPE_BREAKDOWN.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => `${v} %`}
              />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-2 space-y-1.5 text-xs">
            {TX_TYPE_BREAKDOWN.map((s) => (
              <li key={s.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="tabular font-medium text-muted-foreground">{s.value} %</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* CHART ROW 2 */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Transactions par canal" description="Volume mensuel par origine">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={CHANNEL_BREAKDOWN} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="channel" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => formatCompact(v as number)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {CHANNEL_BREAKDOWN.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Évolution KYC" description="12 derniers mois — par statut">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={kyc} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="verified" stackId="a" fill="var(--brand)" radius={[0, 0, 0, 0]} name="Vérifiés" />
              <Bar dataKey="pending" stackId="a" fill="var(--warning)" name="En attente" />
              <Bar dataKey="rejected" stackId="a" fill="var(--danger)" radius={[6, 6, 0, 0]} name="Refusés" />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Performance opérationnelle" description="SLA support & uptime systèmes">
          <div className="grid grid-cols-2 gap-3">
            <Gauge value={96.4} label="SLA support" color="var(--brand)" />
            <Gauge value={99.97} label="Uptime API" color="var(--info)" decimals={2} />
          </div>
        </SectionCard>
      </div>

      {/* CHART ROW 3 — Heatmap + Funnel + Net line */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Activité par jour & heure" description="Densité des transactions sur 7 jours">
          <Heatmap data={heat} />
        </SectionCard>

        <SectionCard title="Funnel d'onboarding" description="Inscription → 1er dépôt">
          <ResponsiveContainer width="100%" height={260}>
            <FunnelChart>
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => formatCompact(v)}
              />
              <Funnel dataKey="value" data={FUNNEL_DATA} isAnimationActive>
                <LabelList position="right" fill="var(--foreground)" stroke="none" dataKey="stage" fontSize={11} />
                {FUNNEL_DATA.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* TABLES ROW */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Dernières transactions"
          description="Mise à jour temps réel"
          action={
            <Link to="/transactions" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--success)] hover:underline">
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Référence</th>
                  <th className="px-5 py-3 font-medium">Contrepartie</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <Link to="/transactions/$id" params={{ id: t.id }} className="font-medium text-foreground hover:text-[var(--success)]">
                        {t.id}
                      </Link>
                      <div className="text-xs text-muted-foreground">{relativeTime(t.date)}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium">{t.counterparty}</div>
                      <div className="text-xs text-muted-foreground">{t.country} · {t.channel}</div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{txTypeLabel(t.type)}</td>
                    <td className="px-5 py-3"><StatusBadge value={t.status} /></td>
                    <td className="px-5 py-3 text-right tabular font-medium">{formatMoney(t.amount, t.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Alertes prioritaires"
          description="Triées par sévérité"
          action={
            <Link to="/risk" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--success)] hover:underline">
              Centre de risque <ArrowRight className="h-3 w-3" />
            </Link>
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y">
            {topAlerts.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                <div className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  a.severity === "critical" ? "bg-[var(--danger-soft)] text-[var(--danger)]" :
                  a.severity === "high" ? "bg-[var(--warning-soft)] text-[var(--warning)]" :
                  "bg-[var(--info-soft)] text-[var(--info)]"
                )}>
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{a.reason}</span>
                    <StatusBadge value={a.severity} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {a.customer} · {relativeTime(a.date)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* CORRIDORS */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Top corridors de virements"
          description="Volume par couloir géographique sur 30 jours"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TOP_CORRIDORS.map((c) => {
              const max = TOP_CORRIDORS[0].volume;
              const pct = (c.volume / max) * 100;
              return (
                <div key={c.flag} className="rounded-xl border bg-card p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.from} → {c.to}</span>
                    <span className="tabular text-xs text-muted-foreground">{c.count} tx</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="tabular text-sm font-semibold">{formatCompact(c.volume)} €</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Flux net journalier" description="Différentiel entrées - sorties">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series.slice(-14)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(8)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => formatCompact(v as number)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={45} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => formatMoney(v, "EUR")} />
              <Line type="monotone" dataKey="net" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--brand)" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

function Gauge({ value, label, color, decimals = 1 }: { value: number; label: string; color: string; decimals?: number }) {
  return (
    <div className="relative flex flex-col items-center">
      <ResponsiveContainer width="100%" height={140}>
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value, fill: color }]} startAngle={210} endAngle={-30}>
          <RadialBar background={{ fill: "var(--muted)" }} dataKey="value" cornerRadius={20} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="-mt-20 text-center">
        <div className="tabular text-2xl font-semibold">{value.toFixed(decimals)}%</div>
      </div>
      <div className="mt-14 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Heatmap({ data }: { data: { day: string; hour: number; value: number }[] }) {
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  return (
    <div className="space-y-1">
      <div className="flex pl-9">
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
            {h % 3 === 0 ? `${h}h` : ""}
          </div>
        ))}
      </div>
      {days.map((d) => (
        <div key={d} className="flex items-center gap-1">
          <span className="w-8 text-[10px] font-medium text-muted-foreground">{d}</span>
          <div className="flex flex-1 gap-0.5">
            {data.filter((c) => c.day === d).map((c) => (
              <div
                key={c.hour}
                title={`${d} ${c.hour}h — ${c.value}%`}
                className="h-6 flex-1 rounded-[3px]"
                style={{
                  background: `color-mix(in oklab, var(--brand) ${c.value}%, var(--muted))`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-end gap-2 pt-2 text-[10px] text-muted-foreground">
        Faible
        <div className="flex gap-0.5">
          {[10, 30, 50, 70, 90].map((v) => (
            <div key={v} className="h-3 w-4 rounded-[2px]" style={{ background: `color-mix(in oklab, var(--brand) ${v}%, var(--muted))` }} />
          ))}
        </div>
        Élevé
      </div>
    </div>
  );
}

function sevWeight(s: string) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s as "critical"] ?? 0;
}

function txTypeLabel(t: string) {
  return ({
    transfer: "Virement SEPA",
    card: "Paiement carte",
    direct_debit: "Prélèvement",
    swift: "Virement SWIFT",
    fx: "Change FX",
    deposit: "Dépôt",
  } as Record<string, string>)[t] ?? t;
}