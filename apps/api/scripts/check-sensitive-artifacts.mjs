#!/usr/bin/env node

/**
 * Gate de privacidade para artifacts versionados do Zelare.
 *
 * Este gate é deliberadamente baseado em caminho/nome de arquivo. Ele não tenta
 * inferir conteúdo de planilhas ou JSON e não apaga histórico Git. Qualquer
 * remoção histórica exige aprovação humana explícita (P0-2).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function gitRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
}

function trackedFiles(root) {
  const output = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'buffer',
  }).toString('utf8');
  return output.split('\0').filter(Boolean);
}

const root = gitRoot();
const apiPrefix = 'apps/api/';
const files = trackedFiles(root);
const dockerignorePath = resolve(root, apiPrefix, '.dockerignore');
const dockerignore = readFileSync(dockerignorePath, 'utf8');

const publicAllowlist = new Set([
  'apps/api/data/catalogo_administrativo.csv',
  'apps/api/data/catalogo_alimentos.csv',
  'apps/api/data/catalogo_higiene_pessoal.csv',
  'apps/api/data/catalogo_materiais_higiene_pedagogico.csv',
  'apps/api/data/catalogo_pedagogico.csv',
  'apps/api/data/matriz-curricular-2026-sample.json',
  'apps/api/datasets/materiais_seed.json',
]);

const knownLegacySensitivePaths = new Set([
  'apps/api/data/ALUNOS2026.xlsx',
  'apps/api/data/arara-2026-alunos.json',
  'apps/api/data/dados-arara.xlsx',
  'apps/api/data/dados-flamboyant.xlsx',
  'apps/api/data/dados-pelicano.xlsx',
  'apps/api/data/dados-sabia.xlsx',
  'apps/api/datasets/turmas_alunos.json',
  'apps/api/docs/funcionarios-reais-completo.json',
  'apps/api/imports/alunos.xlsx',
  'apps/api/imports/profissionais.xlsx',
  'apps/api/prisma/seed-arara-caninde.ts',
  'apps/api/prisma/seed-cocris-units.ts',
  'apps/api/prisma/seed-units-from-json.js',
  'apps/api/prisma/seed-units-from-json.ts',
  'apps/api/prisma/seed-units.ts',
  'apps/api/prisma/seed.ts',
  'apps/api/prisma/seeds/flamboyant/01_seed_flamboyant_completo.sql',
  'apps/api/prisma/seeds/flamboyant/02_conferir_flamboyant.sql',
  'apps/api/prisma/seeds/flamboyant/03_conferencia_qualidade_pelicano_flamboyant.sql',
  'apps/api/prisma/seeds/pelicano/01_seed_pelicano_completo.sql',
  'apps/api/prisma/seeds/pelicano/02_conferir_pelicano.sql',
]);

const blockedPathRules = [
  {
    name: 'planilhas de dados pessoais',
    test: (file) => file.startsWith(apiPrefix) && /\.(xlsx|xls)$/i.test(file),
  },
  {
    name: 'imports locais',
    test: (file) => file.startsWith(`${apiPrefix}imports/`),
  },
  {
    name: 'documentação com cadastro de funcionários',
    test: (file) => /(^|\/)funcionarios-reais/i.test(file),
  },
  {
    name: 'datasets com alunos/turmas identificáveis',
    test: (file) => /(^|\/)(arara-2026-alunos|turmas_alunos)\.(json|csv)$/i.test(file),
  },
  {
    name: 'seeds SQL com cadastros pessoais',
    test: (file) => /^apps\/api\/prisma\/seeds\//i.test(file),
  },
  {
    name: 'seeds de dados reais no runtime',
    test: (file) => /^apps\/api\/prisma\/seed[^/]*\.(ts|js)$/i.test(file),
  },
];

const findings = [];
const legacyWarnings = new Set();

for (const file of files) {
  for (const rule of blockedPathRules) {
    if (rule.test(file) && !publicAllowlist.has(file)) {
      if (knownLegacySensitivePaths.has(file)) {
        legacyWarnings.add(file);
      } else {
        findings.push(`${rule.name}: ${file}`);
      }
      break;
    }
  }

  if (
    (file.startsWith(`${apiPrefix}data/`) || file.startsWith(`${apiPrefix}datasets/`)) &&
    !publicAllowlist.has(file)
  ) {
    if (knownLegacySensitivePaths.has(file)) {
      legacyWarnings.add(file);
    } else {
      findings.push(`arquivo fora da allowlist pública: ${file}`);
    }
  }
}

const requiredDockerignoreRules = [
  'imports/',
  'docs/',
  '*.xlsx',
  '**/*alunos*.json',
  '**/*turmas_alunos*.json',
  '**/*funcionarios-reais*.json',
  'prisma/seed*.ts',
  'prisma/seeds/',
];

for (const rule of requiredDockerignoreRules) {
  if (!dockerignore.split(/\r?\n/).some((line) => line.trim() === rule)) {
    findings.push(`regra ausente em apps/api/.dockerignore: ${rule}`);
  }
}

if (findings.length > 0) {
  console.error('Sensitive-artifacts gate: FAIL');
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`);
  console.error(
    'A remoção do histórico Git não é automática; P0-2 exige aprovação humana explícita.',
  );
  process.exit(1);
}

console.log('Sensitive-artifacts gate: PASS');
console.log(`Arquivos versionados verificados: ${files.length}`);
console.log(`Allowlist pública: ${publicAllowlist.size} arquivos`);
console.log(`Baseline legado sensível documentado: ${legacyWarnings.size} arquivos`);
if (legacyWarnings.size > 0) {
  console.warn('Risco residual documentado — não removido sem aprovação humana (P0-2):');
  for (const warning of [...legacyWarnings].sort()) console.warn(`- ${warning}`);
}
console.log('Nenhum novo artifact de PII foi permitido na imagem da API.');
console.log('Nenhuma remoção ou reescrita de histórico Git foi executada.');
