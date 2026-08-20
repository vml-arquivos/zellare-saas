import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Receipt,
  ShoppingCart,
  Users,
  WalletCards,
} from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import {
  calculatePayroll,
  getFinanceOverview,
  createFinancialPeriod,
  createGoodsReceipt,
  createPayable,
  createPurchaseQuote,
  createStockItem,
  createTimeEntry,
  submitTimeEntry,
  createStockMovement,
  listEmployees,
  listFinancialPeriods,
  listGoodsReceipts,
  listPayables,
  listPayrolls,
  listPurchaseQuotes,
  listStockItems,
  listStockMovements,
  listTimeEntries,
  updateFinancialPeriodStatus,
  updatePayableStatus,
  updatePayrollStatus,
  type EmployeeProfile,
  type FinancePayableStatus,
  type FinancePayrollStatus,
  type FinancePeriodStatus,
  type FinancePurchaseStatus,
  type FinanceStockMovementType,
  type FinancialPeriod,
  type FinanceOverview,
  type GoodsReceipt,
  type Payable,
  type PayrollRun,
  type PurchaseQuote,
  type StockItem,
  type StockMovement,
  type TimeEntry,
} from '../api/finance';

const STATUS_LABELS: Record<FinancePeriodStatus, string> = {
  ABERTA: 'Aberta',
  EM_CONFERENCIA: 'Em conferência',
  APROVADA: 'Aprovada',
  FECHADA: 'Fechada',
  REABERTA: 'Reaberta',
};

const STATUS_COLORS: Record<FinancePeriodStatus, string> = {
  ABERTA: 'bg-[var(--surface-brand)] text-[var(--text-brand)] border-[var(--border-brand)]',
  EM_CONFERENCIA: 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]',
  APROVADA: 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]',
  FECHADA: 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]',
  REABERTA: 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]',
};

const PAYROLL_LABELS: Record<FinancePayrollStatus, string> = {
  RASCUNHO: 'Rascunho',
  CALCULADA: 'Calculada',
  EM_CONFERENCIA: 'Em conferência',
  APROVADA: 'Aprovada',
  FECHADA: 'Fechada',
  RETIFICADA: 'Retificada',
};

const PAYABLE_LABELS: Record<FinancePayableStatus, string> = {
  RASCUNHO: 'Rascunho',
  EM_APROVACAO: 'Em aprovação',
  APROVADA: 'Aprovada',
  AGENDADA: 'Agendada',
  PAGA: 'Paga',
  CONCILIADA: 'Conciliada',
  CANCELADA: 'Cancelada',
};

const MOVEMENT_LABELS: Record<FinanceStockMovementType, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  AJUSTE: 'Ajuste',
  TRANSFERENCIA: 'Transferência',
};

type FinanceTab = 'controle' | 'folha' | 'contas' | 'estoque';

function formatMonth(value: string) {
  const [year, month] = value.split('-');
  return `${month}/${year}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function money(value?: string | number | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));
}

function errorMessage(error: unknown) {
  const responseMessage = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(responseMessage)) return responseMessage.join(', ');
  if (responseMessage) return responseMessage;
  if (error instanceof Error) return error.message;
  return 'Não foi possível concluir a operação.';
}

const inputClass = 'ds-input mt-1 block w-full px-3 py-2 text-sm';
const buttonClass = 'ds-btn-primary inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-normal disabled:cursor-not-allowed disabled:opacity-50';

export default function FinanceDashboardPage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('controle');
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRun[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [quotes, setQuotes] = useState<PurchaseQuote[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [newMonth, setNewMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [paymentRefs, setPaymentRefs] = useState<Record<string, string>>({});
  const [payrollComments, setPayrollComments] = useState<Record<string, string>>({});
  const [payableForm, setPayableForm] = useState({ beneficiary: '', description: '', category: 'Operacional', dueDate: '', amount: '', documentRef: '' });
  const [stockForm, setStockForm] = useState({ unitId: '', code: '', name: '', minimumQuantity: '0', location: '' });
  const [movementForm, setMovementForm] = useState({ unitId: '', stockItemId: '', movementType: 'ENTRADA' as FinanceStockMovementType, quantity: '1', unitCost: '', sourceType: 'MANUAL', reason: '' });
  const [timeForm, setTimeForm] = useState({ employeeId: '', workDate: new Date().toISOString().slice(0, 10), clockIn: '', clockOut: '', breakMinutes: '0', notes: '' });
  const [quoteForm, setQuoteForm] = useState({ unitId: '', purchaseId: '', supplierId: '', totalAmount: '', documentRef: '', notes: '' });
  const [receiptForm, setReceiptForm] = useState({ unitId: '', purchaseId: '', stockItemId: '', quantity: '1', unitCost: '', documentRef: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedPeriod = useMemo(() => periods.find((period) => period.id === selectedPeriodId) ?? periods[0], [periods, selectedPeriodId]);
  const currentPayroll = useMemo(() => payrolls.find((payroll) => payroll.periodId === selectedPeriod?.id), [payrolls, selectedPeriod]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const periodData = await listFinancialPeriods();
      const periodId = selectedPeriodId || periodData[0]?.id;
      const [overviewData, employeeData, timeData, payrollData, payableData, stockData, movementData, quoteData, receiptData] = await Promise.all([
        getFinanceOverview(),
        listEmployees(),
        listTimeEntries(periodId ? { periodId } : undefined),
        listPayrolls(),
        listPayables(),
        listStockItems(),
        listStockMovements(),
        listPurchaseQuotes(),
        listGoodsReceipts(),
      ]);
      setOverview(overviewData);
      setPeriods(periodData);
      setSelectedPeriodId((current) => current || periodId || '');
      setEmployees(employeeData);
      setTimeEntries(timeData);
      setTimeForm((current) => ({ ...current, employeeId: current.employeeId || employeeData[0]?.id || '' }));
      setPayrolls(payrollData);
      setPayables(payableData);
      setStockItems(stockData);
      setStockMovements(movementData);
      setQuotes(quoteData);
      setReceipts(receiptData);
      setStockForm((current) => ({ ...current, unitId: current.unitId || stockData[0]?.unitId || '' }));
      setMovementForm((current) => ({ ...current, unitId: current.unitId || stockData[0]?.unitId || '', stockItemId: current.stockItemId || stockData[0]?.id || '' }));
      setQuoteForm((current) => ({ ...current, unitId: current.unitId || stockData[0]?.unitId || '' }));
      setReceiptForm((current) => ({ ...current, unitId: current.unitId || stockData[0]?.unitId || '', stockItemId: current.stockItemId || stockData[0]?.id || '' }));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (!selectedPeriodId) return;
    void listTimeEntries({ periodId: selectedPeriodId }).then(setTimeEntries).catch((loadError) => setError(errorMessage(loadError)));
  }, [selectedPeriodId]);

  async function run(action: () => Promise<void>, success: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      await loadData();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function handleCreatePeriod() {
    return run(async () => {
      const created = await createFinancialPeriod(newMonth);
      setSelectedPeriodId(created.id);
    }, `Competência ${formatMonth(newMonth)} aberta.`);
  }

  function handlePayroll() {
    if (!selectedPeriod) return;
    return run(async () => { await calculatePayroll(selectedPeriod.id); }, 'Folha calculada com os funcionários ativos do escopo.');
  }

  function handlePayrollStatus(payrollId: string, next: FinancePayrollStatus) {
    return run(async () => {
      await updatePayrollStatus(payrollId, next, payrollComments[payrollId]);
      setPayrollComments((current) => ({ ...current, [payrollId]: '' }));
    }, `Folha movida para ${PAYROLL_LABELS[next]}.`);
  }

  function handleCreateTimeEntry() {
    if (!selectedPeriod || !timeForm.employeeId || !timeForm.workDate) return;
    return run(async () => {
      const toIso = (value: string) => value ? new Date(`${timeForm.workDate}T${value}`).toISOString() : undefined;
      await createTimeEntry({
        employeeId: timeForm.employeeId,
        periodId: selectedPeriod.id,
        workDate: new Date(`${timeForm.workDate}T12:00:00`).toISOString(),
        clockIn: toIso(timeForm.clockIn),
        clockOut: toIso(timeForm.clockOut),
        breakMinutes: Number(timeForm.breakMinutes || 0),
        notes: timeForm.notes || undefined,
      });
      setTimeForm((current) => ({ ...current, clockIn: '', clockOut: '', breakMinutes: '0', notes: '' }));
    }, 'Registro de ponto criado no período selecionado.');
  }

  function nextPayrollStatus(status: FinancePayrollStatus): FinancePayrollStatus | null {
    if (status === 'CALCULADA') return 'EM_CONFERENCIA';
    if (status === 'EM_CONFERENCIA') return 'APROVADA';
    if (status === 'APROVADA') return 'FECHADA';
    if (status === 'RETIFICADA') return 'CALCULADA';
    return null;
  }

  function nextPayableStatus(status: FinancePayableStatus): FinancePayableStatus | null {
    if (status === 'RASCUNHO') return 'EM_APROVACAO';
    if (status === 'EM_APROVACAO') return 'APROVADA';
    if (status === 'APROVADA') return 'AGENDADA';
    if (status === 'AGENDADA') return 'PAGA';
    if (status === 'PAGA') return 'CONCILIADA';
    return null;
  }

  return (
    <PageShell title="Financeiro e gestão de pessoas" subtitle="Folha, ponto, pagamentos, compras e estoque conectados às tabelas reais do Zelare.">
      <div className="space-y-6">
        {(error || notice) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}</div>}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="ds-card p-5"><CalendarDays className="h-5 w-5 text-indigo-600" /><p className="mt-3 text-2xl font-normal text-slate-900">{selectedPeriod ? formatMonth(selectedPeriod.referenceMonth) : '—'}</p><p className="text-xs text-slate-500">{selectedPeriod ? STATUS_LABELS[selectedPeriod.status] : 'Sem competência'}</p></div>
          <div className="ds-card p-5"><Users className="h-5 w-5 text-indigo-600" /><p className="mt-3 text-2xl font-normal text-slate-900">{employees.length}</p><p className="text-xs text-slate-500">Funcionários no escopo</p></div>
          <div className="ds-card p-5"><Clock3 className="h-5 w-5 text-indigo-600" /><p className="mt-3 text-2xl font-normal text-slate-900">{timeEntries.length}</p><p className="text-xs text-slate-500">Registros de ponto</p></div>
          <div className="ds-card p-5"><WalletCards className="h-5 w-5 text-indigo-600" /><p className="mt-3 text-2xl font-normal text-slate-900">{money(payables.reduce((sum, item) => sum + Number(item.amount), 0))}</p><p className="text-xs text-slate-500">Contas a pagar listadas</p></div>
        </section>

        {overview && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm"><Receipt className="h-5 w-5 text-rose-600" /><p className="mt-3 text-2xl font-normal text-rose-900">{money(overview.payables.overdueAmount)}</p><p className="text-xs text-rose-700">Contas vencidas · {overview.payables.overdue}</p></div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"><WalletCards className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-2xl font-normal text-emerald-900">{money(overview.payroll.latestNet)}</p><p className="text-xs text-emerald-700">Última folha líquida · {overview.payroll.latestStatus ?? 'Sem cálculo'}</p></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"><Boxes className="h-5 w-5 text-amber-600" /><p className="mt-3 text-2xl font-normal text-amber-900">{overview.stock.lowStock}</p><p className="text-xs text-amber-700">Itens abaixo do mínimo</p></div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm"><ShoppingCart className="h-5 w-5 text-sky-600" /><p className="mt-3 text-2xl font-normal text-sky-900">{overview.purchasing.openQuotes}</p><p className="text-xs text-sky-700">Cotações abertas · {overview.purchasing.receipts} recebimentos</p></div>
          </section>
        )}

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {([['controle', 'Ponto e competências', Clock3], ['folha', 'Folha', FileCheck2], ['contas', 'Contas a pagar', Receipt], ['estoque', 'Compras e estoque', Boxes]] as const).map(([tab, label, Icon]) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-normal ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
          <button type="button" onClick={() => void loadData()} disabled={loading} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>
        </div>

        {activeTab === 'controle' && <>
          <section className="ds-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-lg font-normal text-slate-900">Competências financeiras</h2><p className="mt-1 text-sm text-slate-500">O fechamento é controlado por estado e não sobrescreve competências fechadas.</p></div><div className="flex flex-wrap items-end gap-2"><label className="text-xs font-normal text-slate-600">Nova competência<input type="month" value={newMonth} onChange={(event) => setNewMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label><button type="button" onClick={() => void handleCreatePeriod()} disabled={saving || !newMonth} className={buttonClass}><Plus className="h-4 w-4" />Abrir competência</button></div></div>
            <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Competência</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Fechada em</th><th className="px-3 py-3 text-right">Ação</th></tr></thead><tbody className="divide-y divide-slate-100">{periods.map((period) => <tr key={period.id} className={period.id === selectedPeriod?.id ? 'bg-indigo-50/60' : ''}><td className="px-3 py-3 font-normal">{formatMonth(period.referenceMonth)}</td><td className="px-3 py-3"><button type="button" onClick={() => setSelectedPeriodId(period.id)} className={`rounded-full border px-2.5 py-1 text-xs ${STATUS_COLORS[period.status]}`}>{STATUS_LABELS[period.status]}</button></td><td className="px-3 py-3 text-slate-500">{formatDate(period.closedAt)}</td><td className="px-3 py-3 text-right">{period.status === 'ABERTA' && <button type="button" onClick={() => void run(async () => { await updateFinancialPeriodStatus(period.id, 'EM_CONFERENCIA'); }, 'Competência enviada para conferência.')} className="rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs text-amber-800"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Enviar</button>}{period.status === 'FECHADA' && <span className="text-xs text-slate-500"><LockKeyhole className="mr-1 inline h-3.5 w-3.5" />Protegida</span>}</td></tr>)}{!loading && periods.length === 0 && <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-500">Nenhuma competência real encontrada.</td></tr>}</tbody></table></div>
          </section>
          <section className="ds-card p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-normal text-slate-900">Registrar ponto</h2><p className="mt-1 text-sm text-slate-500">O registro nasce como rascunho e precisa ser enviado para conferência.</p></div><Clock3 className="h-5 w-5 text-indigo-600" /></div><form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); void handleCreateTimeEntry(); }}><label className="text-xs font-normal text-slate-600">Funcionário<select required value={timeForm.employeeId} onChange={(event) => setTimeForm({ ...timeForm, employeeId: event.target.value })} className={inputClass}><option value="">Selecione</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.employeeCode}</option>)}</select></label><label className="text-xs font-normal text-slate-600">Data<input required type="date" value={timeForm.workDate} onChange={(event) => setTimeForm({ ...timeForm, workDate: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal text-slate-600">Intervalo (minutos)<input min="0" type="number" value={timeForm.breakMinutes} onChange={(event) => setTimeForm({ ...timeForm, breakMinutes: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal text-slate-600">Entrada<input type="time" value={timeForm.clockIn} onChange={(event) => setTimeForm({ ...timeForm, clockIn: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal text-slate-600">Saída<input type="time" value={timeForm.clockOut} onChange={(event) => setTimeForm({ ...timeForm, clockOut: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal text-slate-600">Observação<input maxLength={240} value={timeForm.notes} onChange={(event) => setTimeForm({ ...timeForm, notes: event.target.value })} className={inputClass} /></label><div className="md:col-span-3"><button type="submit" disabled={saving || !selectedPeriod} className={buttonClass}><Plus className="h-4 w-4" />Registrar ponto</button></div></form></section>
          <section className="ds-card p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-normal text-slate-900">Registros de ponto</h2><p className="mt-1 text-sm text-slate-500">Dados filtrados pela competência selecionada.</p></div><Clock3 className="h-5 w-5 text-indigo-600" /></div><div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Funcionário</th><th className="px-3 py-3">Entrada</th><th className="px-3 py-3">Saída</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{timeEntries.slice(0, 100).map((entry) => { const employee = employees.find((item) => item.id === entry.employeeId); return <tr key={entry.id}><td className="px-3 py-3">{formatDate(entry.workDate)}</td><td className="px-3 py-3 font-normal">{employee ? `${employee.firstName} ${employee.lastName}` : entry.employeeId}</td><td className="px-3 py-3 text-slate-500">{formatDate(entry.clockIn)}</td><td className="px-3 py-3 text-slate-500">{formatDate(entry.clockOut)}</td><td className="px-3 py-3 text-slate-500">{entry.status}{entry.status === 'RASCUNHO' && <button type="button" onClick={() => void run(async () => { await submitTimeEntry(entry.id); }, 'Registro enviado para conferência.')} className="ml-2 rounded-lg border border-indigo-200 px-2 py-1 text-xs text-indigo-700">Enviar</button>}</td></tr>; })}{!loading && timeEntries.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">Nenhum ponto na competência selecionada.</td></tr>}</tbody></table></div></section>
        </>}

        {activeTab === 'folha' && <section className="space-y-5"><div className="ds-card p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-normal">Folha de pagamento</h2><p className="mt-1 text-sm text-slate-500">Cálculo auditável com snapshot dos funcionários ativos e transições de aprovação.</p></div><button type="button" onClick={() => void handlePayroll()} disabled={!selectedPeriod || saving} className={buttonClass}><FileCheck2 className="h-4 w-4" />Calcular competência selecionada</button></div><div className="mt-5 grid gap-4 md:grid-cols-4"><div className="ds-surface rounded-xl p-4"><p className="text-xs text-slate-500">Status</p><p className="mt-1 font-normal">{currentPayroll ? PAYROLL_LABELS[currentPayroll.status] : 'Não calculada'}</p></div><div className="ds-surface rounded-xl p-4"><p className="text-xs text-slate-500">Bruto</p><p className="mt-1 font-normal">{money(currentPayroll?.totalGross)}</p></div><div className="ds-surface rounded-xl p-4"><p className="text-xs text-slate-500">Descontos</p><p className="mt-1 font-normal">{money(currentPayroll?.totalDeductions)}</p></div><div className="ds-surface rounded-xl p-4"><p className="text-xs text-slate-500">Líquido</p><p className="mt-1 font-normal">{money(currentPayroll?.totalNet)}</p></div></div></div><div className="ds-card p-5"><h3 className="font-normal">Histórico de folhas</h3><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Competência</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Bruto</th><th className="px-3 py-3">Líquido</th><th className="px-3 py-3">Ação e auditoria</th></tr></thead><tbody className="divide-y divide-slate-100">{payrolls.map((payroll) => { const period = periods.find((item) => item.id === payroll.periodId); const next = nextPayrollStatus(payroll.status); return <tr key={payroll.id}><td className="px-3 py-3">{period ? formatMonth(period.referenceMonth) : payroll.periodId}</td><td className="px-3 py-3">{PAYROLL_LABELS[payroll.status]}</td><td className="px-3 py-3">{money(payroll.totalGross)}</td><td className="px-3 py-3">{money(payroll.totalNet)}</td><td className="px-3 py-3 text-right"><div className="space-y-2">{next && <><input aria-label={`Comentário da transição da folha ${payroll.id}`} placeholder="Comentário opcional" value={payrollComments[payroll.id] || ''} onChange={(event) => setPayrollComments((current) => ({ ...current, [payroll.id]: event.target.value }))} className="w-44 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" /><button type="button" onClick={() => void handlePayrollStatus(payroll.id, next)} className="rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs text-indigo-700">Avançar para {PAYROLL_LABELS[next]}</button></>}{payroll.approvalHistory?.length ? <div className="text-left text-[11px] text-slate-500">{payroll.approvalHistory.slice(-3).map((event) => <div key={event.id}>{formatDate(event.createdAt)} · {PAYROLL_LABELS[event.fromStatus]} → {PAYROLL_LABELS[event.toStatus]}{event.comment ? ` · ${event.comment}` : ''}</div>)}</div> : <span className="block text-left text-[11px] text-slate-400">Sem transições registradas.</span>}</div></td></tr>; })}{!payrolls.length && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">Nenhuma folha calculada.</td></tr>}</tbody></table></div></div></section>}

        {activeTab === 'contas' && <section className="space-y-5"><div className="ds-card p-5"><div className="flex items-center gap-2"><Receipt className="h-5 w-5 text-indigo-600" /><div><h2 className="text-lg font-normal">Nova conta a pagar</h2><p className="text-sm text-slate-500">Crie o título e faça o fluxo de aprovação até a conciliação.</p></div></div><form className="mt-5 grid gap-3 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); void run(async () => { await createPayable({ beneficiary: payableForm.beneficiary, description: payableForm.description, category: payableForm.category, sourceType: 'MANUAL', dueDate: new Date(`${payableForm.dueDate}T12:00:00`).toISOString(), amount: Number(payableForm.amount), documentRef: payableForm.documentRef }); setPayableForm({ beneficiary: '', description: '', category: 'Operacional', dueDate: '', amount: '', documentRef: '' }); }, 'Conta a pagar criada como rascunho.'); }}><label className="text-xs font-normal">Beneficiário<input required value={payableForm.beneficiary} onChange={(event) => setPayableForm({ ...payableForm, beneficiary: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Descrição<input required value={payableForm.description} onChange={(event) => setPayableForm({ ...payableForm, description: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Categoria<input required value={payableForm.category} onChange={(event) => setPayableForm({ ...payableForm, category: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Vencimento<input required type="date" value={payableForm.dueDate} onChange={(event) => setPayableForm({ ...payableForm, dueDate: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Valor<input required min="0" step="0.01" type="number" value={payableForm.amount} onChange={(event) => setPayableForm({ ...payableForm, amount: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Documento<input value={payableForm.documentRef} onChange={(event) => setPayableForm({ ...payableForm, documentRef: event.target.value })} className={inputClass} /></label><div className="md:col-span-3"><button className={buttonClass} disabled={saving}><Plus className="h-4 w-4" />Criar conta</button></div></form></div><div className="ds-card p-5"><h3 className="font-normal">Contas reais no escopo</h3><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Beneficiário</th><th className="px-3 py-3">Vencimento</th><th className="px-3 py-3">Valor</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Fluxo</th></tr></thead><tbody className="divide-y divide-slate-100">{payables.map((payable) => { const next = nextPayableStatus(payable.status); return <tr key={payable.id}><td className="px-3 py-3 font-normal">{payable.beneficiary}<span className="block text-xs font-normal text-slate-500">{payable.description}</span></td><td className="px-3 py-3">{formatDate(payable.dueDate)}</td><td className="px-3 py-3">{money(payable.amount)}</td><td className="px-3 py-3">{PAYABLE_LABELS[payable.status]}</td><td className="px-3 py-3">{next && <div className="flex flex-wrap gap-2">{next === 'PAGA' && <input placeholder="Referência" value={paymentRefs[payable.id] || ''} onChange={(event) => setPaymentRefs({ ...paymentRefs, [payable.id]: event.target.value })} className="w-28 rounded border border-slate-300 px-2 py-1 text-xs" />}<button type="button" onClick={() => void run(async () => { await updatePayableStatus(payable.id, next, paymentRefs[payable.id]); }, `Conta movida para ${PAYABLE_LABELS[next]}.`)} className="rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs text-indigo-700">{PAYABLE_LABELS[next]}</button></div>}</td></tr>; })}{!payables.length && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">Nenhuma conta encontrada.</td></tr>}</tbody></table></div></div></section>}

        {activeTab === 'estoque' && <section className="space-y-5"><div className="grid gap-5 xl:grid-cols-2"><div className="ds-card p-5"><div className="flex items-center gap-2"><Boxes className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-normal">Cadastrar item de estoque</h2></div><form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void run(async () => { await createStockItem({ unitId: stockForm.unitId, code: stockForm.code, name: stockForm.name, minimumQuantity: Number(stockForm.minimumQuantity), location: stockForm.location }); setStockForm({ ...stockForm, code: '', name: '', minimumQuantity: '0', location: '' }); }, 'Item de estoque criado.'); }}><label className="text-xs font-normal">Unidade ID<input required value={stockForm.unitId} onChange={(event) => setStockForm({ ...stockForm, unitId: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Código<input required value={stockForm.code} onChange={(event) => setStockForm({ ...stockForm, code: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Nome<input required value={stockForm.name} onChange={(event) => setStockForm({ ...stockForm, name: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Mínimo<input type="number" min="0" value={stockForm.minimumQuantity} onChange={(event) => setStockForm({ ...stockForm, minimumQuantity: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal md:col-span-2">Localização<input value={stockForm.location} onChange={(event) => setStockForm({ ...stockForm, location: event.target.value })} className={inputClass} /></label><button className={buttonClass} disabled={saving}><Plus className="h-4 w-4" />Cadastrar item</button></form></div><div className="ds-card p-5"><div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-normal">Movimentar estoque</h2></div><form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void run(async () => { await createStockMovement({ unitId: movementForm.unitId, stockItemId: movementForm.stockItemId, movementType: movementForm.movementType, quantity: Number(movementForm.quantity), unitCost: movementForm.unitCost ? Number(movementForm.unitCost) : undefined, sourceType: movementForm.sourceType, reason: movementForm.reason }); }, 'Movimento de estoque registrado.'); }}><label className="text-xs font-normal">Unidade ID<input required value={movementForm.unitId} onChange={(event) => setMovementForm({ ...movementForm, unitId: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Item<select required value={movementForm.stockItemId} onChange={(event) => setMovementForm({ ...movementForm, stockItemId: event.target.value })} className={inputClass}><option value="">Selecione</option>{stockItems.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label><label className="text-xs font-normal">Tipo<select value={movementForm.movementType} onChange={(event) => setMovementForm({ ...movementForm, movementType: event.target.value as FinanceStockMovementType })} className={inputClass}>{Object.keys(MOVEMENT_LABELS).filter((item) => item !== 'TRANSFERENCIA').map((item) => <option key={item} value={item}>{MOVEMENT_LABELS[item as FinanceStockMovementType]}</option>)}</select></label><label className="text-xs font-normal">Quantidade<input required min="1" type="number" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Custo unitário<input min="0" step="0.01" type="number" value={movementForm.unitCost} onChange={(event) => setMovementForm({ ...movementForm, unitCost: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Origem<input required value={movementForm.sourceType} onChange={(event) => setMovementForm({ ...movementForm, sourceType: event.target.value })} className={inputClass} /></label><button className={buttonClass} disabled={saving}><ShoppingCart className="h-4 w-4" />Registrar movimento</button></form></div></div><div className="ds-card p-5"><h3 className="font-normal">Saldos atuais</h3><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{stockItems.map((item) => <div key={item.id} className={`rounded-xl border p-4 ${item.quantity <= item.minimumQuantity ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}><p className="text-xs text-slate-500">{item.code}</p><p className="mt-1 font-normal">{item.name}</p><p className="mt-2 text-2xl font-normal">{item.quantity}</p><p className="text-xs text-slate-500">mínimo {item.minimumQuantity}</p></div>)}{!stockItems.length && <p className="text-sm text-slate-500">Nenhum item de estoque cadastrado no escopo.</p>}</div></div><div className="grid gap-5 xl:grid-cols-2"><div className="ds-card p-5"><h3 className="font-normal">Cotações de compra</h3><form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void run(async () => { await createPurchaseQuote({ unitId: quoteForm.unitId, purchaseId: quoteForm.purchaseId || undefined, supplierId: quoteForm.supplierId || undefined, status: 'ABERTA', totalAmount: Number(quoteForm.totalAmount), documentRef: quoteForm.documentRef || undefined, notes: quoteForm.notes || undefined }); }, 'Cotação registrada.'); }}><label className="text-xs font-normal">Unidade ID<input required value={quoteForm.unitId} onChange={(event) => setQuoteForm({ ...quoteForm, unitId: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Pedido de compra ID<input value={quoteForm.purchaseId} onChange={(event) => setQuoteForm({ ...quoteForm, purchaseId: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Fornecedor ID<input value={quoteForm.supplierId} onChange={(event) => setQuoteForm({ ...quoteForm, supplierId: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Total<input required type="number" min="0" step="0.01" value={quoteForm.totalAmount} onChange={(event) => setQuoteForm({ ...quoteForm, totalAmount: event.target.value })} className={inputClass} /></label><button className={buttonClass} disabled={saving}><Plus className="h-4 w-4" />Registrar cotação</button></form><div className="mt-4 space-y-2">{quotes.slice(0, 8).map((quote) => <div key={quote.id} className="flex items-center justify-between ds-surface rounded-lg px-3 py-2 text-sm"><span>{quote.purchaseId || 'Sem pedido'} · {quote.status}</span><strong>{money(quote.totalAmount)}</strong></div>)}</div></div><div className="ds-card p-5"><h3 className="font-normal">Recebimento de mercadorias</h3><p className="mt-1 text-sm text-slate-500">Ao receber, o sistema cria a entrada no estoque em transação única.</p><form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void run(async () => { await createGoodsReceipt({ unitId: receiptForm.unitId, purchaseId: receiptForm.purchaseId, items: [{ stockItemId: receiptForm.stockItemId, quantity: Number(receiptForm.quantity), unitCost: receiptForm.unitCost ? Number(receiptForm.unitCost) : undefined }], documentRef: receiptForm.documentRef || undefined, notes: receiptForm.notes || undefined }); }, 'Recebimento registrado e estoque atualizado.'); }}><label className="text-xs font-normal">Unidade ID<input required value={receiptForm.unitId} onChange={(event) => setReceiptForm({ ...receiptForm, unitId: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Pedido de compra ID<input required value={receiptForm.purchaseId} onChange={(event) => setReceiptForm({ ...receiptForm, purchaseId: event.target.value })} className={inputClass} /></label><label className="text-xs font-normal">Item<select required value={receiptForm.stockItemId} onChange={(event) => setReceiptForm({ ...receiptForm, stockItemId: event.target.value })} className={inputClass}><option value="">Selecione</option>{stockItems.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label><label className="text-xs font-normal">Quantidade<input required min="1" type="number" value={receiptForm.quantity} onChange={(event) => setReceiptForm({ ...receiptForm, quantity: event.target.value })} className={inputClass} /></label><button className={buttonClass} disabled={saving}><Receipt className="h-4 w-4" />Registrar recebimento</button></form><div className="mt-4 space-y-2">{receipts.slice(0, 8).map((receipt) => <div key={receipt.id} className="ds-surface rounded-lg px-3 py-2 text-sm">{formatDate(receipt.receivedAt)} · {receipt.status} · {receipt.items.length} item(ns)</div>)}</div></div></div><div className="ds-card p-5"><h3 className="font-normal">Últimos movimentos</h3><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Item</th><th className="px-3 py-3">Quantidade</th><th className="px-3 py-3">Origem</th></tr></thead><tbody className="divide-y divide-slate-100">{stockMovements.slice(0, 50).map((movement) => <tr key={movement.id}><td className="px-3 py-3">{formatDate(movement.createdAt)}</td><td className="px-3 py-3">{MOVEMENT_LABELS[movement.movementType]}</td><td className="px-3 py-3">{stockItems.find((item) => item.id === movement.stockItemId)?.name || movement.stockItemId}</td><td className="px-3 py-3">{movement.quantity}</td><td className="px-3 py-3">{movement.sourceType}</td></tr>)}</tbody></table></div></div></section>}
      </div>
    </PageShell>
  );
}
