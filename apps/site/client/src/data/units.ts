/**
 * Contrato dos dados públicos de uma unidade.
 *
 * Unidades públicas não são mantidas neste bundle: elas vêm do banco do site
 * por meio das rotas tRPC. A lista vazia existe apenas para compatibilidade
 * com consumidores legados e nunca é usada como fallback de produção.
 */
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

export const UNITS_STATIC: readonly UnitData[] = Object.freeze([]);

export function getUnitBySlug(_slug: string): UnitData | undefined {
  return undefined;
}

export function getActiveUnits(): readonly UnitData[] {
  return UNITS_STATIC;
}
