import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  success: "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-inset ring-[var(--success)]/20",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)] ring-1 ring-inset ring-[var(--warning)]/25",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)] ring-1 ring-inset ring-[var(--danger)]/25",
  info: "bg-[var(--info-soft)] text-[var(--info)] ring-1 ring-inset ring-[var(--info)]/20",
  neutral: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  brand: "bg-[var(--brand-soft)] text-[var(--success)] ring-1 ring-inset ring-[var(--success)]/20",
};

const LABELS: Record<string, { label: string; tone: keyof typeof STYLES }> = {
  completed: { label: "Réussie", tone: "success" },
  pending: { label: "En attente", tone: "warning" },
  failed: { label: "Échouée", tone: "danger" },
  flagged: { label: "Signalée", tone: "danger" },
  verified: { label: "Vérifié", tone: "success" },
  review: { label: "À revoir", tone: "warning" },
  rejected: { label: "Refusé", tone: "danger" },
  active: { label: "Actif", tone: "success" },
  frozen: { label: "Gelé", tone: "warning" },
  closed: { label: "Clôturé", tone: "neutral" },
  inactive: { label: "Inactif", tone: "neutral" },
  locked: { label: "Verrouillé", tone: "danger" },
  open: { label: "Ouvert", tone: "info" },
  investigating: { label: "Investigation", tone: "warning" },
  resolved: { label: "Résolu", tone: "success" },
  dismissed: { label: "Rejeté", tone: "neutral" },
  in_progress: { label: "En cours", tone: "info" },
  waiting: { label: "En attente", tone: "warning" },
  low: { label: "Faible", tone: "neutral" },
  medium: { label: "Moyen", tone: "info" },
  high: { label: "Élevé", tone: "warning" },
  critical: { label: "Critique", tone: "danger" },
  success: { label: "Succès", tone: "success" },
  denied: { label: "Refusé", tone: "danger" },
  error: { label: "Erreur", tone: "danger" },
};

export function StatusBadge({
  value,
  tone,
  label,
  className,
}: {
  value?: string;
  tone?: keyof typeof STYLES;
  label?: string;
  className?: string;
}) {
  const def = value ? LABELS[value] : undefined;
  const t = tone ?? def?.tone ?? "neutral";
  const l = label ?? def?.label ?? value ?? "—";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STYLES[t],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", `bg-current opacity-70`)} />
      {l}
    </span>
  );
}