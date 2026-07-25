import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { KpiCard } from "@/components/app/kpi-card";
import { CUSTOMERS, ACCOUNTS, TRANSACTIONS } from "@/lib/mock/data";
import { formatMoney, formatDate, formatDateShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Wallet, ShieldCheck, AlertTriangle, ArrowLeftRight, Mail, Phone, MapPin } from "lucide-react";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/customers/$id")({
  head: ({ params }) => ({ meta: [{ title: `Client ${params.id} — Northwind Bank` }] }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={0} maxWidth={1280} />;
  const { id } = Route.useParams();
  const c = CUSTOMERS.find((x) => x.id === id);
  if (!c) throw notFound();
  const accounts = ACCOUNTS.filter((a) => a.customerId === c.id);
  const recent = TRANSACTIONS.slice(0, 8);

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        title={c.name}
        description={`${c.id} · ${c.segment} · client depuis ${formatDateShort(c.joined)}`}
        actions={
          <>
            <Button variant="outline">Geler</Button>
            <Button>Contacter</Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard label="Solde global" value={formatMoney(c.balance)} icon={Wallet} />
            <KpiCard label="Comptes" value={String(accounts.length)} icon={ArrowLeftRight} />
            <KpiCard label="KYC" value={c.kyc} icon={ShieldCheck} />
            <KpiCard label="Score risque" value={`${c.riskScore}/100`} icon={AlertTriangle} delta={c.riskScore > 50 ? -1.2 : 0.5} />
          </div>

          <SectionCard title="Comptes du client" bodyClassName="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Compte</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 text-right font-medium">Solde</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <div className="font-medium">{a.id}</div>
                      <div className="tabular text-xs text-muted-foreground">{a.iban}</div>
                    </td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">{a.type}</td>
                    <td className="px-5 py-3"><StatusBadge value={a.status} /></td>
                    <td className="px-5 py-3 text-right tabular font-medium">{formatMoney(a.balance, a.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>

          <SectionCard title="Transactions récentes" bodyClassName="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Contrepartie</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-muted/30">
                    <td className="px-5 py-3 text-muted-foreground">{formatDateShort(t.date)}</td>
                    <td className="px-5 py-3">
                      <Link to="/transactions/$id" params={{ id: t.id }} className="hover:text-[var(--success)]">{t.counterparty}</Link>
                    </td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">{t.type}</td>
                    <td className="px-5 py-3"><StatusBadge value={t.status} /></td>
                    <td className="px-5 py-3 text-right tabular font-medium">{formatMoney(t.amount, t.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Contact">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {c.email}</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {c.phone}</li>
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {c.city}, {c.country}</li>
            </ul>
          </SectionCard>

          <SectionCard title="Conformité">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">Statut KYC</dt>
              <dd><StatusBadge value={c.kyc} /></dd>
              <dt className="text-muted-foreground">Segment</dt>
              <dd className="capitalize">{c.segment}</dd>
              <dt className="text-muted-foreground">Score risque</dt>
              <dd className="tabular">{c.riskScore}/100</dd>
              <dt className="text-muted-foreground">Date d'entrée</dt>
              <dd>{formatDate(c.joined)}</dd>
            </dl>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}