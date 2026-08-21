import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
async function main() {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'openapi-generation-only';
  }
  const [{ AppModule }, { PrismaService }] = await Promise.all([
    import('../app.module.js'),
    import('../prisma/prisma.service.js'),
  ]);
  const testingModule = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();
  const app = testingModule.createNestApplication();
  await app.init();
  const releaseId = process.env.VITE_RELEASE_ID || process.env.RELEASE_ID || process.env.GIT_COMMIT || 'local';

  const config = new DocumentBuilder()
    .setTitle('Zelare API')
    .setDescription('Contrato HTTP da plataforma educacional multi-tenant Zelare.')
    .setVersion(releaseId)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addCookieAuth('access_token', { type: 'apiKey', in: 'cookie' }, 'cookie')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });
  const outputPath = resolve(process.env.OPENAPI_OUTPUT || 'dist/openapi.json');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();

  console.log(`OpenAPI gerado: ${outputPath}`);
  console.log(`Release documentado: ${releaseId}`);
  console.log(`Rotas documentadas: ${Object.keys(document.paths ?? {}).length}`);
}

main().catch((error) => {
  console.error('Falha ao gerar OpenAPI:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
