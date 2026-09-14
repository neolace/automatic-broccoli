import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * A "smoke" project runs against a locally built preview server without any
 * Entra dependency (login page renders, unauthenticated routes redirect).
 * The "authenticated" project requires a pre-established storage state from a
 * controlled test identity and is skipped unless E2E_BASE_URL and
 * E2E_STORAGE_STATE are provided -- see docs/testing.md.
 */
const PORT = 4173;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'smoke', testMatch: /smoke\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'authenticated',
      testMatch: /authenticated\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: process.env.E2E_STORAGE_STATE,
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run preview',
        port: PORT,
        reuseExistingServer: !process.env.CI,
      },
});
