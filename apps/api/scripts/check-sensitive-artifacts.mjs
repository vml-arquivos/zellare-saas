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

const blockedPathRules = [
  {
    name: 'planilha potencialmente pessoal',
    test: (file) => file.startsWith(apiPrefix) && /\.(xlsx|xls)$/i.test(file),
  },
  {
    name: 'import local potencialmente pessoal',
    test: (file) => file.startsWith(`${apiPrefix}imports/`),
  },
  {
    name: 'dataset fora da allowlist pública',
    test: (file) => file.startsWith(`${apiPrefix}data/`) || file.startsWith(`${apiPrefix}datasets/`),
  },
  {
    name: 'documento de login ou cadastro pessoal',
    test: (file) => /(^|\/)(LOGINS_TESTE|LOGINS_ATUALIZADOS|funcionarios-reais|dados-(arara|flamboyant|pelicano|sabia)|turmas_alunos|arara-2026-alunos)/i.test(file),
  },
  {
    name: 'evidência de produção com dados autenticados',
    test: (file) => file.startsWith(`${apiPrefix}ops/evidencias/smoke-prod/`),
  },
  {
    name: 'seed SQL com cadastro ou conferência',
    test: (file) => /^apps\/api\/prisma\/seeds\//i.test(file),
  },
  {
    name: 'seed Prisma legado',
    test: (file) => /^apps\/api\/prisma\/seed[^/]*\.(ts|js)$/i.test(file),
  },
  {
    name: 'seed/import de dados pessoais',
    test: (file) => /(^|\/)(seed-(admin|all-users|cirurgico|fresh|real-data|test-users)|seed-completar-maio-hoje-unidades|import-(arara-2026|dados-responsaveis)|importar-unidade)(\.|\/|$)/i.test(file),
  },
  {
    name: 'seed/import de dados pessoais em src',
    test: (file) => /^apps\/api\/src\/scripts\/(seed-arara|seed-sabia|import-arara|import-dados-responsaveis|importar-unidade)/i.test(file),
  },
];

const findings = [];
for (const file of files) {
  if (publicAllowlist.has(file)) continue;
  for (const rule of blockedPathRules) {
    if (rule.test(file)) {
      findings.push(`${rule.name}: ${file}`);
      break;
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
  for (const finding of [...new Set(findings)].sort()) console.error(`- ${finding}`);
  console.error('Remova o artifact do commit corrente ou substitua-o por fixture pública/sintética. O histórico Git não é reescrito por este gate.');
  process.exit(1);
}

console.log('Sensitive-artifacts gate: PASS');
console.log(`Arquivos versionados verificados: ${files.length}`);
console.log(`Allowlist pública: ${publicAllowlist.size} arquivos`);
console.log('Nenhum caminho sensível identificado no HEAD corrente.');
console.log('Nenhum artifact não público é copiado para dist pela rotina de build.');
