/**
 * Seed seguro para desenvolvimento local.
 *
 * O Zelare não distribui cadastros reais nem executa seed automaticamente.
 * Fixtures de demonstração devem ser criadas em banco descartável por um
 * procedimento explícito e versionado, nunca a partir de planilhas pessoais.
 */

if (process.env.ALLOW_SYNTHETIC_SEED !== 'true') {
  console.log('Seed desabilitado. Defina ALLOW_SYNTHETIC_SEED=true apenas em banco descartável.');
  process.exit(0);
}

console.log('Nenhuma fixture sintética foi aplicada: use o harness de banco descartável do CI.');
