import type { PrismaClient } from '@prisma/client'

export interface SenderAddress {
  email: string
  label: string
  isDefault: boolean
}

// Adresses d'expédition autorisées pour un utilisateur au sein de SON organisation :
// - son adresse pro personnelle (proEmail), si renseignée — expéditeur par défaut
// - tous les alias @domaine (MailRoute) de l'org s'il est OWNER/ADMIN
// - sinon, uniquement les alias sur lesquels il a une autorisation explicite (SenderGrant)
//
// Contrairement à la référence jeprogroup-website (adresses de service fixes
// contact/rh/commercial liées à des rôles métier codés en dur), ce produit générique
// n'a pas de départements prédéfinis : les alias disponibles sont ceux que l'organisation
// a elle-même créés dans sa configuration Mail Routes.
export async function getAllowedSenders(db: PrismaClient, userId: string): Promise<SenderAddress[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      nom: true,
      proEmail: true,
      orgRole: true,
      organization: { select: { companyName: true, resendVerifiedDomain: true } },
      senderGrants: { select: { email: true } },
    },
  })
  if (!user) return []

  const senders: SenderAddress[] = []
  const add = (email: string, label: string, isDefault = false) => {
    if (!email) return
    if (senders.some(s => s.email.toLowerCase() === email.toLowerCase())) return
    senders.push({ email, label, isDefault })
  }

  const orgLabel = user.organization?.companyName || ''
  if (user.proEmail) add(user.proEmail, orgLabel ? `${user.nom} | ${orgLabel}` : user.nom, true)

  const routes = await db.mailRoute.findMany({ where: { active: true } })

  if (user.orgRole === 'OWNER' || user.orgRole === 'ADMIN') {
    for (const route of routes) {
      add(route.alias, route.displayName || route.alias)
    }
  } else {
    for (const grant of user.senderGrants) {
      const route = routes.find(r => r.alias.toLowerCase() === grant.email.toLowerCase())
      add(grant.email, route?.displayName || grant.email)
    }
  }

  const mailboxes = await db.externalMailboxConnection.findMany({
    where: { userId, status: 'connected' },
    select: { email: true },
  })
  for (const mailbox of mailboxes) add(mailbox.email, mailbox.email)

  // Adresses pro attribuées ET connectées (claimedAt) — le gate sur claimedAt évite
  // qu'une adresse attribuée mais pas encore "connectée" par la personne n'apparaisse
  // comme expéditeur possible, même logique que les boîtes externes ci-dessus qui
  // exigent status: 'connected'.
  if (user.organization?.resendVerifiedDomain) {
    const proRules = await db.threadRoutingRule.findMany({
      where: { assignToId: userId, active: true, claimedAt: { not: null } },
    })
    for (const rule of proRules) add(`${rule.canal}@${user.organization.resendVerifiedDomain}`, rule.canal)
  }

  if (senders.length > 0 && !senders.some(s => s.isDefault)) senders[0].isDefault = true
  return senders
}
