import http from './http';

export interface ReportData {
  [key: string]: unknown;
}

export async function getDiaryByClassroom(classroomId: string, startDate: string, endDate: string): Promise<ReportData[]> {
  const response = await http.get('/reports/diary/by-classroom', { params: { classroomId, startDate, endDate } });
  return response.data;
}

export async function getDiaryByPeriod(startDate: string, endDate: string, unitId?: string): Promise<ReportData[]> {
  const params: Record<string, string> = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (unitId) params.unitId = unitId;
  const response = await http.get('/reports/diary/by-period', { params });
  return response.data;
}

export async function getDiaryUnplanned(unitId?: string): Promise<ReportData[]> {
  const params: Record<string, string> = {};
  if (unitId) params.unitId = unitId;
  const response = await http.get('/reports/diary/unplanned', { params });
  return response.data;
}

// Sprint 6 Fix: Dashboards corretos de unidade e professor

/**
 * Dashboard da Unidade - KPIs operacionais e pedagógicos
 */
export interface UnitDashboardData {
  unitId: string;
  period: {
    from: string;
    to: string;
  };
  kpis: {
    diaryCreatedTotal: number;
    unplannedCount: number;
    planningsDraftOrPending: number;
    classroomsCount: number;
    activeChildrenCount: number;
  };
}

export async function getUnitDashboard(params: {
  unitId?: string;
  from?: string;
  to?: string;
}): Promise<UnitDashboardData> {
  const response = await http.get('/reports/dashboard/unit', { params });
  return response.data;
}

/**
 * Dashboard do Professor - KPIs por turma no dia
 */
export interface TeacherDashboardData {
  date: string;
  classrooms: Array<{
    classroomId: string;
    classroomName: string;
    totalDiaryEvents: number;
    unplannedEvents: number;
    microGesturesFilled: number;
    activePlanningStatus: string | null;
  }>;
}

export async function getTeacherDashboard(params: {
  date?: string;
  classroomId?: string;
}): Promise<TeacherDashboardData> {
  const response = await http.get('/reports/dashboard/teacher', { params });
  return response.data;
}


export interface DiarySummaryData {
  mes: string;
  unitId: string | null;
  classroomId: string | null;
  totalDiarios: number;
  publicados: number;
  rascunhos: number;
  presencaMedia: number | null;
  climaEmocional: Record<string, number>;
  execucaoPlano: Record<string, number>;
  microgestosTipos: Record<string, number>;
  momentosDestaque: string[];
}

export interface UnitCoverageData {
  unitId: string;
  startDate: string;
  endDate: string;
  totalCriancas: number;
  totalComRegistro: number;
  percentualGeral: number;
  turmas: Array<{
    classroomId: string;
    classroomName: string;
    totalCriancas: number;
    criancasComRegistro: number;
    percentual: number;
  }>;
}

export interface UnitPendingsData {
  unitId: string;
  daysWithout: number;
  cutoffDate: string;
  totalPendentes: number;
  pendentes: Array<{
    childId: string;
    nome: string;
    classroomId: string;
    classroomName: string;
  }>;
}

export interface CentralCoverageData {
  startDate: string;
  endDate: string;
  daysWithout: number;
  totalUnidades: number;
  totalCriancas?: number;
  totalComRegistro?: number;
  percentualGeral?: number;
  unidades: Array<{
    unitId: string;
    unitName: string;
    totalCriancas: number;
    totalComRegistro: number;
    percentualCobertura: number;
    totalPendentes: number;
    turmas: UnitCoverageData['turmas'];
  }>;
}

export async function getDiarySummary(params: {
  unitId?: string;
  classroomId?: string;
  mes?: string;
}): Promise<DiarySummaryData> {
  const response = await http.get('/reports/diary/summary', { params });
  return response.data;
}

export async function getUnitCoverage(params: {
  unitId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<UnitCoverageData> {
  const response = await http.get('/reports/unit/coverage', { params });
  return response.data;
}

export async function getUnitPendings(params: {
  unitId?: string;
  daysWithout?: number;
}): Promise<UnitPendingsData> {
  const response = await http.get('/reports/unit/pendings', { params });
  return response.data;
}

export async function getCentralCoverage(params: {
  startDate?: string;
  endDate?: string;
  daysWithout?: number;
}): Promise<CentralCoverageData> {
  const response = await http.get('/reports/central/coverage', { params });
  return response.data;
}


export interface ClassroomExpressSummary {
  classroom: { id: string; name: string };
  periodo: { startDate: string; endDate: string };
  totalCriancas: number;
  cobertura: { comRegistros: number; semRegistros: number; percentual: number };
  totalDiarios: number;
  totalObservacoes: number;
  totalMicrogestos: number;
  totalPontosAtencao: number;
  criancas: Array<{
    childId: string;
    nome: string;
    diarios: number;
    observacoes: number;
    microgestos: number;
    diasComRegistro: number;
    porNivel: Record<string, number>;
    pontosAtencao: number;
    tendencia: 'SEM_DADOS' | 'ATENCAO' | 'FAVORAVEL' | 'EM_DESENVOLVIMENTO' | string;
  }>;
}

export async function getClassroomExpressSummary(params: {
  classroomId: string;
  startDate?: string;
  endDate?: string;
}): Promise<ClassroomExpressSummary> {
  const response = await http.get('/rdic/turma/express-summary', { params });
  return response.data;
}
