const required = {
  VITE_PUBLIC_CONTACT_EMAIL: process.env.VITE_PUBLIC_CONTACT_EMAIL,
  VITE_PUBLIC_COMPLIANCE_EMAIL: process.env.VITE_PUBLIC_COMPLIANCE_EMAIL,
  VITE_PUBLIC_PHONE: process.env.VITE_PUBLIC_PHONE,
  VITE_PUBLIC_ADDRESS: process.env.VITE_PUBLIC_ADDRESS,
};

const errors = [];
for (const [name, rawValue] of Object.entries(required)) {
  const value = rawValue?.trim();
  if (!value) {
    errors.push(`${name} ausente`);
    continue;
  }
  if (name.endsWith('EMAIL') && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /example\.invalid$/i.test(value))) {
    errors.push(`${name} inválido`);
  }
  if (name === 'VITE_PUBLIC_PHONE' && (value.replace(/\D/g, '').length < 10 || /^0+$/.test(value.replace(/\D/g, '')))) {
    errors.push(`${name} inválido`);
  }
  if (name === 'VITE_PUBLIC_ADDRESS' && (value.length < 3 || /disponível no ambiente autorizado|endereço sintético/i.test(value))) {
    errors.push(`${name} inválido`);
  }
}

if (errors.length > 0) {
  console.error('[Zelare] Build de produção interrompido: configuração pública obrigatória inválida.');
  for (const error of errors) console.error(`- ${error}`);
  console.error('Configure os quatro canais institucionais no ambiente autorizado e execute o build novamente.');
  process.exit(1);
}

console.log('[Zelare] Canais institucionais públicos validados para o build.');
