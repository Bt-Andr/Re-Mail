import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Mail, MessageSquare, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { SectionCard } from "@/components/app/section-card";
import { platformRequest, type PlatformOrganization } from "@/lib/platform-api";
export const Route=createFileRoute("/_app/organizations")({component:OrganizationsPage});
function OrganizationsPage(){
 const [items,setItems]=useState<PlatformOrganization[]>([]); const [error,setError]=useState("");
 useEffect(()=>{platformRequest<PlatformOrganization[]>("/platform/organizations").then(setItems).catch(e=>setError(e.message));},[]);
 return <div className="mx-auto max-w-[1480px]"><PageHeader title="Organisations" description="État opérationnel cross-tenant, en lecture seule."/><div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><KpiCard label="Organisations" value={String(items.length)} icon={Building2}/><KpiCard label="Utilisateurs" value={String(items.reduce((n,x)=>n+x._count.users,0))} icon={Users}/><KpiCard label="Domaines Resend" value={String(items.filter(x=>x.resendConnectedAt).length)} icon={Mail}/><KpiCard label="Conversations" value={String(items.reduce((n,x)=>n+x._count.threads,0))} icon={MessageSquare}/></div><div className="mt-6"><SectionCard bodyClassName="p-0">{error?<p className="p-5 text-sm text-destructive">{error}</p>:<table className="w-full text-sm"><thead className="border-b bg-muted/40 text-left"><tr><th className="px-5 py-3">Organisation</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Utilisateurs</th><th className="px-5 py-3">Routes</th><th className="px-5 py-3">Messagerie</th></tr></thead><tbody>{items.map(x=><tr key={x.id} className="border-b"><td className="px-5 py-3"><div className="font-medium">{x.companyName||x.name}</div><div className="text-xs text-muted-foreground">{x.slug}</div></td><td className="px-5 py-3">{x.isPersonal?"Personnel":"Équipe"}</td><td className="px-5 py-3">{x._count.users}</td><td className="px-5 py-3">{x._count.mailRoutes}</td><td className="px-5 py-3">{x.resendConnectedAt?(x.resendVerifiedDomain||"Resend connecté"):`${x._count.externalMailboxConnections} externe(s)`}</td></tr>)}</tbody></table>}</SectionCard></div></div>;
}
