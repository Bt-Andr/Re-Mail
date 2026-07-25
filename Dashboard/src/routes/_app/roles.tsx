import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { ROLES } from "@/lib/role-context";
import { Check, X } from "lucide-react";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/roles")({
  head: () => ({ meta: [{ title: "Rôles & permissions — Northwind Bank" }] }),
  component: RolesPage,
});

const AREAS = [
  { key: "transactions", label: "Voir transactions" },
  { key: "transactions.approve", label: "Approuver SWIFT > 100k€" },
  { key: "accounts", label: "Voir comptes" },
  { key: "accounts.freeze", label: "Geler un compte" },
  { key: "compliance", label: "Module conformité" },
  { key: "compliance.kyc", label: "Valider un KYC" },
  { key: "risk", label: "Module risque" },
  { key: "audit", label: "Journal d'audit" },
  { key: "reports", label: "Export rapports" },
  { key: "users", label: "Gérer utilisateurs" },
  { key: "settings", label: "Paramètres système" },
];

const MATRIX: Record<string, string[]> = {
  admin: AREAS.map((a) => a.key),
  operations: ["transactions", "accounts", "accounts.freeze"],
  compliance: ["compliance", "compliance.kyc", "transactions", "audit"],
  audit: ["audit", "reports", "transactions", "accounts"],
  support: ["accounts", "transactions"],
  risk: ["risk", "transactions", "compliance"],
  finance: ["reports", "transactions", "accounts"],
};

function RolesPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={0} maxWidth={1280} />;
  return (
    <div className="mx-auto max-w-[1480px]">
      <PageHeader title="Rôles & permissions" description="Matrice RBAC du back-office." />
      <SectionCard bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Permission</th>
                {ROLES.map((r) => (
                  <th key={r.id} className="px-3 py-3 text-center font-medium">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AREAS.map((a) => (
                <tr key={a.key} className="border-b">
                  <td className="px-5 py-3 font-medium">{a.label}</td>
                  {ROLES.map((r) => {
                    const ok = MATRIX[r.id]?.includes(a.key);
                    return (
                      <td key={r.id} className="px-3 py-3 text-center">
                        {ok ? (
                          <Check className="mx-auto h-4 w-4 text-[var(--success)]" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}