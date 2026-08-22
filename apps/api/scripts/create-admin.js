/**
 * Cria uma conta administrativa inicial usando valores fornecidos no momento da execução.
 *
 * Variáveis aceitas:
 *   ZELARE_ADMIN_EMAIL
 *   ZELARE_ADMIN_PASSWORD
 *   ZELARE_ADMIN_FIRST_NAME
 *   ZELARE_ADMIN_LAST_NAME
 *
 * Argumentos opcionais: email senha primeiroNome ultimoNome.
 * Nunca registre a senha em documentação, shell history ou logs.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function requiredValue(argument, environmentName, label) {
  const value = argument || process.env[environmentName];
  if (!value) throw new Error(`${label} deve ser fornecido por argumento ou ${environmentName}`);
  return value;
}

async function createAdmin() {
  try {
    const email = requiredValue(process.argv[2], 'ZELARE_ADMIN_EMAIL', 'E-mail administrativo');
    const password = requiredValue(process.argv[3], 'ZELARE_ADMIN_PASSWORD', 'Senha administrativa');
    const firstName = process.argv[4] || process.env.ZELARE_ADMIN_FIRST_NAME || 'Admin';
    const lastName = process.argv[5] || process.env.ZELARE_ADMIN_LAST_NAME || 'Sistema';

    if (password.length < 12) throw new Error('A senha administrativa deve ter pelo menos 12 caracteres');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail administrativo inválido');

    console.log('Criando usuário administrador com valores fornecidos pelo operador autorizado...');

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      console.log('Usuário já existe; nenhuma senha foi alterada.');
      console.log('E-mail:', existingUser.email);
      console.log('Nome:', existingUser.firstName, existingUser.lastName);
      console.log('Role:', existingUser.roleLevel);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        roleLevel: 'DEVELOPER',
        isActive: true,
      },
    });

    console.log('Usuário administrador criado com sucesso.');
    console.log('E-mail:', admin.email);
    console.log('Nome:', admin.firstName, admin.lastName);
    console.log('Role:', admin.roleLevel);
    console.log('A senha não é exibida. Troque-a após o primeiro acesso e remova o segredo temporário do gerenciador de segredos.');
  } catch (error) {
    console.error('Erro ao criar administrador:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
