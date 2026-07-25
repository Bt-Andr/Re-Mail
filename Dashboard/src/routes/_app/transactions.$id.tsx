import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, AlertTriangle, Download, RefreshCcw, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { TRANSACTIONS } from "@/lib/mock/data";
import { formatDate, formatMoney } from "@/lib/format";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/transactions/$id")({
  loader: ({ params }) => {
    const tx = TRANSACTIONS.find((t) => t.id === params.id);
    if (!tx) throw notFound();
    return { tx };
  },
  head: ({ params }) => ({ meta: [{ title: `Transaction ${params.id} — Northwind Bank` }] }),
  component: TransactionDetail,
});

function TransactionDetail() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={0} maxWidth={1280} />;
  const { tx } = Route.useLoaderData();
  const timeline = [
    { t: tx.date, label: "Transaction initiée", actor: tx.counterparty, status: "info" as const },
    { t: new Date(new Date(tx.date).getTime() + 2000).toISOString(), label: "Validation anti-fraude", actor: "Système", status: "info" as const },
    { t: new Date(new Date(tx.date).getTime() + 5200).toISOString(), label: "Vérification AML", actor: "Système", status: "info" as const },
    { t: new Date(new Date(tx.date).getTime() + 12000).toISOString(), label: tx.status === "completed" ? "Compensation réussie" : tx.status === "failed" ? "Échec compensation" : "En attente de compensation", actor: "BCE Net", status: tx.status === "completed" ? "success" as const : tx.status === "failed" ? "danger" as const : "warning" as const },
  ];

  return (
    <div className="mx-auto max-w-[1480px]">
      <Link to="/transactions" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Toutes les transactions
      </Link>
      <PageHeader
        title={`Transaction ${tx.id}`}
        description={`${tx.counterparty} · ${formatDate(tx.date)}`}
        actions={
          <>
            <Button variant="outline" className="h-10"><Download className="mr-1.5 h-4 w-4" /> Reçu PDF</Button>
            <Button variant="outline" className="h-10"><RefreshCcw className="mr-1.5 h-4 w-4" /> Rembourser</Button>
            <Button className="h-10 bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90">
              <ShieldAlert className="mr-1.5 h-4 w-4" /> Marquer suspecte
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Détails de l'opération">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <Field label="Montant" value={<span className="tabular text-2xl font-semibold">{formatMoney(tx.amount, tx.currency)}</span>} />
            <Field label="Statut" value={<StatusBadge value={tx.status} />} />
            <Field label="Type" value={tx.type} />
            <Field label="Canal" value={tx.channel} />
            <Field label="IBAN compte" value={<span className="tabular">{tx.account}</span>} />
            <Field label="Référence" value={tx.reference} />
            <Field label="Pays" value={tx.country} />
            <Field label="Score de risque" value={`${tx.risk} / 100`} />
          </dl>
        </SectionCard>

        <SectionCard title="Anti-fraude" description="Signaux détectés">
          <div className="space-y-3">
            <Signal label="Vélocité 24h" value={tx.risk > 60 ? "élevée" : "normale"} ok={tx.risk <= 60} />
            <Signal label="Liste sanctions OFAC" value="aucune correspondance" ok />
            <Signal label="Géolocalisation cohérente" value="oui" ok />
            <Signal label="Pattern de structuration" value={tx.risk > 70 ? "suspect" : "non détecté"} ok={tx.risk <= 70} />
            <Signal label="KYC contrepartie" value="vérifié" ok />
          </div>
        </SectionCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Timeline" description="Suivi pas-à-pas">
          <ol className="relative ml-3 space-y-5 border-l">
            {timeline.map((s, i) => (
              <li key={i} className="pl-5">
                <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-[var(--brand)] ring-4 ring-background" />
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">{formatDate(s.t)} · {s.actor}</div>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="Payload technique" bodyClassName="p-0">
          <pre className="overflow-x-auto rounded-b-2xl bg-[var(--navy)] p-5 text-[11px] leading-relaxed text-[var(--brand)]">
{JSON.stringify(tx, null, 2)}
          </pre>
        </SectionCard>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function Signal({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={ok ? "font-medium text-[var(--success)]" : "inline-flex items-center gap-1 font-medium text-[var(--danger)]"}>
        {!ok && <AlertTriangle className="h-3.5 w-3.5" />}
        {value}
      </span>
    </div>
  );
}