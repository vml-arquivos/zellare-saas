import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const files = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'buffer' }).toString('utf8').split('\0').filter(Boolean);
const dockerignorePath = join(root, 'apps/api/.dockerignore');
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
const policyFiles = new Set([
  'apps/api/scripts/check-sensitive-artifacts.mjs',
  'apps/api/.dockerignore',
  '.github/workflows/pr-gate.yml',
  'docs/security/GATE02_PII_ARTIFACTS.md',
]);
const syntheticEmail = /@(example\.(com|org|net|invalid)|example\.test|test\.local|localhost)$/i;
const skipContent = (file) => policyFiles.has(file) || file.includes('/prisma/migrations/') || file.includes('/drizzle/meta/') || file.endsWith('.lock') || file.endsWith('package-lock.json') || file.endsWith('pnpm-lock.yaml') || file.endsWith('package.json') || publicAllowlist.has(file);
const rules = [
  ['credential-literal', /\b(?:Admin@123|Teste@123|Demo@2026|Carol270412|dev123)\b/g],
  ['api-key', /\b(?:AIza[0-9A-Za-z_-]{20,}|sk_(?:live|test)_[A-Za-z0-9_-]+|sb_(?:publishable|secret)_[A-Za-z0-9_-]+)\b/g],
  ['bearer-token', /\bBearer\s+[A-Za-z0-9._~+/=-]{24,}/gi],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['cpf', /\b(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{3}\s\d{3}\s\d{3}-\d{2})\b/g],
  ['cpf-labeled', /\b(?:cpf|documento)\s*[:=]\s*['"`]?\d{11}['"`]?/gi],
  ['phone', /(?:\+?55[\s-]?)?\(\d{2}\)\s?9?\d{4}[\s-]\d{4}/g],
  ['real-data-marker', /\b(?:ALUNOS2026|arara[- ]?canind[eé]|flamboyant|pelicano|s[aá]bia|alunos reais|funcion[aá]rios reais|smoke-prod|LOGINS_(?:TESTE|ATUALIZADOS)|funcionarios-reais|turmas_alunos|update-names|seed-units)\b/gi],
  ['person-name-marker', /\b(?:Bruna Vaz|Carla Psic[oó]loga|Daniel(?: Pereira da Cruz)?|Ana Carolina(?: de Araujo)?|Adriel|Dorli(?: Souza Viana)?|Raquel|Elisangela|Luciene|JESSICA|EDILVANA|ANGELICA|Evellyn|Nonata|Paula Costa|Fernanda Lima|Maria Silva|Ana Santos|Joana Oliveira|Carla Souza|Vanderlon Tavares)\b/gi],
];
const findings = [];
for (const file of files) {
  if (skipContent(file)) continue;
  const path = join(root, file);
  let data;
  try {
    if (statSync(path).size > 3_000_000) continue;
    const raw = readFileSync(path);
    if (raw.includes(0)) continue;
    data = raw.toString('utf8');
  } catch { continue; }
  const lines = data.split(/\r?\n/);
  lines.forEach((line, index) => {
    const emails = line.match(/[A-Z0-9._%+-]+@[A-Z][A-Z0-9-]*(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi) ?? [];
    for (const value of emails) if (!syntheticEmail.test(value)) findings.push({ file, line: index + 1, kind: 'email', snippet: redact(line) });
    for (const [kind, regex] of rules) {
      regex.lastIndex = 0;
      if (regex.test(line)) findings.push({ file, line: index + 1, kind, snippet: redact(line) });
    }
    const assignment = line.match(/\b(?:password|senha|secret|token|apiKey|api_key)\s*[:=]\s*(['"`])([^'"`\n]+)\1/i);
    if (assignment && !/process\.env|process\.argv|\$[0-9]+|<[^>]+>|placeholder|example|change[-_ ]?me|your[_-]?|from_secret/i.test(assignment[2])) {
      findings.push({ file, line: index + 1, kind: 'credential-assignment', snippet: redact(line) });
    }
  });
}
function redact(line) {
  return line
    .replace(/[A-Z0-9._%+-]+@[A-Z][A-Z0-9-]*(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi, '<EMAIL>')
    .replace(/\b(?:Admin@123|Teste@123|Demo@2026|Carol270412|dev123)\b/g, '<CREDENTIAL>')
    .replace(/\b(?:AIza[0-9A-Za-z_-]{20,}|sk_(?:live|test)_[A-Za-z0-9_-]+|sb_(?:publishable|secret)_[A-Za-z0-9_-]+)\b/g, '<SECRET>')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{24,}/gi, 'Bearer <TOKEN>')
    .replace(/\b(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{3}\s\d{3}\s\d{3}-\d{2})\b/g, '<CPF>')
    .replace(/(?:\+?55[\s-]?)?\(\d{2}\)\s?9?\d{4}[\s-]\d{4}/g, '<PHONE>')
    .slice(0, 260);
}
const unique = [...new Map(findings.map((item) => [`${item.file}:${item.line}:${item.kind}`, item])).values()]
  .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.kind.localeCompare(b.kind));
if (unique.length) {
  console.error('Sensitive-artifacts gate: FAIL');
  for (const item of unique) console.error(`- ${item.kind}: ${item.file}:${item.line} ${item.snippet}`);
  console.error('Remova o conteúdo sensível ou substitua-o por fixture/placeholder sintético. O histórico Git não é reescrito.');
  process.exit(1);
}
const requiredDockerignoreRules = ['imports/', 'docs/', '*.xlsx', '**/*alunos*.json', '**/*turmas_alunos*.json', '**/*funcionarios-reais*.json', 'prisma/seed*.ts', 'prisma/seeds/'];
for (const rule of requiredDockerignoreRules) if (!dockerignore.split(/\r?\n/).some((line) => line.trim() === rule)) { console.error(`Regra ausente em apps/api/.dockerignore: ${rule}`); process.exit(1); }
console.log('Sensitive-artifacts gate: PASS');
console.log(`Arquivos versionados verificados: ${files.length}`);
console.log('Conteúdo sensível detectado: 0');
console.log('Allowlist pública restrita a catálogos/fixtures não pessoais.');
