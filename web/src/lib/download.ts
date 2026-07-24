import { apiFetch } from './apiClient'

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const match = header.match(/filename="?([^"]+)"?/)
  return match ? match[1] : fallback
}

// Télécharge une réponse binaire authentifiée (le fichier d'invitation) et
// déclenche l'enregistrement navigateur via un <a download> temporaire.
export async function downloadAuthenticated(path: string, fallbackFilename: string): Promise<void> {
  const res = await apiFetch(path)
  if (!res.ok) throw new Error('Téléchargement impossible.')
  const blob = await res.blob()
  const filename = filenameFromContentDisposition(res.headers.get('Content-Disposition'), fallbackFilename)

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
