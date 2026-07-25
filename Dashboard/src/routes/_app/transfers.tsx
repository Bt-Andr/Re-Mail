import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { KpiCard } from "@/components/app/kpi-card";
import { TRANSACTIONS, TOP_CORRIDORS } from "@/lib/mock/data";
import { formatMoney, formatDate, formatCompact } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Send, Zap, Globe, Building2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/transfers")({
  head: () => ({ meta: [{ title: "Virements — Northwind Bank" }] }),
  component: TransfersPage,
});

function TransfersPage() {
  const sepa = TRANSACTIONS.filter((t) => t.type === "transfer").slice(0, 15);
  const swift = TRANSACTIONS.filter((t) => t.type === "swift").slice(0, 15);
  const instant = TRANSACTIONS.filter((t) => t.channel === "mobile").slice(0, 15);

  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        title="Virements"
        description="Pilotage des virements SEPA, SWIFT et instantanés."
        actions={<Button><Send className="mr-2 h-4 w-4" /> Initier un virement</Button>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Virements 24h" value="3 842" icon={Send} delta={4.8} />
        <KpiCard label="SEPA Instant" value="1 920" icon={Zap} delta={11.2} hint="< 10 sec" />
        <KpiCard label="SWIFT internationaux" value="216" icon={Globe} delta={-2.1} />
        <KpiCard label="Inter-comptes" value="704" icon={Building2} delta={0.3} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard bodyClassName="p-0">
            <Tabs defaultValue="sepa" className="w-full">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <TabsList>
                  <TabsTrigger value="sepa">SEPA</TabsTrigger>
                  <TabsTrigger value="swift">SWIFT</TabsTrigger>
                  <TabsTrigger value="instant">Instant</TabsTrigger>
                </TabsList>
              </div>
              {[
                { v: "sepa", data: sepa },
                { v: "swift", data: swift },
                { v: "instant", data: instant },
              ].map(({ v, data }) => (
                <TabsContent key={v} value={v} className="m-0 animate-fade-in-up">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-medium">Référence</th>
                        <th className="px-5 py-3 font-medium">Bénéficiaire</th>
                        <th className="px-5 py-3 font-medium">Date</th>
                        <th className="px-5 py-3 font-medium">Statut</th>
                        <th className="px-5 py-3 text-right font-medium">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((t) => (
                        <tr key={t.id} className="border-b hover:bg-muted/30">
                          <td className="px-5 py-3 tabular">{t.reference}</td>
                          <td className="px-5 py-3">{t.counterparty}</td>
                          <td className="px-5 py-3 text-muted-foreground">{formatDate(t.date)}</td>
                          <td className="px-5 py-3"><StatusBadge value={t.status} /></td>
                          <td className="px-5 py-3 text-right tabular font-medium">{formatMoney(t.amount, t.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TabsContent>
              ))}
            </Tabs>
          </SectionCard>
        </div>

        <SectionCard title="Top corridors" description="Volume sur 30 jours">
          <ul className="space-y-3">
            {TOP_CORRIDORS.map((c) => (
              <li key={c.flag} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                <div>
                  <div className="flex items-center gap-1.5 font-medium">
                    {c.from} <ArrowRight className="h-3 w-3 text-muted-foreground" /> {c.to}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.count} transactions</div>
                </div>
                <span className="tabular font-semibold">{formatCompact(c.volume)} €</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}