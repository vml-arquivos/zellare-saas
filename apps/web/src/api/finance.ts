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

export type FinancePayrollStatus =
  | 'RASCUNHO'
  | 'CALCULADA'
  | 'EM_CONFERENCIA'
  | 'APROVADA'
  | 'FECHADA'
  | 'RETIFICADA';

export type FinancePayableStatus =
  | 'RASCUNHO'
  | 'EM_APROVACAO'
  | 'APROVADA'
  | 'AGENDADA'
  | 'PAGA'
  | 'CONCILIADA'
  | 'CANCELADA';

export type FinancePurchaseStatus = 'ABERTA' | 'RECEBIDA' | 'CANCELADA';
export type FinanceStockMovementType = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'TRANSFERENCIA';

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

export interface PayrollApproval {
  id: string;
  actorId: string;
  fromStatus: FinancePayrollStatus;
  toStatus: FinancePayrollStatus;
  comment?: string | null;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  periodId: string;
  status: FinancePayrollStatus;
  totalGross: string | number;
  totalDeductions: string | number;
  totalNet: string | number;
  totalCharges: string | number;
  computedAt?: string | null;
  approvedAt?: string | null;
  closedAt?: string | null;
  approvalHistory?: PayrollApproval[];
}

export interface Payable {
  id: string;
  beneficiary: string;
  description: string;
  category: string;
  dueDate: string;
  amount: string | number;
  status: FinancePayableStatus;
  paymentRef?: string | null;
}

export interface StockItem {
  id: string;
  unitId: string;
  code: string;
  name: string;
  description?: string | null;
  quantity: number;
  minimumQuantity: number;
  location?: string | null;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  unitId: string;
  stockItemId: string;
  movementType: FinanceStockMovementType;
  quantity: number;
  unitCost?: string | number | null;
  sourceType: string;
  sourceId?: string | null;
  createdAt: string;
}

export interface PurchaseQuote {
  id: string;
  unitId: string;
  purchaseId?: string | null;
  supplierId?: string | null;
  status: FinancePurchaseStatus;
  quotedAt: string;
  totalAmount: string | number;
  documentRef?: string | null;
  notes?: string | null;
}

export interface GoodsReceipt {
  id: string;
  unitId: string;
  purchaseId: string;
  status: FinancePurchaseStatus;
  receivedAt: string;
  receivedBy: string;
  items: Array<{ stockItemId: string; quantity: number; unitCost?: number }>;
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

export async function createTimeEntry(payload: {
  employeeId: string;
  workDate: string;
  clockIn?: string;
  clockOut?: string;
  breakMinutes?: number;
  periodId?: string;
  notes?: string;
}) {
  const response = await http.post<TimeEntry>('/finance/time-entries', payload);
  return response.data;
}

export async function submitTimeEntry(id: string) {
  const response = await http.patch<TimeEntry>(`/finance/time-entries/${id}/submit`);
  return response.data;
}

export async function listPayrolls(periodId?: string) {
  const response = await http.get<PayrollRun[]>('/finance/payrolls', {
    params: periodId ? { periodId } : undefined,
  });
  return response.data;
}

export async function calculatePayroll(periodId: string) {
  const response = await http.post<PayrollRun>('/finance/payrolls', { periodId });
  return response.data;
}

export async function updatePayrollStatus(id: string, status: FinancePayrollStatus, comment?: string) {
  const response = await http.patch<PayrollRun>(`/finance/payrolls/${id}/status`, {
    status,
    comment: comment?.trim() || undefined,
  });
  return response.data;
}

export async function listPayables(params?: {
  unitId?: string;
  periodId?: string;
  status?: FinancePayableStatus;
}) {
  const response = await http.get<Payable[]>('/finance/payables', { params });
  return response.data;
}

export async function createPayable(payload: {
  unitId?: string;
  periodId?: string;
  supplierId?: string;
  beneficiary: string;
  description: string;
  category: string;
  sourceType: string;
  dueDate: string;
  amount: number;
  documentRef?: string;
}) {
  const response = await http.post<Payable>('/finance/payables', payload);
  return response.data;
}

export async function updatePayableStatus(
  id: string,
  status: FinancePayableStatus,
  paymentRef?: string,
) {
  const response = await http.patch<Payable>(`/finance/payables/${id}/status`, {
    status,
    paymentRef,
  });
  return response.data;
}

export async function listStockItems(unitId?: string) {
  const response = await http.get<StockItem[]>('/finance/stock-items', {
    params: unitId ? { unitId } : undefined,
  });
  return response.data;
}

export async function createStockItem(payload: {
  unitId: string;
  code: string;
  name: string;
  description?: string;
  minimumQuantity?: number;
  location?: string;
}) {
  const response = await http.post<StockItem>('/finance/stock-items', payload);
  return response.data;
}

export async function listStockMovements(unitId?: string) {
  const response = await http.get<StockMovement[]>('/finance/stock-movements', {
    params: unitId ? { unitId } : undefined,
  });
  return response.data;
}

export async function createStockMovement(payload: {
  unitId: string;
  stockItemId: string;
  movementType: FinanceStockMovementType;
  quantity: number;
  unitCost?: number;
  sourceType: string;
  reason?: string;
}) {
  const response = await http.post<StockMovement>('/finance/stock-movements', payload);
  return response.data;
}

export async function listPurchaseQuotes(params?: { unitId?: string; status?: FinancePurchaseStatus }) {
  const response = await http.get<PurchaseQuote[]>('/finance/purchase-quotes', { params });
  return response.data;
}

export async function createPurchaseQuote(payload: {
  unitId: string;
  purchaseId?: string;
  supplierId?: string;
  status: FinancePurchaseStatus;
  totalAmount: number;
  documentRef?: string;
  notes?: string;
}) {
  const response = await http.post<PurchaseQuote>('/finance/purchase-quotes', payload);
  return response.data;
}

export async function listGoodsReceipts(unitId?: string) {
  const response = await http.get<GoodsReceipt[]>('/finance/goods-receipts', {
    params: unitId ? { unitId } : undefined,
  });
  return response.data;
}

export async function createGoodsReceipt(payload: {
  unitId: string;
  purchaseId: string;
  items: Array<{ stockItemId: string; quantity: number; unitCost?: number }>;
  documentRef?: string;
  notes?: string;
}) {
  const response = await http.post<GoodsReceipt>('/finance/goods-receipts', payload);
  return response.data;
}

export interface FinanceOverview {
  scope: { mantenedoraId: string; unitId: string | null };
  periods: {
    total: number;
    open: number;
    inConference: number;
    approved: number;
    closed: number;
    latest: FinancialPeriod | null;
  };
  payroll: {
    runs: number;
    latestStatus: FinancePayrollStatus | null;
    latestNet: number;
    latestGross: number;
  };
  payables: {
    total: number;
    pending: number;
    overdue: number;
    pendingAmount: number;
    overdueAmount: number;
  };
  stock: {
    items: number;
    lowStock: number;
    totalQuantity: number;
    lowStockItems: Array<Pick<StockItem, 'id' | 'name' | 'unitId' | 'quantity' | 'minimumQuantity'>>;
  };
  purchasing: { quotes: number; openQuotes: number; receipts: number };
  time: { entries: number; byStatus: Record<string, number> };
  generatedAt: string;
}

export async function getFinanceOverview(unitId?: string) {
  const response = await http.get<FinanceOverview>('/finance/overview', {
    params: unitId ? { unitId } : undefined,
  });
  return response.data;
}
