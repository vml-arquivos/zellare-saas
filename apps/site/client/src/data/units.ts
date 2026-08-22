// ============================================================================
// Dados sintéticos de fallback das unidades Zelare.
// Usado somente quando o banco público não estiver disponível.
// Não contém cadastro de instituição, pessoa, endereço, telefone ou coordenada.
// ============================================================================

export interface UnitData {
  id: number;
  unitCode: string;
  unitName: string;
  slug: string;
  mantenedoraName: string;
  city: string;
  state: string;
  addressPublic: string;
  phonePublic: string;
  emailPublic: string;
  websiteUrl: string;
  description: string;
  imageUrl: string;
  latitude: string;
  longitude: string;
  active: boolean;
}

export const UNITS_STATIC: UnitData[] = [
  {
    id: 1,
    unitCode: 'DEMO-001',
    unitName: 'Unidade de Demonstração 1',
    slug: 'unidade-demonstracao-1',
    mantenedoraName: 'Mantenedora de Demonstração',
    city: 'Cidade de Demonstração',
    state: 'XX',
    addressPublic: 'Endereço sintético',
    phonePublic: '',
    emailPublic: 'contato@example.invalid',
    websiteUrl: 'https://example.invalid',
    description: 'Unidade sintética para demonstração do ecossistema educacional.',
    imageUrl: '',
    latitude: '',
    longitude: '',
    active: true,
  },
  {
    id: 2,
    unitCode: 'DEMO-002',
    unitName: 'Unidade de Demonstração 2',
    slug: 'unidade-demonstracao-2',
    mantenedoraName: 'Mantenedora de Demonstração',
    city: 'Cidade de Demonstração',
    state: 'XX',
    addressPublic: 'Endereço sintético',
    phonePublic: '',
    emailPublic: 'contato@example.invalid',
    websiteUrl: 'https://example.invalid',
    description: 'Unidade sintética para demonstração do ecossistema educacional.',
    imageUrl: '',
    latitude: '',
    longitude: '',
    active: true,
  },
  {
    id: 3,
    unitCode: 'DEMO-003',
    unitName: 'Unidade de Demonstração 3',
    slug: 'unidade-demonstracao-3',
    mantenedoraName: 'Mantenedora de Demonstração',
    city: 'Cidade de Demonstração',
    state: 'XX',
    addressPublic: 'Endereço sintético',
    phonePublic: '',
    emailPublic: 'contato@example.invalid',
    websiteUrl: 'https://example.invalid',
    description: 'Unidade sintética para demonstração do ecossistema educacional.',
    imageUrl: '',
    latitude: '',
    longitude: '',
    active: true,
  },
];

export function getUnitBySlug(slug: string): UnitData | undefined {
  return UNITS_STATIC.find((u) => u.slug === slug);
}

export function getActiveUnits(): UnitData[] {
  return UNITS_STATIC.filter((u) => u.active);
}
