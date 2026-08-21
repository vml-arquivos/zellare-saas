import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(new URL('../../../', import.meta.url).pathname);
const webRoot = join(repoRoot, 'apps/web');
const openapiPath = resolve(process.env.OPENAPI_PATH || join(repoRoot, 'apps/api/dist/openapi.json'));

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

function normalizePath(path) {
  const querySuffixRemoved = path.replace(/\$\{(?:params|query)\}$/, '');
  const withoutQuery = querySuffixRemoved.split(/[?#]/, 1)[0];
  const withParameters = withoutQuery.replace(/\$\{[^}]+\}/g, '{param}');
  const normalized = withParameters.replace(/\/+$/, '') || '/';
  return normalized;
}

function equivalentPath(candidate, documented) {
  const candidateParts = normalizePath(candidate).split('/').filter(Boolean);
  const documentedParts = normalizePath(documented).split('/').filter(Boolean);
  if (candidateParts.length !== documentedParts.length) return false;
  return candidateParts.every((part, index) => {
    const target = documentedParts[index];
    return part === target || /^\{[^}]+\}$/.test(target) || part === '{param}';
  });
}

const document = JSON.parse(await readFile(openapiPath, 'utf8'));
const paths = document.paths || {};
const errors = [];

if (document.openapi !== '3.0.0') errors.push(`OpenAPI inesperado: ${document.openapi}`);
if (!document.info?.title || !document.info?.version) errors.push('OpenAPI sem info.title/info.version');
if (Object.keys(paths).length === 0) errors.push('OpenAPI sem paths');

for (const [path, item] of Object.entries(paths)) {
  if (!path.startsWith('/')) errors.push(`path sem barra inicial: ${path}`);
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']) {
    const operation = item[method];
    if (!operation) continue;
    if (!operation.responses || Object.keys(operation.responses).length === 0) {
      errors.push(`operação sem responses: ${method.toUpperCase()} ${path}`);
    }
  }
}

const sourceFiles = await walk(join(webRoot, 'src'));
const calls = [];
const callPattern = /\bhttp\.(get|post|put|patch|delete)\(\s*(['"`])((?:\\.|(?!\2).)*)\2/g;
for (const file of sourceFiles) {
  const content = await readFile(file, 'utf8');
  for (const match of content.matchAll(callPattern)) {
    const method = match[1].toLowerCase();
    const path = match[3].replace(/\\(['"`])/g, '$1');
    if (!path.startsWith('/')) continue;
    calls.push({ method, path, file: relative(repoRoot, file) });
  }
}

for (const call of calls) {
  const documented = Object.entries(paths).some(([path, item]) => {
    return Boolean(item[call.method]) && equivalentPath(call.path, path);
  });
  if (!documented) {
    errors.push(`frontend sem operação OpenAPI: ${call.method.toUpperCase()} ${call.path} (${call.file})`);
  }
}

const forbidden = [
  '/admin/users/{id}/reset-password',
  '/admin/users/{id}',
];
for (const path of forbidden) {
  if (paths[path]?.delete || paths[path]?.post) {
    errors.push(`OpenAPI expõe operação proibida neste gate: ${path}`);
  }
}

if (errors.length > 0) {
  console.error('OpenAPI/contratos: FAIL');
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}

console.log('OpenAPI/contratos: PASS');
console.log(`Rotas OpenAPI verificadas: ${Object.keys(paths).length}`);
console.log(`Chamadas HTTP frontend verificadas: ${calls.length}`);
console.log(`Release documentado: ${document.info.version}`);
