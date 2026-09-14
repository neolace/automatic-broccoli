import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: 'web',
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      // Non-secret identifiers only; see docs/entra-configuration.md.
      env: {
        VITE_ENTRA_TENANT_ID: '11111111-1111-1111-1111-111111111111',
        VITE_ENTRA_CLIENT_ID: '22222222-2222-2222-2222-222222222222',
        VITE_ENTRA_API_SCOPE: 'api://22222222-2222-2222-2222-222222222222/access_as_user',
        VITE_API_BASE_URL: 'https://api.test.example.com',
      },
    },
  }),
);
