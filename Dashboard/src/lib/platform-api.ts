export const PLATFORM_API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const TOKEN_KEY = "re_mail_platform_token";
export type PlatformOrganization = { id:string; name:string; companyName:string|null; slug:string; isPersonal:boolean; resendVerifiedDomain:string|null; resendConnectedAt:string|null; createdAt:string; _count:{users:number;threads:number;mailRoutes:number;externalMailboxConnections:number} };
export type PlatformUser = { id:string; email:string; username:string; nom:string; orgRole:string; createdAt:string; organization:{id:string;name:string;isPersonal:boolean} };
export function savePlatformToken(token:string){ localStorage.setItem(TOKEN_KEY, token); }
export function hasPlatformToken(){ return typeof window !== "undefined" && Boolean(localStorage.getItem(TOKEN_KEY)); }
export async function platformRequest<T>(path:string, init:RequestInit={}):Promise<T>{
  const token=typeof window!=="undefined"?localStorage.getItem(TOKEN_KEY):null;
  const response=await fetch(`${PLATFORM_API_URL}${path}`,{...init,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{ }),...init.headers}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(body.error||"Erreur API plateforme");
  return body as T;
}
