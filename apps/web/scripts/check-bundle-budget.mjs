import { gzipSync } from 'node:zlib';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const dist = resolve(new URL('../dist', import.meta.url).pathname);
const INITIAL_JS_MAX = 3_400_000;
const INITIAL_GZIP_MAX = 700_000;
const PRECACHE_MAX = 5_000_000;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else files.push(file);
  }
  return files;
}

const files = await walk(dist);
const initial = files.filter((file) => /\/assets\/index-[^/]+\.js$/.test(file));
if (initial.length !== 1) throw new Error(`Esperava um único bundle inicial index-*.js; encontrados ${initial.length}`);
const initialBuffer = await readFile(initial[0]);
const initialGzip = gzipSync(initialBuffer);
const precacheFiles = files.filter((file) => {
  const relative = file.slice(dist.length + 1);
  return relative === 'index.html' || relative === 'manifest.webmanifest' || relative === 'sw.js' || relative.startsWith('workbox-') || relative.startsWith('assets/');
});
let precacheBytes = 0;
for (const file of precacheFiles) precacheBytes += (await stat(file)).size;

const metrics = {
  initialJsBytes: initialBuffer.byteLength,
  initialJsGzipBytes: initialGzip.byteLength,
  precacheStaticBytes: precacheBytes,
  initialJsFile: initial[0].slice(dist.length + 1),
  limits: { initialJsBytes: INITIAL_JS_MAX, initialJsGzipBytes: INITIAL_GZIP_MAX, precacheStaticBytes: PRECACHE_MAX },
};
console.log(JSON.stringify(metrics, null, 2));

const errors = [];
if (metrics.initialJsBytes > INITIAL_JS_MAX) errors.push(`bundle inicial excede ${INITIAL_JS_MAX} bytes`);
if (metrics.initialJsGzipBytes > INITIAL_GZIP_MAX) errors.push(`gzip inicial excede ${INITIAL_GZIP_MAX} bytes`);
if (metrics.precacheStaticBytes > PRECACHE_MAX) errors.push(`precache estático excede ${PRECACHE_MAX} bytes`);
if (errors.length) {
  for (const error of errors) console.error(`Bundle/PWA budget: ${error}`);
  process.exit(1);
}
console.log('Bundle/PWA budget: PASS');
