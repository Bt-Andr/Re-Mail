export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Formatage manuel plutôt que Intl.RelativeTimeFormat : ce constructeur n'est pas
// disponible sur tous les moteurs Hermes/Android (plante au chargement du module
// sur certains appareils via Expo Go — voir historique de build mobile).
const RELATIVE_UNITS: { seconds: number; singular: string; plural: string }[] = [
  { seconds: 1, singular: 'seconde', plural: 'secondes' },
  { seconds: 60, singular: 'minute', plural: 'minutes' },
  { seconds: 3600, singular: 'heure', plural: 'heures' },
  { seconds: 86400, singular: 'jour', plural: 'jours' },
  { seconds: 604800, singular: 'semaine', plural: 'semaines' },
  { seconds: 2629800, singular: 'mois', plural: 'mois' },
  { seconds: 31557600, singular: 'an', plural: 'ans' },
];

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}

// Couleur d'avatar stable par expéditeur (comme Gmail) : même seed → même couleur
// à chaque rendu, sans état ni requête supplémentaire.
const AVATAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeTime(iso: string): string {
  const diffSeconds = (Date.now() - new Date(iso).getTime()) / 1000;
  const future = diffSeconds < 0;
  const abs = Math.abs(diffSeconds);

  if (abs < 10) return "à l'instant";

  let unit = RELATIVE_UNITS[0];
  for (const candidate of RELATIVE_UNITS) {
    if (abs < candidate.seconds) break;
    unit = candidate;
  }
  const value = Math.max(1, Math.round(abs / unit.seconds));
  const label = value === 1 ? unit.singular : unit.plural;
  return future ? `dans ${value} ${label}` : `il y a ${value} ${label}`;
}
