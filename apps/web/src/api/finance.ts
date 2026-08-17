import http from './http';

export type FinancePeriodStatus =
  | 'ABERTA'
  | 'EM_CONFERENCIA'
  | 'APROVADA'
  | 'FECHADA'
  | 'REABERTA';

export type FinanceTimeEntryStatus =
  | 'RASCUNHO'
  | 'ENVIADO'
  | 'EM_ANALISE'
  | 'APROVADO'
  | 'REJEITADO';

export interface FinancialPeriod {
  id: string;
  referenceMonth: string;
  status: FinancePeriodStatus;
  closedAt?: string | null;
}

export interface EmployeeProfile {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  unitId?: string | null;
  roleType?: string | null;
  employmentStatus: string;
  baseSalary?: string | number | null;
  weeklyHours?: string | number | null;
  costCenter?: string | null;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  periodId?: string | null;
  workDate: string;
  clockIn?: string | null;
  clockOut?: string | null;
  workedMinutes?: number | null;
  status: FinanceTimeEntryStatus;
  source: string;
  notes?: string | null;
}

export async function listFinancialPeriods() {
  const response = await http.get<FinancialPeriod[]>('/finance/periods');
  return response.data;
}

export async function createFinancialPeriod(referenceMonth: string) {
  const response = await http.post<FinancialPeriod>('/finance/periods', { referenceMonth });
  return response.data;
}

export async function updateFinancialPeriodStatus(
  periodId: string,
  status: FinancePeriodStatus,
  reason?: string,
) {
  const response = await http.patch<FinancialPeriod>(`/finance/periods/${periodId}/status`, {
    status,
    reason,
  });
  return response.data;
}

export async function listEmployees(unitId?: string) {
  const response = await http.get<EmployeeProfile[]>('/finance/employees', {
    params: unitId ? { unitId } : undefined,
  });
  return response.data;
}

export async function listTimeEntries(params?: {
  periodId?: string;
  employeeId?: string;
  unitId?: string;
  status?: FinanceTimeEntryStatus;
}) {
  const response = await http.get<TimeEntry[]>('/finance/time-entries', { params });
  return response.data;
}

export async function submitTimeEntry(id: string) {
  const response = await http.patch<TimeEntry>(`/finance/time-entries/${id}/submit`);
  return response.data;
}
