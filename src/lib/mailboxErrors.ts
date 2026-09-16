export class MailboxProviderError extends Error {
  constructor(
    public readonly service: 'IMAP' | 'SMTP',
    options?: { cause?: unknown }
  ) {
    super(`Connexion ${service} impossible.`, options)
    this.name = 'MailboxProviderError'
  }
}
