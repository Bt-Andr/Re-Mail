export function extractEmail(raw: string): string {
  if (!raw) return ''
  const match = raw.match(/<([^>]+)>/)
  return match ? match[1].trim().toLowerCase() : raw.trim().toLowerCase()
}

export function stripQuotedText(text: string): string {
  return text
    .split('\n')
    .filter(line => !line.trimStart().startsWith('>'))
    .join('\n')
    .trim()
}
