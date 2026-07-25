import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { FileBarChart, FileText, Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Rapports — Northwind Bank" }] }),
  component: ReportsPage,
});

const REPORTS = [
  { id: "RPT-2024-06", name: "Reporting prudentiel COREP", period: "Juin 2026", size: "4,2 Mo", format: "XBRL" },
  { id: "RPT-AML-06", name: "Déclarations TRACFIN", period: "Juin 2026", size: "812 ko", format: "PDF" },
  { id: "RPT-IFRS9", name: "Provisions IFRS 9", period: "Q2 2026", size: "2,1 Mo", format: "XLSX" },
  { id: "RPT-LIQ", name: "Ratio LCR quotidien", period: "31 mai 2026", size: "126 ko", format: "CSV" },
  { id: "RPT-FATCA", name: "FATCA / CRS", period: "Annuel 2025", size: "8,4 Mo", format: "XML" },
  { id: "RPT-PNB", name: "Produit net bancaire", period: "Mai 2026", size: "640 ko", format: "PDF" },
];

const PNB = [
  { mois: "Jan", commissions: 1.2, marge: 2.8, divers: 0.4 },
  { mois: "Fév", commissions: 1.3, marge: 2.6, divers: 0.5 },
  { mois: "Mar", commissions: 1.5, marge: 3.1, divers: 0.4 },
  { mois: "Avr", commissions: 1.4, marge: 2.9, divers: 0.6 },
  { mois: "Mai", commissions: 1.6, marge: 3.3, divers: 0.5 },
  { mois: "Juin", commissions: 1.8, marge: 3.5, divers: 0.7 },
];

function ReportsPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={4} maxWidth={1480} />;
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader title="Rapports" description="Rapports réglementaires, financiers et exports comptables." actions={<Button>Nouveau rapport</Button>} />

      <SectionCard title="Produit net bancaire" description="En millions d'€ — 6 derniers mois">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={PNB}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
              <Bar dataKey="marge" stackId="a" fill="var(--navy)" name="Marge nette" />
              <Bar dataKey="commissions" stackId="a" fill="var(--brand)" name="Commissions" />
              <Bar dataKey="divers" stackId="a" fill="var(--info)" name="Divers" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="mt-6">
        <SectionCard title="Rapports disponibles" bodyClassName="p-0">
          <ul className="divide-y">
            {REPORTS.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--success)]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.id} · {r.period} · {r.size}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-md border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{r.format}</span>
                  <Button variant="outline" size="sm"><Download className="mr-1.5 h-3.5 w-3.5" /> Télécharger</Button>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}