import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'infra',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // CDK synth in these tests shells out to dotnet publish and esbuild;
    // under full-suite parallel load that comfortably exceeds vitest's
    // default 5s per-test timeout.
    testTimeout: 30_000,
  },
});
