import { useEffect, useState } from 'react'
import { apiFetch, parseError } from '../../lib/apiClient'
import { useSenders } from '../../hooks/useSenders'
import { useToast } from '../../context/ToastContext'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Button } from '../../components/ui/Button'
import { SenderSelect } from './SenderSelect'
import { NoSendersNotice } from './NoSendersNotice'
import { AttachmentPicker } from './AttachmentPicker'

export type ComposerMode = 'new' | 'reply' | 'forward'

export interface ComposerRequest {
  mode: ComposerMode
  threadId?: string
  sourceMessageId?: string
  to?: string
  subject?: string
}

export function ComposerPanel({ request, onClose, onSent }: { request: ComposerRequest | null; onClose: () => void; onSent: (threadId: string) => void }) {
  const { senders, loading: sendersLoading } = useSenders()
  const { showToast } = useToast()

  const [fromEmail, setFromEmail] = useState('')
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!request) return
    setTo(request.to ?? '')
    setCc('')
    setBcc('')
    setShowCcBcc(false)
    setMessage('')
    setFiles([])
    setError('')
    let subj = request.subject ?? ''
    if (request.mode === 'reply' && subj && !/^re:/i.test(subj)) subj = `Re: ${subj}`
    if (request.mode === 'forward' && subj && !/^fwd:/i.test(subj)) subj = `Fwd: ${subj}`
    setSubject(subj)
  }, [request])

  useEffect(() => {
    const def = senders.find(s => s.isDefault) ?? senders[0]
    if (def) setFromEmail(def.email)
  }, [senders])

  if (!request) return null

  const title = request.mode === 'new' ? 'Nouveau mail' : request.mode === 'forward' ? 'Transférer' : `Répondre à ${request.to}`
  const canWrite = senders.length > 0

  const submit = async () => {
    if (!to.trim() || !message.trim()) return
    setError('')
    setLoading(true)
    try {
      const form = new FormData()
      form.set('to', to.trim())
      if (cc.trim()) form.set('cc', cc.trim())
      if (bcc.trim()) form.set('bcc', bcc.trim())
      form.set('subject', subject)
      form.set('message', message)
      form.set('mode', request.mode === 'forward' ? 'forward' : 'reply')
      if (request.threadId) form.set('threadId', request.threadId)
      if (request.sourceMessageId) form.set('sourceMessageId', request.sourceMessageId)
      if (fromEmail) form.set('fromEmail', fromEmail)
      for (const f of files) form.append('attachments', f)

      const res = await apiFetch('/emails/reply', { method: 'POST', body: form })
      if (!res.ok) {
        setError(await parseError(res, "Échec de l'envoi."))
        return
      }
      const data = await res.json()
      showToast('success', 'Email envoyé.')
      onSent(data.threadId)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        canWrite ? (
          <>
            <Button variant="secondary" onClick={onClose}>Fermer</Button>
            <Button onClick={submit} loading={loading} disabled={!to.trim() || !message.trim()}>Envoyer</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
        )
      }
    >
      {sendersLoading ? null : !canWrite ? (
        <NoSendersNotice />
      ) : (
        <>
          <SenderSelect senders={senders} value={fromEmail} onChange={setFromEmail} disabled={request.mode !== 'new'} />
          <Input label="À" type="email" value={to} onChange={e => setTo(e.target.value)} readOnly={request.mode === 'reply'} required />
          {!showCcBcc ? (
            <button type="button" onClick={() => setShowCcBcc(true)} className="text-xs text-foreground font-medium hover:underline">
              + Cc / Cci
            </button>
          ) : (
            <>
              <Input label="Cc" placeholder="adresse1@exemple.com, adresse2@exemple.com" value={cc} onChange={e => setCc(e.target.value)} />
              <Input label="Cci" placeholder="adresse@exemple.com" value={bcc} onChange={e => setBcc(e.target.value)} />
            </>
          )}
          <Input label="Sujet" value={subject} onChange={e => setSubject(e.target.value)} />
          <Textarea label="Message" rows={8} value={message} onChange={e => setMessage(e.target.value)} placeholder="Rédigez votre message…" />
          {request.mode !== 'forward' && <AttachmentPicker files={files} onChange={setFiles} />}
          {request.mode === 'forward' && (
            <p className="text-xs text-muted-foreground">Les pièces jointes du message d'origine seront automatiquement incluses.</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </>
      )}
    </Modal>
  )
}
