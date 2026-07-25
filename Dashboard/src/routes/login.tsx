import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock, Mail, ShieldCheck, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Northwind Bank Back-Office" },
      { name: "description", content: "Espace sécurisé réservé aux collaborateurs Northwind Bank." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("amina.m@northwind-bank.io");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Renseignez votre email et votre mot de passe.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate({ to: "/" });
    }, 600);
  };

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col bg-background px-6 py-10 sm:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--navy)] text-[var(--brand)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Northwind Bank</div>
            <div className="text-[11px] text-muted-foreground">Back-office sécurisé</div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <h1 className="text-2xl font-semibold tracking-tight">Connexion collaborateur</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accédez à votre espace de gestion. Authentification à deux facteurs activée.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email professionnel</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 pl-9"
                  placeholder="prenom.nom@northwind-bank.io"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setError("Contactez votre administrateur pour réinitialiser le mot de passe.")}
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 px-9"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox id="remember" /> Se souvenir de cet appareil
              </label>
            </div>

            {error && (
              <div className="rounded-md border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-[var(--brand)] text-[var(--brand-foreground)] hover:bg-[var(--brand)]/90"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              Démo — toute saisie d'email + mot de passe ouvre le dashboard.
            </div>
          </form>

          <div className="mt-8 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
            <span>Besoin d'aide ? <a className="text-foreground hover:underline" href="mailto:it@northwind-bank.io">it@northwind-bank.io</a></span>
            <Link to="/" className="hover:text-foreground">Retour au site</Link>
          </div>
        </div>

        <div className="mt-6 text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Northwind Bank · Agrément ACPR n°12345 · Tous droits réservés.
        </div>
      </div>

      {/* Right — brand panel */}
      <div className="relative hidden overflow-hidden bg-[var(--navy)] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(600px 400px at 20% 10%, oklch(0.82 0.22 153 / 0.25), transparent 60%), radial-gradient(500px 400px at 90% 90%, oklch(0.45 0.13 268 / 0.5), transparent 60%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-2 text-white/90">
          <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
          <span className="text-xs uppercase tracking-[0.18em]">Plateforme back-office</span>
        </div>

        <div className="relative z-10 space-y-6 text-white">
          <h2 className="text-3xl font-semibold leading-tight">
            Une infrastructure unique pour piloter l'ensemble de vos opérations bancaires.
          </h2>
          <p className="max-w-md text-sm text-white/70">
            Conformité, risque, support, trésorerie, audit — tous les métiers réunis dans un même
            espace, avec une traçabilité de bout en bout.
          </p>

          <div className="grid max-w-md grid-cols-3 gap-4 pt-4">
            {[
              { k: "1,2 Md€", v: "Volume traité / mois" },
              { k: "99,98 %", v: "Disponibilité" },
              { k: "ISO 27001", v: "Certifié" },
            ].map((s) => (
              <div key={s.k} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-lg font-semibold text-[var(--brand)]">{s.k}</div>
                <div className="text-[11px] text-white/60">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-white/50">
          <ShieldCheck className="h-3.5 w-3.5" />
          Connexion chiffrée TLS 1.3 · Surveillance SOC 24/7
        </div>
      </div>
    </div>
  );
}