const command = process.argv[2] ?? 'command';

console.error(
  `@zelare/database é legado e não executa Prisma (${command}). Use apps/api/prisma/schema.prisma e apps/api/prisma/migrations como fonte canônica.`,
);
process.exit(1);
