import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluatePwaEligibility,
  isMobileOrTabletEnvironment,
  isZelareCacheName,
  type PwaEnvironment,
} from '../src/lib/pwaEligibility.ts';

function environment(overrides: Partial<PwaEnvironment> = {}): PwaEnvironment {
  return {
    secureContext: true,
    hasServiceWorker: true,
    pointer: 'fine',
    maxTouchPoints: 0,
    viewportWidth: 1440,
    standalone: false,
    appleStandalone: false,
    origin: 'https://appzelare.casadf.com.br',
    userAgent: 'Mozilla/5.0',
    ...overrides,
  };
}

test('não considera desktop elegível apenas por user-agent', () => {
  const desktop = environment({ userAgent: 'iPhone', viewportWidth: 1440 });
  assert.equal(isMobileOrTabletEnvironment(desktop), false);
  assert.equal(evaluatePwaEligibility(desktop).reason, 'desktop');
});

test('considera Android/tablet quando toque e viewport são coerentes', () => {
  const tablet = environment({ pointer: 'coarse', maxTouchPoints: 5, viewportWidth: 800 });
  assert.equal(evaluatePwaEligibility(tablet).eligible, true);
  assert.equal(evaluatePwaEligibility(tablet).reason, 'eligible');
});

test('reconhece iOS por sinais de dispositivo, sem depender de user-agent para elegibilidade', () => {
  const ios = environment({ pointer: 'coarse', maxTouchPoints: 5, viewportWidth: 390, userAgent: 'iPhone' });
  const result = evaluatePwaEligibility(ios);
  assert.equal(result.eligible, true);
  assert.equal(result.ios, true);
});

test('não oferece instalação quando já está em standalone', () => {
  const installed = environment({ pointer: 'coarse', maxTouchPoints: 5, viewportWidth: 390, standalone: true });
  const result = evaluatePwaEligibility(installed);
  assert.equal(result.eligible, false);
  assert.equal(result.installed, true);
  assert.equal(result.reason, 'installed');
});

test('bloqueia contexto inseguro e navegador sem Service Worker', () => {
  assert.equal(evaluatePwaEligibility(environment({ secureContext: false })).reason, 'insecure-context');
  assert.equal(evaluatePwaEligibility(environment({ hasServiceWorker: false })).reason, 'unsupported');
});

test('limita limpeza a caches da origem Zelare', () => {
  const origin = 'https://appzelare.casadf.com.br';
  assert.equal(isZelareCacheName('assets-cache', origin), true);
  assert.equal(isZelareCacheName(`workbox-precache-v2-${origin}/`, origin), true);
  assert.equal(isZelareCacheName('other-product-cache', origin), false);
});
