import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { KpiCard } from "@/components/app/kpi-card";
import { UserCog, ShieldCheck, Users } from "lucide-react";
import { platformRequest, type PlatformUser } from "@/lib/platform-api";
export const Route = createFileRoute("/_app/users")({ component: UsersPage });
function UsersPage(){
 const [users,setUsers]=useState<PlatformUser[]>([]); const [error,setError]=useState("");
 useEffect(()=>{platformRequest<PlatformUser[]>("/platform/users").then(setUsers).catch(e=>setError(e.message));},[]);
 const managers=users.filter(u=>u.orgRole==="OWNER"||u.orgRole==="ADMIN").length;
 return <div className="mx-auto max-w-[1480px]"><PageHeader title="Utilisateurs Re-Mail" description="Vue globale en lecture seule des comptes de la plateforme."/><div className="grid grid-cols-2 gap-4 lg:grid-cols-3"><KpiCard label="Utilisateurs" value={String(users.length)} icon={UserCog}/><KpiCard label="Administrateurs d'organisation" value={String(managers)} icon={ShieldCheck}/><KpiCard label="Comptes personnels" value={String(users.filter(u=>u.organization.isPersonal).length)} icon={Users}/></div><div className="mt-6"><SectionCard bodyClassName="p-0">{error?<p className="p-5 text-sm text-destructive">{error}</p>:<table className="w-full text-sm"><thead className="border-b bg-muted/40 text-left"><tr><th className="px-5 py-3">Utilisateur</th><th className="px-5 py-3">Rôle</th><th className="px-5 py-3">Organisation</th><th className="px-5 py-3">Créé le</th></tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-b"><td className="px-5 py-3"><div className="font-medium">{u.nom}</div><div className="text-xs text-muted-foreground">{u.email}</div></td><td className="px-5 py-3">{u.orgRole}</td><td className="px-5 py-3">{u.organization.name}</td><td className="px-5 py-3">{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td></tr>)}</tbody></table>}</SectionCard></div></div>;
}
