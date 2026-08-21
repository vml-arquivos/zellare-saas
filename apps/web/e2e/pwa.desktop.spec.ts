import { expect, test } from '@playwright/test';

test.describe('PWA no desktop', () => {
  test('carrega a aplicação sem registrar Service Worker automaticamente', async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __zelareSwRegisterCalls?: number }).__zelareSwRegisterCalls = 0;
      const registrations: ServiceWorkerRegistration[] = [];
      const serviceWorker = {
        register: async () => {
          const state = window as Window & { __zelareSwRegisterCalls?: number };
          state.__zelareSwRegisterCalls = (state.__zelareSwRegisterCalls ?? 0) + 1;
          throw new Error('registration should not be called on desktop');
        },
        getRegistrations: async () => registrations,
      };
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: serviceWorker,
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(500);

    const registerCalls = await page.evaluate(
      () => (window as Window & { __zelareSwRegisterCalls?: number }).__zelareSwRegisterCalls ?? 0,
    );
    expect(registerCalls).toBe(0);
  });
});
