import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

import { GenericPageSkeleton } from "@/components/app/page-skeletons";
import { useMountLoading } from "@/hooks/use-simulated-loading";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Paramètres — Northwind Bank" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const __loading = useMountLoading();
  if (__loading) return <GenericPageSkeleton kpis={0} maxWidth={1080} />;
  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader title="Paramètres" description="Configuration globale du back-office." />
      <div className="space-y-6">
        <SectionCard title="Organisation">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Raison sociale</Label>
              <Input defaultValue="Northwind Bank S.A." className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>BIC</Label>
              <Input defaultValue="NWBKFRPPXXX" className="h-11 tabular" />
            </div>
            <div className="space-y-1.5">
              <Label>Fuseau horaire</Label>
              <Input defaultValue="Europe/Paris" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Devise de référence</Label>
              <Input defaultValue="EUR" className="h-11" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Sécurité">
          <div className="space-y-4">
            {[
              { k: "mfa", label: "MFA obligatoire pour tous les agents", on: true },
              { k: "ipallow", label: "Restreindre aux IP des agences", on: true },
              { k: "sessions", label: "Déconnexion automatique après 15 min", on: true },
              { k: "passwordrot", label: "Rotation mot de passe tous les 90 jours", on: false },
            ].map((s) => (
              <div key={s.k} className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
                <span className="text-sm">{s.label}</span>
                <Switch defaultChecked={s.on} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Seuils opérationnels">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Validation SWIFT au-dessus de</Label>
              <Input defaultValue="100 000 €" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Limite virement instantané</Label>
              <Input defaultValue="15 000 €" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Plafond carte par défaut</Label>
              <Input defaultValue="5 000 €" className="h-11" />
            </div>
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2">
          <Button variant="outline">Annuler</Button>
          <Button>Enregistrer</Button>
        </div>
      </div>
    </div>
  );
}