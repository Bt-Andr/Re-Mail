import { Resend } from 'resend'

// Contrairement à un client Resend global unique, chaque organisation a sa propre
// clé API : on construit un client à la demande à partir de la clé déchiffrée de
// l'org courante, jamais un singleton partagé entre tenants.
export function buildResendClient(apiKey: string): Resend {
  return new Resend(apiKey)
}
