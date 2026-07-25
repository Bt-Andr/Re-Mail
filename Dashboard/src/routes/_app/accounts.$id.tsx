import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { ACCOUNTS, TRANSACTIONS, txVolumeSeries } from "@/lib/mock/data";
import { formatMoney, formatDate, formatDateShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/accounts/$id")({
  head: ({ params }) => ({ meta: [{ title: `Compte ${params.id} — Northwind Bank` }] }),
  component: AccountDetail,
});

function AccountDetail() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={0} withChart maxWidth={1280} />;
  const { id } = Route.useParams();
  const a = ACCOUNTS.find((x) => x.id === id);
  if (!a) throw notFound();
  const tx = TRANSACTIONS.slice(0, 10);
  const series = txVolumeSeries(30).map((d) => ({ date: d.date.slice(5), balance: a.balance + (d.net / 10) }));

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        title={`Compte ${a.id}`}
        description={a.iban}
        actions={<><Button variant="outline">Geler</Button><Button>Nouveau virement</Button></>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-[var(--navy)] p-6 text-[var(--navy-foreground)] lg:col-span-1">
          <p className="text-xs uppercase tracking-wider text-white/60">Solde disponible</p>
          <p className="mt-2 tabular text-3xl font-semibold">{formatMoney(a.balance, a.currency)}</p>
          <p className="mt-1 text-sm text-white/70">{a.currency} · {a.type}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-white/60">Titulaire</p>
              <Link to="/customers/$id" params={{ id: a.customerId }} className="hover:text-[var(--brand)]">{a.customer}</Link>
            </div>
            <div>
              <p className="text-white/60">Ouvert le</p>
              <p>{formatDateShort(a.opened)}</p>
            </div>
            <div>
              <p className="text-white/60">Statut</p>
              <StatusBadge value={a.status} />
            </div>
            <div>
              <p className="text-white/60">Devise</p>
              <p className="tabular">{a.currency}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <SectionCard title="Évolution du solde" description="30 derniers jours">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                  <Area type="monotone" dataKey="balance" stroke="var(--brand)" strokeWidth={2} fill="url(#bal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-6">
        <SectionCard title="Historique des opérations" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Référence</th>
                <th className="px-5 py-3 font-medium">Contrepartie</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((t) => (
                <tr key={t.id} className="border-b hover:bg-muted/30">
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(t.date)}</td>
                  <td className="px-5 py-3 tabular">{t.reference}</td>
                  <td className="px-5 py-3">{t.counterparty}</td>
                  <td className="px-5 py-3"><StatusBadge value={t.status} /></td>
                  <td className="px-5 py-3 text-right tabular font-medium">{formatMoney(t.amount, t.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}