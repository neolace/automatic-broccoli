import { defineConfig } from 'vitest/config';

/**
 * Root Vitest configuration. Each JS/TS workspace owns its own
 * vitest.config.ts (environment, setup files, includes); this file only
 * aggregates them so a single `npm test` at the root runs every project.
 *
 * The Lambda API (apps/api) is C# and is not part of this aggregation -- it
 * is tested with `dotnet test` (see package.json's `test:api`, wired into the
 * root `test` script and into CI).
 */
export default defineConfig({
  test: {
    projects: ['packages/shared', 'apps/web', 'infra'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['apps/web/src/**', 'packages/shared/src/**', 'infra/lib/**'],
      exclude: ['**/*.test.*', '**/test/**', '**/*.d.ts', 'apps/web/src/main.tsx'],
    },
  },
});
