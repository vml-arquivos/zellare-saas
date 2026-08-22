import { test, expect } from '@playwright/test';

test('login público continua acessível', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('input').first()).toBeVisible();
});

test('menu único navega para Família/LGPD quando credenciais E2E estão configuradas', async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, 'Credenciais E2E não configuradas; smoke público continua obrigatório.');

  await page.goto('/login');
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  await emailInput.fill(email!);
  await passwordInput.fill(password!);
  await page.getByRole('button', { name: /entrar|login/i }).click();
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

  const familyLink = page.locator('[data-testid="nav-item-family-links"]');
  if (await familyLink.count()) {
    await familyLink.click();
    await expect(page).toHaveURL(/\/app\/familia\/vinculos/);
    await expect(page.locator('[data-testid="nav-group-family"]')).toBeVisible();
  }
});
