import { describe, expect, it } from 'vitest';
import { evaluatePwaEligibility, isMobileOrTabletEnvironment } from './pwaEligibility';

type Environment = Parameters<typeof evaluatePwaEligibility>[0];

function environment(overrides: Partial<Environment> = {}): Environment {
  return {
    secureContext: true,
    hasServiceWorker: true,
    pointer: 'coarse',
    maxTouchPoints: 5,
    viewportWidth: 390,
    standalone: false,
    appleStandalone: false,
    origin: 'https://appzelare.casadf.com.br',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
    ...overrides,
  };
}

describe('evaluatePwaEligibility', () => {
  it('recusa desktop mesmo quando o navegador suporta Service Worker', () => {
    const result = evaluatePwaEligibility(environment({
      pointer: 'fine',
      maxTouchPoints: 0,
      viewportWidth: 1440,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    }));

    expect(result).toEqual({ eligible: false, installed: false, ios: false, reason: 'desktop' });
  });

  it('permite Android com toque e viewport móvel', () => {
    expect(evaluatePwaEligibility(environment())).toMatchObject({
      eligible: true,
      installed: false,
      ios: false,
      reason: 'eligible',
    });
  });

  it('identifica iOS e permite apenas a instrução acionada pelo usuário', () => {
    const result = evaluatePwaEligibility(environment({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    }));

    expect(result).toMatchObject({ eligible: true, ios: true, reason: 'eligible' });
  });

  it('não oferece instalação para aplicativo já instalado', () => {
    const result = evaluatePwaEligibility(environment({ standalone: true }));

    expect(result).toEqual({ eligible: false, installed: true, ios: false, reason: 'installed' });
  });

  it('recusa contexto inseguro e navegador sem Service Worker', () => {
    expect(evaluatePwaEligibility(environment({ secureContext: false }))).toMatchObject({
      eligible: false,
      reason: 'insecure-context',
    });
    expect(evaluatePwaEligibility(environment({ hasServiceWorker: false }))).toMatchObject({
      eligible: false,
      reason: 'unsupported',
    });
  });
});

describe('mobile/tablet signal combination', () => {
  it('não trata user-agent isolado como sinal suficiente', () => {
    expect(isMobileOrTabletEnvironment({
      pointer: 'fine',
      maxTouchPoints: 0,
      viewportWidth: 1440,
      standalone: false,
      appleStandalone: false,
    })).toBe(false);
  });
});
