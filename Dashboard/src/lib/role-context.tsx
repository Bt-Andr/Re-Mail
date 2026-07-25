import { createContext, useContext, useState, type ReactNode } from "react";

export type Role =
  | "admin"
  | "operations"
  | "compliance"
  | "audit"
  | "support"
  | "risk"
  | "finance";

export const ROLES: { id: Role; label: string; description: string }[] = [
  { id: "admin", label: "Administrateur", description: "Accès complet" },
  { id: "operations", label: "Opérations", description: "Transactions & comptes" },
  { id: "compliance", label: "Conformité", description: "KYC, AML, sanctions" },
  { id: "audit", label: "Audit", description: "Journal & rapports" },
  { id: "support", label: "Support", description: "Tickets clients" },
  { id: "risk", label: "Risque", description: "Fraude & scoring" },
  { id: "finance", label: "Finance", description: "Reporting & trésorerie" },
];

type Ctx = { role: Role; setRole: (r: Role) => void };
const RoleCtx = createContext<Ctx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("admin");
  return <RoleCtx.Provider value={{ role, setRole }}>{children}</RoleCtx.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleCtx);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

export function canAccess(role: Role, area: string): boolean {
  const map: Record<Role, string[]> = {
    admin: ["*"],
    operations: ["overview", "transactions", "accounts", "customers", "transfers", "cards", "support", "notifications"],
    compliance: ["overview", "compliance", "customers", "audit", "notifications"],
    audit: ["overview", "audit", "reports", "transactions", "users", "notifications"],
    support: ["overview", "support", "customers", "accounts", "notifications"],
    risk: ["overview", "risk", "compliance", "transactions", "notifications"],
    finance: ["overview", "reports", "treasury", "transactions", "notifications"],
  };
  const allowed = map[role];
  return allowed.includes("*") || allowed.includes(area);
}