import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const sourceRoot = join(root, 'src');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

const files = await walk(sourceRoot);
const contents = new Map();
for (const file of files) contents.set(file, await readFile(file, 'utf8'));

const forbidden = [
  { needle: "http.get('/atendimento-pais'", reason: 'atendimento aos pais deve usar o endpoint plural /atendimentos-pais' },
  { needle: "http.get('/users?limit=", reason: 'listagem administrativa deve usar /admin/users' },
  { needle: 'conexa-relatorio-central', reason: 'o exportador central não pode usar nome legado COCRIS/Conexa' },
  { needle: 'Exibindo dados de demonstração', reason: 'falhas reais não podem ser apresentadas como dados demo' },
  { needle: 'Exibindo dados de demonstracao', reason: 'falhas reais não podem ser apresentadas como dados demo' },
];

const errors = [];
for (const [file, content] of contents) {
  for (const rule of forbidden) {
    if (content.includes(rule.needle)) {
      errors.push(`${relative(root, file)} contém "${rule.needle}": ${rule.reason}`);
    }
  }
}

const viteConfig = await readFile(join(root, 'vite.config.ts'), 'utf8');
if (viteConfig.includes("cacheName: 'api-cache'")) {
  errors.push('vite.config.ts ainda declara api-cache para respostas autenticadas');
}
if (!viteConfig.includes("cacheName: 'assets-cache'")) {
  errors.push('vite.config.ts deve manter cache explícito somente para assets estáticos');
}

const timeline = contents.get(join(sourceRoot, 'pages/TimelineCriancaPage.tsx')) ?? '';
if (!timeline.includes("http.get('/atendimentos-pais'")) {
  errors.push('TimelineCriancaPage.tsx não contém o endpoint canônico /atendimentos-pais');
}

const settings = contents.get(join(sourceRoot, 'pages/ConfiguracoesPage.tsx')) ?? '';
if (!settings.includes("http.get('/admin/users'")) {
  errors.push('ConfiguracoesPage.tsx não contém /admin/users');
}

if (errors.length > 0) {
  console.error('Falha no contrato frontend:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Contratos frontend aprovados (${files.length} arquivos-fonte verificados).`);
