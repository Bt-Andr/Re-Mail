import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/app/status-badge";
import { NOTIFICATIONS } from "@/lib/mock/data";
import { relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Northwind Bank" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={0} maxWidth={1080} />;
  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader
        title="Notifications"
        description="Centre d'alertes et événements système."
        actions={<Button variant="outline"><CheckCheck className="mr-2 h-4 w-4" /> Tout marquer comme lu</Button>}
      />
      <SectionCard bodyClassName="p-0">
        <ul className="divide-y">
          {NOTIFICATIONS.map((n) => (
            <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.unread ? "bg-[var(--brand-soft)]/30" : ""}`}>
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-card ring-1 ring-border">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">{n.title}</h4>
                  <StatusBadge value={n.severity} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{relativeTime(n.time)}</p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}