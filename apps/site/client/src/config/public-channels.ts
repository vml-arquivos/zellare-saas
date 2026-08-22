export type PublicInstitutionalChannels = Readonly<{
  contactEmail: string;
  complianceEmail: string;
  phone: string;
  address: string;
}>;

type PublicChannelEnv = Record<string, string | undefined>;

/**
 * Valores públicos históricos do Zelare, usados somente em desenvolvimento e
 * testes. O build de produção exige que todos os quatro canais venham do
 * ambiente autorizado; nenhum fallback fictício pode chegar ao bundle público.
 */
export const PUBLIC_CHANNEL_DEFAULTS: PublicInstitutionalChannels = Object.freeze({
  contactEmail: 'contato@zelare.com.br',
  complianceEmail: 'denuncia@zelare.com.br',
  phone: '(61) 2123-4567',
  address: 'Brasília-DF',
});

const ENV_NAMES = {
  contactEmail: 'VITE_PUBLIC_CONTACT_EMAIL',
  complianceEmail: 'VITE_PUBLIC_COMPLIANCE_EMAIL',
  phone: 'VITE_PUBLIC_PHONE',
  address: 'VITE_PUBLIC_ADDRESS',
} as const;

function assertEmail(name: string, value: string): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /example\.invalid$/i.test(value)) {
    throw new Error(`[Zelare] ${name} deve ser um e-mail institucional válido.`);
  }
  return value;
}

function assertPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10 || /^0+$/.test(digits)) {
    throw new Error('[Zelare] VITE_PUBLIC_PHONE deve ser um telefone institucional válido.');
  }
  return value;
}

function assertAddress(value: string): string {
  if (value.length < 3 || /disponível no ambiente autorizado|endereço sintético/i.test(value)) {
    throw new Error('[Zelare] VITE_PUBLIC_ADDRESS deve ser um endereço institucional válido.');
  }
  return value;
}

export function createPublicChannels(
  runtimeEnv: PublicChannelEnv,
  production: boolean,
): PublicInstitutionalChannels {
  const read = (key: keyof typeof ENV_NAMES): string => {
    const value = runtimeEnv[ENV_NAMES[key]]?.trim();
    if (value) return value;
    if (!production) return PUBLIC_CHANNEL_DEFAULTS[key];
    throw new Error(
      `[Zelare] Configuração pública obrigatória ausente: ${ENV_NAMES[key]}. ` +
        'Defina o canal institucional no ambiente de produção antes do build.',
    );
  };

  return Object.freeze({
    contactEmail: assertEmail(ENV_NAMES.contactEmail, read('contactEmail')),
    complianceEmail: assertEmail(ENV_NAMES.complianceEmail, read('complianceEmail')),
    phone: assertPhone(read('phone')),
    address: assertAddress(read('address')),
  });
}

export const PUBLIC_CHANNELS = createPublicChannels(
  import.meta.env as PublicChannelEnv,
  import.meta.env.PROD,
);

export function publicChannelMailto(email: string): string {
  return `mailto:${email}`;
}

export function publicChannelTel(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('55') ? digits : `55${digits}`;
  return `tel:+${normalized}`;
}
