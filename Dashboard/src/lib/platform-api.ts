export const PLATFORM_API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const TOKEN_KEY = "re_mail_platform_token";
export type PlatformOrganization = { id:string; name:string; companyName:string|null; slug:string; isPersonal:boolean; resendVerifiedDomain:string|null; resendConnectedAt:string|null; createdAt:string; _count:{users:number;threads:number;mailRoutes:number;externalMailboxConnections:number} };
export type PlatformUser = { id:string; email:string; username:string; nom:string; orgRole:string; createdAt:string; organization:{id:string;name:string;isPersonal:boolean} };
export type PlatformSummary = { organizations:number; users:number; threads:number; connectedResend:number; externalMailboxes:number };
export type Paginated<T> = { items:T[]; total:number; page:number; pageSize:number };
export type PlatformOrganizationDetail = Omit<PlatformOrganization,"_count"> & { emailContact:string|null; updatedAt:string; users:Array<Omit<PlatformUser,"organization">>; mailRoutes:Array<{id:string;alias:string;personalEmail:string;displayName:string|null;active:boolean;createdAt:string}>; externalMailboxConnections:Array<{id:string;email:string;provider:string;status:string;lastError:string|null;lastPolledAt:string|null;createdAt:string}>; _count:{threads:number;threadMessages:number;userInvites:number} };
export function savePlatformToken(token:string){ localStorage.setItem(TOKEN_KEY, token); }
export function hasPlatformToken(){ return typeof window !== "undefined" && Boolean(localStorage.getItem(TOKEN_KEY)); }
export function clearPlatformSession(){ if(typeof window!=="undefined") localStorage.removeItem(TOKEN_KEY); }
export async function platformRequest<T>(path:string, init:RequestInit={}):Promise<T>{
  const token=typeof window!=="undefined"?localStorage.getItem(TOKEN_KEY):null;
  const response=await fetch(`${PLATFORM_API_URL}${path}`,{...init,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{ }),...init.headers}});
  const body=await response.json().catch(()=>({}));
  if(response.status===401||response.status===403){ clearPlatformSession(); if(typeof window!=="undefined"&&window.location.pathname!=="/login") window.location.assign("/login"); }
  if(!response.ok) throw new Error(body.error||"Erreur API plateforme");
  return body as T;
}
