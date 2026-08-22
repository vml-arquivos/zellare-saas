import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UNITS_STATIC } from '../client/src/data/units';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('public production safety', () => {
  it('does not ship fictional units in the static compatibility module', () => {
    expect(UNITS_STATIC).toEqual([]);
  });

  it('does not leave example.invalid in public site runtime files', () => {
    const runtimeFiles = [
      'apps/site/client/src/components/Footer.tsx',
      'apps/site/client/src/data/units.ts',
      'apps/site/client/src/pages/Compliance.tsx',
      'apps/site/client/src/pages/Contato.tsx',
      'apps/site/client/src/pages/TrabalheConosco.tsx',
      'apps/site/client/src/pages/Unidades.tsx',
      'apps/site/client/src/pages/UnidadeDetail.tsx',
    ];

    for (const file of runtimeFiles) {
      expect(readRepoFile(file).toLowerCase(), file).not.toContain('example.invalid');
    }
  });

  it('keeps institutional runbooks free of commands for removed files', () => {
    const documentationFiles = [
      'CONFIGURACAO_COOLIFY_RAPIDA.md',
      'apps/site/DEPLOY_GUIDE.md',
      'apps/site/ENV_CONFIG.md',
      'apps/api/scripts/README.md',
    ];
    const orphanedCommand = /seed-admin\.js|seed-all-users|seed-real-data|seed-fresh|seed-test-users/;

    for (const file of documentationFiles) {
      expect(readRepoFile(file), file).not.toMatch(orphanedCommand);
    }
  });
});
