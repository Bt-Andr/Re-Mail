import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { KpiCard } from "@/components/app/kpi-card";
import { DataTableFilters } from "@/components/app/data-table-filters";
import { BO_USERS } from "@/lib/mock/data";
import { relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { UserCog, ShieldCheck, KeyRound, Plus } from "lucide-react";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/users")({
  head: () => ({ meta: [{ title: "Utilisateurs — Northwind Bank" }] }),
  component: UsersPage,
});

function UsersPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={4} maxWidth={1480} />;
  const active = BO_USERS.filter((u) => u.status === "active").length;
  const mfa = BO_USERS.filter((u) => u.mfa).length;
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader
        title="Utilisateurs back-office"
        description="Agents, agences et droits d'accès."
        actions={<Button><Plus className="mr-2 h-4 w-4" /> Inviter</Button>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Utilisateurs" value={String(BO_USERS.length)} icon={UserCog} />
        <KpiCard label="Actifs" value={String(active)} icon={ShieldCheck} />
        <KpiCard label="MFA activée" value={`${Math.round((mfa / BO_USERS.length) * 100)} %`} icon={KeyRound} />
        <KpiCard label="Verrouillés" value={String(BO_USERS.filter((u) => u.status === "locked").length)} icon={KeyRound} />
      </div>

      <div className="mt-6">
        <SectionCard action={<DataTableFilters placeholder="Nom, email, rôle…" />} bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Utilisateur</th>
                <th className="px-5 py-3 font-medium">Rôle</th>
                <th className="px-5 py-3 font-medium">Agence</th>
                <th className="px-5 py-3 font-medium">MFA</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Dernière activité</th>
              </tr>
            </thead>
            <tbody>
              {BO_USERS.map((u) => (
                <tr key={u.id} className="border-b hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-5 py-3">{u.role}</td>
                  <td className="px-5 py-3 text-muted-foreground">{u.branch}</td>
                  <td className="px-5 py-3">
                    {u.mfa ? <StatusBadge tone="success" label="Activée" /> : <StatusBadge tone="danger" label="Désactivée" />}
                  </td>
                  <td className="px-5 py-3"><StatusBadge value={u.status} /></td>
                  <td className="px-5 py-3 text-muted-foreground">{relativeTime(u.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}