import { expect, test } from '@playwright/test';

/**
 * Smoke coverage that does not depend on a real Entra tenant: it proves the
 * SPA boots, shows the login page, and does not render protected content or
 * a password field to an unauthenticated visitor.
 */
test.describe('unauthenticated visitor', () => {
  test('is redirected to the login page and sees the Microsoft sign-in action', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: /sign in with microsoft/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toHaveCount(0);
  });

  test('reloading the login page does not enter a redirect loop', async ({ page }) => {
    await page.goto('/login');
    await page.reload();

    await expect(page).toHaveURL(/\/login$/);
  });
});
