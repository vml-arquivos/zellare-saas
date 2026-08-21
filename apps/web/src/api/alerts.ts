import http from './http';

export interface OperationalAlert {
  id: string;
  mantenedoraId: string;
  unitId?: string | null;
  classroomId?: string | null;
  childId?: string | null;
  tipo: string;
  canal?: 'OPERACIONAL' | 'ACOMPANHAMENTO' | string;
  prioridadeOperacional?: 'NORMAL' | 'URGENTE' | string;
  severidade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA' | string;
  titulo: string;
  descricao?: string | null;
  metadados?: Record<string, unknown> | null;
  resolvido: boolean;
  resolvidoPorId?: string | null;
  resolvidoEm?: string | null;
  criadoEm: string;
}

export interface OperationalAlertSummary {
  total: number;
  criticos: number;
  atencao: number;
  urgentes?: OperationalAlert[];
  acompanhamento?: OperationalAlert[];
  urgentesTotal?: number;
  acompanhamentoTotal?: number;
  alertas: OperationalAlert[];
}

export async function getOperationalAlerts(params?: {
  unitId?: string;
  classroomId?: string;
  limit?: number;
  unread?: boolean;
  canal?: 'OPERACIONAL' | 'ACOMPANHAMENTO';
  prioridade?: 'NORMAL' | 'URGENTE';
}): Promise<OperationalAlertSummary> {
  const response = await http.get<OperationalAlertSummary>('/alertas', {
    params: {
      ...params,
      unread: params?.unread === false ? 'false' : 'true',
    },
  });
  return response.data;
}

export async function resolveOperationalAlert(alertId: string): Promise<OperationalAlert> {
  const response = await http.patch<OperationalAlert>(`/alertas/${alertId}/resolver`);
  return response.data;
}
