import type { Resend } from 'resend'

// Gabarit HTML générique pour les notifications internes (nouveau thread assigné,
// etc.) — `companyName` est passé par l'appelant car il varie par organisation
// (pas de marque fixe comme dans la référence mono-tenant).
export function buildNotificationEmail(companyName: string, title: string, rows: { label: string; value: string }[]): string {
  const rowsHtml = rows
    .map(
      ({ label, value }, i) =>
        `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
      <td style="padding:10px 14px;font-weight:600;color:#374151;white-space:nowrap;vertical-align:top;width:36%;border-bottom:1px solid #e5e7eb;">${label}</td>
      <td style="padding:10px 14px;color:#1f2937;vertical-align:top;border-bottom:1px solid #e5e7eb;">${value}</td>
    </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);max-width:100%;">
      <tr><td style="background:#0F70B7;padding:22px 32px;">
        <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${companyName}</p>
        <p style="margin:5px 0 0;color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;">Notification interne</p>
      </td></tr>
      <tr><td style="padding:28px 32px 8px;">
        <p style="margin:0 0 18px;font-size:16px;font-weight:700;color:#111827;">${title}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;border-collapse:collapse;">
          ${rowsHtml}
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

// Envoie une notification via le client Resend DE L'ORGANISATION concernée.
// Silencieux en cas d'échec (log seulement) — une notification interne ratée ne
// doit jamais faire échouer le traitement du webhook/thread qui l'a déclenchée.
export async function sendNotificationEmail(
  resend: Resend,
  fromEmail: string,
  companyName: string,
  to: string,
  subject: string,
  htmlContent: string,
  replyTo?: string | null
): Promise<void> {
  try {
    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: `${companyName} <${fromEmail}>`,
      to,
      subject,
      html: htmlContent,
    }
    if (replyTo) payload.replyTo = replyTo
    const response = await resend.emails.send(payload)
    console.log(`[EMAIL-NOTIF] OK | id: ${(response as { data?: { id?: string } }).data?.id ?? JSON.stringify(response)}`)
  } catch (error) {
    const err = error as { message?: string; statusCode?: number }
    console.error(`[EMAIL-NOTIF] Échec | message: ${err?.message} | status: ${err?.statusCode}`, error)
  }
}
