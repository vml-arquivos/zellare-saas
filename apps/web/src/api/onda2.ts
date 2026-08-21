import http from './http';

export type Onda2UnitRow = {
  unit: { id: string; name: string; code: string };
  eventsToday: number;
  openSessions: number;
  activeBreaches: number;
  openRequests: number;
  openWorkOrders: number;
  overdueWorkOrders: number;
};

export type Onda2CommandCenter = {
  generatedAt: string;
  scope: 'NETWORK' | 'UNIT';
  governance: { diagnosticInference: false; humanReviewRequired: true };
  units: Onda2UnitRow[];
  totals: Omit<Onda2UnitRow, 'unit'>;
};

export type Onda2FacilitiesSummary = {
  generatedAt: string;
  unitId: string | null;
  spaces: number;
  assets: number;
  openRequests: number;
  openWorkOrders: number;
  overdueWorkOrders: number;
  governance: { diagnosticInference: false; humanReviewRequired: true };
};

export async function getOnda2CommandCenter(unitId?: string): Promise<Onda2CommandCenter> {
  const response = await http.get<Onda2CommandCenter>('/onda2/pulse', { params: unitId ? { unitId } : undefined });
  return response.data;
}

export async function getOnda2FacilitiesSummary(unitId?: string): Promise<Onda2FacilitiesSummary> {
  const response = await http.get<Onda2FacilitiesSummary>('/onda2/facilities/summary', { params: unitId ? { unitId } : undefined });
  return response.data;
}

export async function getOnda2AccessibleUnits(): Promise<Array<{ id: string; name: string; code?: string }>> {
  const response = await http.get('/lookup/units/accessible');
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.units)) return data.units;
  return [];
}
