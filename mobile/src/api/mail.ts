import { apiFetch } from './client';
import { appendFilePart } from '../lib/formData';
import type { PickedAttachment, ReplyPayload, ReplyResult, SenderAddress } from '../types/api';

export function getSenders(): Promise<SenderAddress[]> {
  return apiFetch<SenderAddress[]>('/emails/senders');
}

export async function sendReply(payload: ReplyPayload, attachments: PickedAttachment[] = []): Promise<ReplyResult> {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });
  for (const att of attachments) {
    await appendFilePart(form, 'attachments', { uri: att.uri, name: att.name, mimeType: att.mimeType });
  }
  return apiFetch<ReplyResult>('/emails/reply', { method: 'POST', body: form });
}
