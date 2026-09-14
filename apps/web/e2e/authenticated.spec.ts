import { expect, test } from '@playwright/test';

/**
 * Requires a real authenticated session captured ahead of time from a
 * controlled test identity (see docs/testing.md - "End-to-end authenticated
 * tests"). Interactive Entra login, MFA and Conditional Access are never
 * automated or weakened for this suite; a storage state is produced once by a
 * human or a service-owned test account and reused.
 */
test.describe('authenticated user', () => {
  test.skip(!process.env.E2E_STORAGE_STATE, 'requires E2E_STORAGE_STATE from a real Entra session');

  test('reaches the home page and receives a successful /api/me response', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
    await expect(page.getByText(/User ID/i)).toBeVisible();
  });
});
