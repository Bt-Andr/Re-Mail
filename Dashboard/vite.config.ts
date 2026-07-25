import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Cible de déploiement : Node server classique (preset "node-server"), pour
// tourner comme process Node autonome à côté du backend Express (Render) — pas
// de compte Cloudflare/Vercel. Le SSR de TanStack Start résout chaque route
// côté serveur : un accès direct ou une actualisation sur n'importe quelle page
// ne peut donc jamais renvoyer un 404 statique.
export default defineConfig(({ command }) => ({
  server: { port: 8080 },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts enveloppe le point d'entrée SSR pour rattraper les erreurs
      // que h3 avale sinon en 500 JSON générique — voir son commentaire en tête.
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    ...(command === "build" ? [nitro({ preset: "node-server" })] : []),
    viteReact(),
  ],
}));
