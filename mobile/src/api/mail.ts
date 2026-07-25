import { apiFetch } from './client';
import type { PickedAttachment, ReplyPayload, ReplyResult, SenderAddress } from '../types/api';

export function getSenders(): Promise<SenderAddress[]> {
  return apiFetch<SenderAddress[]>('/emails/senders');
}

export function sendReply(payload: ReplyPayload, attachments: PickedAttachment[] = []): Promise<ReplyResult> {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });
  attachments.forEach(att => {
    form.append('attachments', {
      uri: att.uri,
      name: att.name,
      type: att.mimeType || 'application/octet-stream',
    } as unknown as Blob);
  });
  return apiFetch<ReplyResult>('/emails/reply', { method: 'POST', body: form });
}
