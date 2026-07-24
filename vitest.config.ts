import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./test/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Les tests DB-backed partagent un seul conteneur Postgres jetable — les
    // exécuter en parallèle (chaque fichier de test dans son propre worker,
    // donc son propre pool de connexions Prisma) cause une contention
    // intermittente. Un seul processus séquentiel est plus lent mais fiable.
    fileParallelism: false,
  },
})
