const fs = require('node:fs');
const path = require('node:path');

const apiRoot = path.resolve(__dirname, '..');
const publicFiles = [
  'data/catalogo_administrativo.csv',
  'data/catalogo_alimentos.csv',
  'data/catalogo_higiene_pessoal.csv',
  'data/catalogo_materiais_higiene_pedagogico.csv',
  'data/catalogo_pedagogico.csv',
  'data/matriz-curricular-2026-sample.json',
  'datasets/materiais_seed.json',
];

const destinationRoot = path.join(apiRoot, 'dist');

for (const relativeFile of publicFiles) {
  const source = path.join(apiRoot, relativeFile);
  const destination = path.join(destinationRoot, relativeFile);
  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo público permitido não encontrado: ${relativeFile}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  console.log(`Public fixture copied: ${relativeFile}`);
}

console.log(`Public fixtures copied: ${publicFiles.length}`);
