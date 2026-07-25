import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "navy";
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[0_1px_3px_rgba(16,24,40,0.08)]",
        tone === "navy" && "border-transparent bg-[var(--navy)] text-[var(--navy-foreground)]",
      )}
    >
      <div className="flex items-start justify-between">
        <p className={cn("text-sm font-medium", tone === "navy" ? "text-white/70" : "text-muted-foreground")}>
          {label}
        </p>
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              tone === "navy" ? "bg-white/10 text-[var(--brand)]" : "bg-[var(--brand-soft)] text-[var(--success)]",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="tabular text-2xl font-semibold tracking-tight">{value}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
              positive
                ? "bg-[var(--success-soft)] text-[var(--success)]"
                : "bg-[var(--danger-soft)] text-[var(--danger)]",
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {positive ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        )}
        {hint && (
          <span className={cn(tone === "navy" ? "text-white/60" : "text-muted-foreground")}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}