export type PwaEnvironment = {
  secureContext: boolean;
  hasServiceWorker: boolean;
  pointer: string;
  maxTouchPoints: number;
  viewportWidth: number;
  standalone: boolean;
  appleStandalone: boolean;
  origin: string;
  userAgent: string;
};

export type PwaEligibility = {
  eligible: boolean;
  installed: boolean;
  ios: boolean;
  reason: 'unsupported' | 'insecure-context' | 'desktop' | 'installed' | 'eligible';
};

const MOBILE_VIEWPORT_MAX = 1024;
const DESKTOP_RECOVERY_KEY_PREFIX = 'zelare:pwa:desktop-recovery:';

function isIosUserAgent(userAgent: string): boolean {
  return /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));
}

export function isStandaloneEnvironment(environment: Pick<PwaEnvironment, 'standalone' | 'appleStandalone'>): boolean {
  return environment.standalone || environment.appleStandalone;
}

export function isMobileOrTabletEnvironment(environment: Pick<PwaEnvironment, 'pointer' | 'maxTouchPoints' | 'viewportWidth' | 'standalone' | 'appleStandalone'>): boolean {
  const hasTouch = environment.maxTouchPoints > 0;
  const coarsePointer = environment.pointer === 'coarse';
  const narrowViewport = environment.viewportWidth > 0 && environment.viewportWidth <= MOBILE_VIEWPORT_MAX;
  const installedOnTouchDevice = isStandaloneEnvironment(environment) && (hasTouch || coarsePointer || narrowViewport);

  // Não usa user-agent isoladamente. O dispositivo precisa apresentar pelo
  // menos dois sinais coerentes: toque/ponteiro coarse e viewport móvel, ou
  // estar instalado em uma superfície que também pareça móvel/tablet.
  return (hasTouch && (coarsePointer || narrowViewport)) ||
    (coarsePointer && narrowViewport) ||
    installedOnTouchDevice;
}

export function evaluatePwaEligibility(environment: PwaEnvironment): PwaEligibility {
  const installed = isStandaloneEnvironment(environment);
  const mobile = isMobileOrTabletEnvironment(environment);
  const ios = isIosUserAgent(environment.userAgent ?? '');

  if (!environment.hasServiceWorker) return { eligible: false, installed, ios, reason: 'unsupported' };
  if (!environment.secureContext) return { eligible: false, installed, ios, reason: 'insecure-context' };
  if (installed) return { eligible: false, installed: true, ios, reason: 'installed' };
  if (!mobile) return { eligible: false, installed: false, ios, reason: 'desktop' };
  return { eligible: true, installed: false, ios, reason: 'eligible' };
}

export function readPwaEnvironment(): PwaEnvironment {
  const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
  const fullscreen = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: fullscreen)').matches
    : false;
  const navigatorValue = typeof navigator !== 'undefined' ? navigator : undefined;
  const windowValue = typeof window !== 'undefined' ? window : undefined;
  const standalone = media || fullscreen;
  const appleStandalone = Boolean((navigatorValue as Navigator & { standalone?: boolean } | undefined)?.standalone);

  return {
    secureContext: Boolean(windowValue?.isSecureContext),
    hasServiceWorker: Boolean(navigatorValue && 'serviceWorker' in navigatorValue),
    pointer: typeof windowValue?.matchMedia === 'function' && windowValue.matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine',
    maxTouchPoints: navigatorValue?.maxTouchPoints ?? 0,
    viewportWidth: windowValue?.innerWidth ?? 0,
    standalone,
    appleStandalone,
    origin: windowValue?.location.origin ?? '',
    userAgent: navigatorValue?.userAgent ?? '',
  };
}

export async function registerMobileServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  const eligibility = evaluatePwaEligibility(readPwaEnvironment());
  if (!eligibility.eligible) return null;

  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    console.warn('[Zelare PWA] registro mobile indisponível', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

function isZelareServiceWorker(registration: ServiceWorkerRegistration, origin: string): boolean {
  return registration.scope.startsWith(`${origin}/`);
}

export function isZelareCacheName(cacheName: string, origin: string): boolean {
  return cacheName === 'assets-cache' ||
    cacheName.startsWith('zelare-') ||
    cacheName === `workbox-precache-v2-${origin}/` ||
    cacheName.startsWith(`workbox-precache-v2-${origin}/`);
}

export async function recoverLegacyDesktopPwa(releaseId: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const environment = readPwaEnvironment();
  if (!environment.origin || isMobileOrTabletEnvironment(environment)) return false;

  const storageKey = `${DESKTOP_RECOVERY_KEY_PREFIX}${releaseId}`;
  try {
    if (window.sessionStorage.getItem(storageKey) === '1') return false;
    window.sessionStorage.setItem(storageKey, '1');
  } catch {
    // Sem sessionStorage, a limpeza única continua sendo segura; não há loop
    // programático porque o reload só acontece se algo for removido.
  }

  let changed = false;
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        if (!isZelareServiceWorker(registration, environment.origin)) continue;
        changed = (await registration.unregister()) || changed;
      }
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        if (!isZelareCacheName(cacheName, environment.origin)) continue;
        changed = (await caches.delete(cacheName)) || changed;
      }
    }
  } catch (error) {
    console.warn('[Zelare PWA] recuperação desktop parcial', error instanceof Error ? error.name : 'unknown');
  }

  return changed;
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(available: boolean) => void>();

export function initializeInstallPromptCapture(eligible: boolean): () => void {
  if (typeof window === 'undefined' || !eligible) return () => undefined;

  const handleBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    installListeners.forEach((listener) => listener(true));
  };
  const handleAppInstalled = () => {
    deferredInstallPrompt = null;
    installListeners.forEach((listener) => listener(false));
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
  };
}

export function subscribeInstallAvailability(listener: (available: boolean) => void): () => void {
  installListeners.add(listener);
  listener(Boolean(deferredInstallPrompt));
  return () => installListeners.delete(listener);
}

export function canRequestPwaInstall(): boolean {
  return Boolean(deferredInstallPrompt);
}

export async function requestPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredInstallPrompt) return 'unavailable';
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  installListeners.forEach((listener) => listener(false));
  await prompt.prompt();
  const result = await prompt.userChoice;
  return result.outcome;
}
