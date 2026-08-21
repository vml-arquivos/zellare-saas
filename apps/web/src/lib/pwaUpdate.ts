/**
 * pwaUpdate — utilitários para destravar cache do PWA no iOS/Android.
 *
 * Em PWAs com Service Worker (Workbox), o iOS frequentemente continua servindo
 * a versão antiga em cache mesmo após um deploy novo. Este helper força a
 * atualização: pede update do SW, limpa os caches e recarrega a página.
 */

import { isZelareCacheName, readPwaEnvironment } from './pwaEligibility';

export const BUILD_ID: string =
  typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'local';

/**
 * Força atualização total do PWA:
 * 1. Atualiza/desregistra o Service Worker do escopo Zelare
 * 2. Limpa somente caches identificados do Zelare
 * 3. Recarrega a página se houve recuperação efetiva
 */
export async function hardRefreshPWA(): Promise<void> {
  const origin = readPwaEnvironment().origin;
  let shouldReload = false;
  try {
    if ('serviceWorker' in navigator && origin) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((registration) => registration.scope.startsWith(`${origin}/`))
          .map(async (registration) => {
            try { await registration.update(); } catch { /* segue com a limpeza */ }
            try { shouldReload = (await registration.unregister()) || shouldReload; } catch { /* segue com a limpeza */ }
          }),
      );
    }
    if ('caches' in window && origin) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => isZelareCacheName(key, origin)).map(async (key) => {
          shouldReload = (await caches.delete(key)) || shouldReload;
        }),
      );
    }
  } catch {
    // A navegação continua disponível mesmo se a recuperação for parcial.
  }

  // O botão é uma ação explícita do usuário; um único reload não cria loop.
  if (shouldReload) window.location.reload();
}
