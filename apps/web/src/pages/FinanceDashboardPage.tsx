import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import {
  createFinancialPeriod,
  listEmployees,
  listFinancialPeriods,
  listTimeEntries,
  updateFinancialPeriodStatus,
  type EmployeeProfile,
  type FinancePeriodStatus,
  type FinancialPeriod,
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
  ABERTA: 'bg-blue-50 text-blue-700 border-blue-200',
  EM_CONFERENCIA: 'bg-amber-50 text-amber-700 border-amber-200',
  APROVADA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FECHADA: 'bg-slate-100 text-slate-700 border-slate-200',
  REABERTA: 'bg-orange-50 text-orange-700 border-orange-200',
};

function formatMonth(value: string) {
  const [year, month] = value.split('-');
  return `${month}/${year}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  const responseMessage = (error as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(responseMessage)) return responseMessage.join(', ');
  if (responseMessage) return responseMessage;
  if (error instanceof Error) return error.message;
  return 'Não foi possível concluir a operação.';
}

export default function FinanceDashboardPage() {
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [newMonth, setNewMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? periods[0],
    [periods, selectedPeriodId],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [periodData, employeeData] = await Promise.all([
        listFinancialPeriods(),
        listEmployees(),
      ]);
      setPeriods(periodData);
      setEmployees(employeeData);
      setSelectedPeriodId((current) => current || periodData[0]?.id || '');
      const periodId = selectedPeriodId || periodData[0]?.id;
      setTimeEntries(periodId ? await listTimeEntries({ periodId }) : []);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedPeriodId) return;
    void listTimeEntries({ periodId: selectedPeriodId })
      .then(setTimeEntries)
      .catch((loadError) => setError(errorMessage(loadError)));
  }, [selectedPeriodId]);

  async function handleCreatePeriod() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createFinancialPeriod(newMonth);
      setSelectedPeriodId(created.id);
      setNotice(`Competência ${formatMonth(created.referenceMonth)} pronta para conferência.`);
      await loadData();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleStartReview() {
    if (!selectedPeriod || selectedPeriod.status !== 'ABERTA') return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateFinancialPeriodStatus(selectedPeriod.id, 'EM_CONFERENCIA');
      setNotice('Competência movida para conferência.');
      await loadData();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  const approvedEntries = timeEntries.filter((entry) => entry.status === 'APROVADO').length;
  const pendingEntries = timeEntries.filter((entry) => entry.status !== 'APROVADO').length;

  return (
    <PageShell
      title="Financeiro e gestão de pessoas"
      subtitle="Competências, funcionários e ponto conectados ao banco real do Zelare."
    >
      <div className="space-y-6">
        {(error || notice) && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              error
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {error || notice}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Competência ativa</span>
              <CalendarDays className="h-5 w-5 text-indigo-600" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-900">
              {selectedPeriod ? formatMonth(selectedPeriod.referenceMonth) : '—'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedPeriod ? STATUS_LABELS[selectedPeriod.status] : 'Nenhuma competência criada'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Funcionários cadastrados</span>
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{employees.length}</p>
            <p className="mt-1 text-xs text-slate-500">No escopo permitido para seu perfil</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Ponto da competência</span>
              <Clock3 className="h-5 w-5 text-indigo-600" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{timeEntries.length}</p>
            <p className="mt-1 text-xs text-slate-500">
              {approvedEntries} aprovados · {pendingEntries} pendentes
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Competências financeiras</h2>
              <p className="mt-1 text-sm text-slate-500">
                O fechamento é controlado por estado e não sobrescreve competências fechadas.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-medium text-slate-600">
                Nova competência
                <input
                  type="month"
                  value={newMonth}
                  onChange={(event) => setNewMonth(event.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleCreatePeriod()}
                disabled={saving || !newMonth}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Abrir competência
              </button>
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Competência</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Fechada em</th>
                  <th className="px-3 py-3 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periods.map((period) => (
                  <tr
                    key={period.id}
                    className={period.id === selectedPeriod?.id ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}
                  >
                    <td className="px-3 py-3 font-medium text-slate-800">{formatMonth(period.referenceMonth)}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedPeriodId(period.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[period.status]}`}
                      >
                        {STATUS_LABELS[period.status]}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{formatDate(period.closedAt)}</td>
                    <td className="px-3 py-3 text-right">
                      {period.status === 'ABERTA' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPeriodId(period.id);
                            void handleStartReview();
                          }}
                          disabled={saving}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Enviar para conferência
                        </button>
                      )}
                      {period.status === 'FECHADA' && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <LockKeyhole className="h-3.5 w-3.5" />
                          Protegida
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && periods.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-sm text-slate-500">
                      Nenhuma competência financeira encontrada no escopo real.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Registros de ponto</h2>
              <p className="mt-1 text-sm text-slate-500">Dados reais filtrados pela competência selecionada.</p>
            </div>
            <Clock3 className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Funcionário</th>
                  <th className="px-3 py-3 font-medium">Entrada</th>
                  <th className="px-3 py-3 font-medium">Saída</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeEntries.slice(0, 50).map((entry) => {
                  const employee = employees.find((item) => item.id === entry.employeeId);
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 text-slate-700">{formatDate(entry.workDate)}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">
                        {employee ? `${employee.firstName} ${employee.lastName}` : entry.employeeId}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{formatDate(entry.clockIn)}</td>
                      <td className="px-3 py-3 text-slate-500">{formatDate(entry.clockOut)}</td>
                      <td className="px-3 py-3 text-slate-500">{entry.status}</td>
                    </tr>
                  );
                })}
                {!loading && timeEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-500">
                      Nenhum registro de ponto na competência selecionada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
