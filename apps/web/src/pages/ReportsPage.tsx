import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getClassroomExpressSummary,
  getCentralCoverage,
  getDiaryByClassroom,
  getDiaryByPeriod,
  getDiarySummary,
  getDiaryUnplanned,
  getUnitCoverage,
  getUnitPendings,
  type ClassroomExpressSummary,
  type CentralCoverageData,
  type DiarySummaryData,
  type UnitCoverageData,
  type UnitPendingsData,
} from '../api/reports';
import { getAccessibleClassrooms } from '../api/lookup';
import { getErrorMessage } from '../utils/errorMessage';
import type { AccessibleClassroom } from '../types/lookup';
import http from '../api/http';
import { useAuth } from '../app/AuthProvider';
import { normalizeRoles } from '../app/RoleProtectedRoute';
import { useUnitScope } from '../contexts/UnitScopeContext';
import { UnitScopeSelector } from '../components/select/UnitScopeSelector';

const LABELS_PT: Record<string, string> = {
  id: 'ID', classroomId: 'Turma', startDate: 'Data de Início', endDate: 'Data de Término',
  totalEvents: 'Total de Eventos', events: 'Eventos', eventDate: 'Data do Evento',
  eventType: 'Tipo de Evento', description: 'Descrição', notes: 'Observações',
  isPlanned: 'Planejado', createdAt: 'Criado em', updatedAt: 'Atualizado em',
  child: 'Criança', firstName: 'Nome', lastName: 'Sobrenome', childId: 'Criança',
  planning: 'Planejamento', planningId: 'Planejamento', status: 'Status',
  curriculumEntry: 'Entrada Curricular', campoDeExperiencia: 'Campo de Experiência',
  objetivoBNCC: 'Objetivo BNCC', date: 'Data', period: 'Período', from: 'De', to: 'Até',
  unitId: 'Unidade', totalUnplanned: 'Total Não Planejado',
  unplannedEvents: 'Eventos Não Planejados', classroom: 'Turma',
  classroomName: 'Nome da Turma', name: 'Nome', code: 'Código', unit: 'Unidade',
};

function traduzirChave(chave: string): string {
  return LABELS_PT[chave] || chave.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase());
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'object') {
    const obj = valor as Record<string, unknown>;
    const partes = Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
      .map(([k, v]) => `${traduzirChave(k)}: ${v}`).slice(0, 3);
    return partes.join(' | ') || JSON.stringify(valor);
  }
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    try { return new Date(valor).toLocaleDateString('pt-BR'); } catch { return valor; }
  }
  return String(valor);
}

type ReportType = 'pedagogical' | 'by-classroom' | 'by-period' | 'unplanned';

interface PedagogicalReportData {
  coverage: UnitCoverageData | CentralCoverageData;
  pendings: UnitPendingsData | null;
  diarySummary: DiarySummaryData | null;
  classroomSummary: ClassroomExpressSummary | null;
}
interface ReportData { [key: string]: unknown; }
interface UnitOption { id: string; name: string; }

export function ReportsPage() {
  const { user } = useAuth();
  const roles = normalizeRoles(user);
  const isCentral = roles.includes('STAFF_CENTRAL') || roles.includes('MANTENEDORA') || roles.includes('DEVELOPER');

  const [searchParams] = useSearchParams();
  const unitIdFromQuery = searchParams.get('unitId') ?? '';
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [pedagogicalData, setPedagogicalData] = useState<PedagogicalReportData | null>(null);

  // Contexto global de escopo de unidade
  const { accessibleUnits, selectedUnitId: ctxUnitId, setUnit: ctxSetUnit } = useUnitScope();

  // Unidades disponíveis (do contexto global)
  const unidades: UnitOption[] = accessibleUnits;
  const selectedUnitId = ctxUnitId ?? '';
  const setSelectedUnitId = (id: string) => ctxSetUnit(id || null);

  // Turmas (carregadas após seleção de unidade, ou todas se UNIDADE)
  const [turmas, setTurmas] = useState<AccessibleClassroom[]>([]);
  const [turmasCarregando, setTurmasCarregando] = useState(false);

  // Filtros dos relatórios
  const [classroomId, setClassroomId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');

  // Inicializar unidade a partir do query param (quando navegado de outra tela)
  useEffect(() => {
    if (unitIdFromQuery && unitIdFromQuery !== selectedUnitId) {
      setSelectedUnitId(unitIdFromQuery);
    }
  }, [unitIdFromQuery]); // eslint-disable-line

  // Carregar unidades para STAFF_CENTRAL (agora via contexto global)
  useEffect(() => {
    if (!isCentral) return;
    // unidades já vem do UnitScopeContext — nada a fazer aqui
    void (async () => {})()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .catch(() => {});
  }, [isCentral]);

  // Carregar turmas quando unidade é selecionada (ou ao montar para UNIDADE)
  // CORREÇÃO: passa unitId diretamente para a API (não filtra localmente)
  const carregarTurmas = useCallback(async (unitId?: string) => {
    setTurmasCarregando(true);
    setClassroomId('');
    try {
      // Para STAFF_CENTRAL sem unidade selecionada, não carrega turmas (evita lista enorme)
      if (isCentral && !unitId) {
        setTurmas([]);
        return;
      }
      const data = await getAccessibleClassrooms(unitId);
      setTurmas(data);
    } catch {
      setTurmas([]);
    } finally {
      setTurmasCarregando(false);
    }
  }, [isCentral]);

  useEffect(() => {
    if (!isCentral) {
      // UNIDADE/PROFESSOR: carrega todas as turmas acessíveis
      carregarTurmas();
    }
  }, [isCentral, carregarTurmas]);

  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
    setReportData(null);
    setPedagogicalData(null);
    setError(null);
    // Sempre recarregar turmas quando unidade muda (para by-classroom)
    carregarTurmas(unitId || undefined);
  };

  const handleReportTypeChange = (tipo: ReportType) => {
    setReportType(tipo);
    setError(null);
    setReportData(null);
    if (tipo === 'by-classroom' || tipo === 'pedagogical') {
      carregarTurmas(selectedUnitId || undefined);
    }
  };

  const carregarRelatorio = async () => {
    setError(null); setLoading(true); setReportData(null); setPedagogicalData(null);
    try {
      if (reportType === 'pedagogical') {
        if (!startDate || !endDate) {
          setError('Preencha a Data de Início e a Data de Término antes de gerar a visão pedagógica.');
          setLoading(false);
          return;
        }
        const selectedClassroom = turmas.find((turma) => turma.id === classroomId);
        const scopedUnitId = selectedUnitId || selectedClassroom?.unitId;
        const coverage = scopedUnitId
          ? await getUnitCoverage({ unitId: scopedUnitId, startDate, endDate })
          : await getCentralCoverage({ startDate, endDate, daysWithout: 1 });
        const [pendings, diarySummary, classroomSummary] = await Promise.all([
          scopedUnitId ? getUnitPendings({ unitId: scopedUnitId, daysWithout: 1 }) : Promise.resolve(null),
          getDiarySummary({ unitId: scopedUnitId, classroomId: classroomId || undefined, mes: endDate.slice(0, 7) }),
          classroomId ? getClassroomExpressSummary({ classroomId, startDate, endDate }) : Promise.resolve(null),
        ]);
        setPedagogicalData({ coverage, pendings, diarySummary, classroomSummary });
        setLoading(false);
        return;
      }

      let data: ReportData;
      if (reportType === 'by-classroom') {
        if (!classroomId || !startDate || !endDate) {
          setError('Preencha a Turma, a Data de Início e a Data de Término antes de gerar o relatório.');
          setLoading(false); return;
        }
        const resp = await getDiaryByClassroom(classroomId, startDate, endDate);
        data = resp as unknown as ReportData;
      } else if (reportType === 'by-period') {
        const params: Record<string, string> = {};
        if (periodoInicio) params.startDate = periodoInicio;
        if (periodoFim) params.endDate = periodoFim;
        if (selectedUnitId) params.unitId = selectedUnitId;
        const resp = await getDiaryByPeriod(periodoInicio, periodoFim, selectedUnitId || undefined);
        data = resp as unknown as ReportData;
      } else if (reportType === 'unplanned') {
        const resp = await getDiaryUnplanned(selectedUnitId || undefined);
        data = resp as unknown as ReportData;
      } else { return; }
      setReportData(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao carregar relatório'));
    } finally { setLoading(false); }
  };

  const titulos: Record<ReportType, string> = {
    pedagogical: 'Visão Pedagógica Consolidada',
    'by-classroom': 'Relatório de Diário por Turma',
    'by-period': 'Relatório de Diário por Período',
    'unplanned': 'Relatório de Eventos Não Planejados',
  };

  const renderizarVisaoPedagogica = () => {
    if (!pedagogicalData) return null;
    const { coverage, pendings, diarySummary, classroomSummary } = pedagogicalData;
    const isUnitCoverage = 'turmas' in coverage;
    const unitCoverage = isUnitCoverage ? coverage : null;
    const centralCoverage = !isUnitCoverage ? coverage : null;
    const percentual = unitCoverage?.percentualGeral ?? centralCoverage?.percentualGeral ?? 0;
    const totalCriancas = unitCoverage?.totalCriancas ?? centralCoverage?.totalCriancas ?? 0;
    const totalComRegistro = unitCoverage?.totalComRegistro ?? centralCoverage?.totalComRegistro ?? 0;
    const totalPendentes = pendings?.totalPendentes ?? centralCoverage?.unidades.reduce((sum, unidade) => sum + unidade.totalPendentes, 0) ?? 0;
    const totalAtencao = classroomSummary?.totalPontosAtencao ?? 0;

    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <strong>Leitura operacional:</strong> esta visão cruza registros estruturados reais. Ela não substitui o RDIC oficial nem expõe texto clínico, psicológico ou dados administrativos da criança.
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Cobertura</p><p className="mt-1 text-2xl font-bold text-indigo-700">{percentual}%</p><p className="text-xs text-slate-500">{totalComRegistro} de {totalCriancas} crianças</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Diários do mês</p><p className="mt-1 text-2xl font-bold text-emerald-700">{diarySummary?.totalDiarios ?? classroomSummary?.totalDiarios ?? '—'}</p><p className="text-xs text-slate-500">{diarySummary?.publicados ?? 0} publicados · {diarySummary?.rascunhos ?? 0} rascunhos</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Pendências recentes</p><p className="mt-1 text-2xl font-bold text-amber-700">{totalPendentes}</p><p className="text-xs text-slate-500">sem registro no último dia</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Pontos de atenção</p><p className="mt-1 text-2xl font-bold text-rose-700">{totalAtencao}</p><p className="text-xs text-slate-500">na turma selecionada</p></div>
        </div>

        {unitCoverage && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800">Cobertura por turma</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {unitCoverage.turmas.map((turma) => (
                <div key={turma.classroomId} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3"><span className="font-medium text-slate-800">{turma.classroomName}</span><span className="font-semibold text-indigo-700">{turma.percentual}%</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, turma.percentual)}%` }} /></div>
                  <p className="mt-1 text-xs text-slate-500">{turma.criancasComRegistro} de {turma.totalCriancas} crianças com registro</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {centralCoverage && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800">Cobertura por unidade</h3>
            <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Cobertura</th><th className="px-3 py-2">Crianças</th><th className="px-3 py-2">Pendências</th></tr></thead><tbody className="divide-y divide-slate-100">{centralCoverage.unidades.map((unidade) => <tr key={unidade.unitId}><td className="px-3 py-3 font-medium">{unidade.unitName}</td><td className="px-3 py-3 font-semibold text-indigo-700">{unidade.percentualCobertura}%</td><td className="px-3 py-3 text-slate-600">{unidade.totalComRegistro} / {unidade.totalCriancas}</td><td className="px-3 py-3 text-amber-700">{unidade.totalPendentes}</td></tr>)}</tbody></table></div>
          </section>
        )}

        {classroomSummary && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-slate-800">Evidências por criança — {classroomSummary.classroom.name}</h3><p className="text-xs text-slate-500">{formatarValor(classroomSummary.periodo.startDate)} a {formatarValor(classroomSummary.periodo.endDate)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{classroomSummary.cobertura.percentual}% de cobertura</span></div>
            <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Criança</th><th className="px-3 py-2">Diários</th><th className="px-3 py-2">Observações</th><th className="px-3 py-2">Microgestos</th><th className="px-3 py-2">Dias</th><th className="px-3 py-2">Tendência</th></tr></thead><tbody className="divide-y divide-slate-100">{classroomSummary.criancas.map((crianca) => <tr key={crianca.childId}><td className="px-3 py-3 font-medium">{crianca.nome}</td><td className="px-3 py-3">{crianca.diarios}</td><td className="px-3 py-3">{crianca.observacoes}</td><td className="px-3 py-3">{crianca.microgestos}</td><td className="px-3 py-3">{crianca.diasComRegistro}</td><td className={`px-3 py-3 font-semibold ${crianca.tendencia === 'ATENCAO' ? 'text-rose-700' : crianca.tendencia === 'FAVORAVEL' ? 'text-emerald-700' : 'text-slate-700'}`}>{crianca.tendencia.replaceAll('_', ' ')}</td></tr>)}</tbody></table></div>
          </section>
        )}

        {pendings && pendings.pendentes.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-semibold text-amber-900">Fila de atenção operacional</h3><p className="mt-1 text-sm text-amber-800">Crianças sem registro recente. A fila serve para orientar o cuidado da equipe, não para punir o professor.</p><div className="mt-3 flex flex-wrap gap-2">{pendings.pendentes.slice(0, 12).map((pending) => <span key={pending.childId} className="rounded-full bg-white px-3 py-1 text-xs text-amber-900">{pending.nome} · {pending.classroomName}</span>)}</div></section>}
      </div>
    );
  };

  const renderizarTabela = (dados: ReportData[]) => {
    if (!dados || dados.length === 0)
      return <p className="text-gray-500 text-center py-4">Nenhum registro encontrado para os filtros informados.</p>;
    const colunas = Object.keys(dados[0]).filter(k => k !== 'id');
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>{colunas.map(col => (
              <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                {traduzirChave(col)}
              </th>
            ))}</tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {dados.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {colunas.map(col => (
                  <td key={col} className="px-4 py-3 text-gray-800 whitespace-nowrap">{formatarValor(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderizarResultado = () => {
    if (reportType === 'pedagogical') return renderizarVisaoPedagogica();
    if (!reportData) return null;
    if (reportType === 'by-classroom') {
      const eventos = Array.isArray(reportData.events) ? reportData.events as ReportData[] : [];
      return (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{String(reportData.totalEvents ?? 0)}</div>
              <div className="text-sm text-blue-600">Total de Eventos</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{eventos.filter(e => e.planning !== null && e.planning !== undefined).length}</div>
              <div className="text-sm text-green-600">Com Planejamento</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-700">{eventos.filter(e => e.planning === null || e.planning === undefined).length}</div>
              <div className="text-sm text-orange-600">Sem Planejamento</div>
            </div>
          </div>
          {renderizarTabela(eventos)}
        </div>
      );
    }
    if (reportType === 'by-period') {
      const eventos = Array.isArray(reportData.events) ? reportData.events as ReportData[] : [];
      return (
        <div>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            Período: <strong>{formatarValor(reportData.startDate)}</strong> até <strong>{formatarValor(reportData.endDate)}</strong>
            {" — "}<strong>{String(reportData.totalEvents ?? eventos.length)}</strong> evento(s) encontrado(s)
            {selectedUnitId && unidades.find(u => u.id === selectedUnitId) && (
              <span> · Unidade: <strong>{unidades.find(u => u.id === selectedUnitId)?.name}</strong></span>
            )}
          </div>
          {renderizarTabela(eventos)}
        </div>
      );
    }
    if (reportType === 'unplanned') {
      if (Array.isArray(reportData)) return renderizarTabela(reportData as unknown as ReportData[]);
      const eventos = Array.isArray(reportData.events) ? reportData.events as ReportData[]
        : Array.isArray(reportData.unplannedEvents) ? reportData.unplannedEvents as ReportData[] : null;
      if (eventos !== null) {
        return (
          <div>
            <div className="mb-4 p-3 bg-orange-50 rounded-lg text-sm text-orange-700">
              <strong>{String(reportData.totalUnplanned ?? reportData.totalEvents ?? eventos.length)}</strong> evento(s) sem planejamento associado.
              {selectedUnitId && unidades.find(u => u.id === selectedUnitId) && (
                <span> · Unidade: <strong>{unidades.find(u => u.id === selectedUnitId)?.name}</strong></span>
              )}
            </div>
            {renderizarTabela(eventos)}
          </div>
        );
      }
      const pares = Object.entries(reportData).filter(([, v]) => v !== null && v !== undefined);
      if (pares.length === 0) return <p className="text-gray-500 text-center py-4">Nenhum evento não planejado encontrado.</p>;
      return (
        <div className="space-y-2">
          {pares.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="font-medium text-gray-600 w-48 shrink-0">{traduzirChave(k)}:</span>
              <span className="text-gray-800">{formatarValor(v)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Relatórios</h1>
      {isCentral && (
        <p className="text-sm text-gray-500 mb-6">
          Selecione uma unidade para filtrar os relatórios, ou deixe em branco para visualizar toda a rede.
        </p>
      )}

      {/* Seletor de unidade — apenas para STAFF_CENTRAL/MANTENEDORA/DEVELOPER */}
      {isCentral && unidades.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <label className="block text-sm font-semibold text-blue-800 mb-2">
            Filtrar por Unidade
          </label>
          <select
            value={selectedUnitId}
            onChange={e => handleUnitChange(e.target.value)}
            className="w-full sm:w-72 border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Toda a rede</option>
            {unidades.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          {selectedUnitId && (
            <p className="text-xs text-blue-600 mt-1">
              Relatórios filtrados para: <strong>{unidades.find(u => u.id === selectedUnitId)?.name}</strong>
            </p>
          )}
        </div>
      )}

      {/* Seletor de tipo de relatório */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button onClick={() => handleReportTypeChange('pedagogical')}
          className={`px-5 py-2 rounded-lg font-medium transition-colors ${reportType === 'pedagogical' ? 'bg-indigo-700 text-white ring-2 ring-indigo-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
          Inteligência Pedagógica
        </button>
        <button onClick={() => handleReportTypeChange('by-classroom')}
          className={`px-5 py-2 rounded-lg font-medium transition-colors ${reportType === 'by-classroom' ? 'bg-blue-700 text-white ring-2 ring-blue-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          Por Turma
        </button>
        <button onClick={() => handleReportTypeChange('by-period')}
          className={`px-5 py-2 rounded-lg font-medium transition-colors ${reportType === 'by-period' ? 'bg-green-700 text-white ring-2 ring-green-400' : 'bg-green-600 text-white hover:bg-green-700'}`}>
          Por Período
        </button>
        <button onClick={() => handleReportTypeChange('unplanned')}
          className={`px-5 py-2 rounded-lg font-medium transition-colors ${reportType === 'unplanned' ? 'bg-purple-700 text-white ring-2 ring-purple-400' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
          Não Planejado
        </button>
      </div>

      {reportType === 'pedagogical' && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-semibold mb-2 text-gray-700">Filtros — Visão Pedagógica Consolidada</h2>
          <p className="mb-4 text-sm text-gray-500">Escolha uma turma para ver evidências por criança. Sem turma, a visão mostra cobertura por unidade ou por toda a rede, conforme seu escopo.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Turma <span className="text-gray-400 text-xs">(opcional)</span></label>
              <select value={classroomId} onChange={e => setClassroomId(e.target.value)} disabled={turmasCarregando}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                <option value="">Todas as turmas do escopo</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Data de Início <span className="text-red-500">*</span></label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Data de Término <span className="text-red-500">*</span></label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <button onClick={carregarRelatorio} disabled={loading} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {loading ? 'Consolidando...' : 'Gerar Visão Pedagógica'}
          </button>
        </div>
      )}

      {reportType === 'by-classroom' && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Filtros — Relatório por Turma</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Turma <span className="text-red-500">*</span></label>
              <select value={classroomId} onChange={e => setClassroomId(e.target.value)}
                disabled={turmasCarregando}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                <option value="">{turmasCarregando ? 'Carregando turmas...' : turmas.length === 0 ? (isCentral && !selectedUnitId ? 'Selecione uma unidade primeiro' : 'Nenhuma turma encontrada') : 'Selecione a turma'}</option>
                {turmas.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {isCentral && !selectedUnitId && turmas.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">Mostrando turmas de toda a rede. Selecione uma unidade para filtrar.</p>
              )}
              {classroomId && turmas.find(t => t.id === classroomId) && (
                <p className="text-xs text-blue-600 mt-1">Selecionada: <strong>{turmas.find(t => t.id === classroomId)?.name}</strong></p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Data de Início <span className="text-red-500">*</span></label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Data de Término <span className="text-red-500">*</span></label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          <button onClick={carregarRelatorio} disabled={loading}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Carregando...' : 'Gerar Relatório'}
          </button>
        </div>
      )}

      {reportType === 'by-period' && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Filtros — Relatório por Período</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Data de Início <span className="text-gray-400 text-xs">(opcional)</span></label>
              <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Data de Término <span className="text-gray-400 text-xs">(opcional)</span></label>
              <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>
          {isCentral && selectedUnitId && (
            <p className="text-xs text-blue-600 mt-2">
              Filtrado para unidade: <strong>{unidades.find(u => u.id === selectedUnitId)?.name ?? selectedUnitId}</strong>
            </p>
          )}
          <button onClick={carregarRelatorio} disabled={loading}
            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
            {loading ? 'Carregando...' : 'Gerar Relatório'}
          </button>
        </div>
      )}

      {reportType === 'unplanned' && !reportData && !loading && !error && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border border-gray-100">
          <h2 className="text-lg font-semibold mb-2 text-gray-700">Eventos Não Planejados</h2>
          <p className="text-sm text-gray-500 mb-4">Lista todos os eventos do diário que não possuem planejamento pedagógico associado.</p>
          {isCentral && selectedUnitId && (
            <p className="text-xs text-blue-600 mb-3">
              Filtrado para unidade: <strong>{unidades.find(u => u.id === selectedUnitId)?.name ?? selectedUnitId}</strong>
            </p>
          )}
          <button onClick={carregarRelatorio} disabled={loading}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {loading ? 'Carregando...' : 'Gerar Relatório'}
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg mb-6">
          <strong>Atenção:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-gray-500">Carregando relatório...</p>
        </div>
      )}

      {!loading && !error && reportData && reportType && (
        <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">{titulos[reportType]}</h2>
            <span className="text-xs text-gray-400">Gerado em {new Date().toLocaleString('pt-BR')}</span>
          </div>
          {renderizarResultado()}
        </div>
      )}
    </div>
  );
}
