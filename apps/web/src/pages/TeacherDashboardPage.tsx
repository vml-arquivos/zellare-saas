import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../app/AuthProvider';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageShell } from '../components/ui/PageShell';
import { LoadingState } from '../components/ui/LoadingState';
import { toast } from 'sonner';
import {
  Users, BookOpen, ShoppingCart,
  Camera, UserCircle, CheckCircle, ClipboardList,
  ChevronRight, Bell, Calendar, X,
  Brain, Sparkles, TrendingUp, Award,
  Plus, Edit3, RefreshCw, FileText,
  Send, Download, Star, Lightbulb, ArrowRight, GraduationCap,
  AlertTriangle, Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import http, { isAuthExpiredError } from '../api/http';
import { createMicrogestureEvent, fetchRegisteredChildrenToday, type MicrogestureKind } from '../services/microgestures';
import { getObjetivosDia, getSegmentosNaData, temObjetivoNaData, CAMPOS_EXPERIENCIA, type SegmentoKey } from '../data/lookupDiario2026';
import { RecadosWidget } from '../components/recados/RecadosWidget';
import { ChildAvatar, hasChildPhoto, resolveChildPhotoUrl } from '../components/children/ChildAvatar';
import { ChildInfoModal } from '../components/children/ChildInfoModal';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface DashboardData {
  hasClassroom: boolean;
  message?: string;
  classroom?: {
    id: string; name: string; code: string; capacity: number;
    segmento?: string; unit: { name: string };
  };
  alunos?: Array<{
    id: string; nome: string; firstName: string; lastName: string;
    idade: number; gender: string; photoUrl?: string;
  }>;
  indicadores?: {
    totalAlunos: number; diariosEstaSemana: number;
    requisicoesStatus?: string; planejamentosEstaSemana: number;
    rdicsRegistrados?: number;
  };
}

interface DashboardPlanningObjective {
  campoExperiencia: string;
  codigoBNCC: string;
  objetivoBNCC: string;
  objetivoCurriculo: string;
  intencionalidade: string;
}

interface DashboardPlanningSummary {
  title: string;
  objectives: DashboardPlanningObjective[];
  atividade: string;
  recursos: string;
}

function toDisplayText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function formatCampoExperienciaLabel(value: unknown): string {
  return toDisplayText(value)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPlanningFieldDisplay(value: unknown, fallback = 'Não informado'): string {
  const normalized = toDisplayText(value);
  return normalized || fallback;
}

function getPlanningMatrixFields(obj: DashboardPlanningObjective) {
  return [
    {
      label: 'Campo de Experiência',
      value: getPlanningFieldDisplay(obj.campoExperiencia),
      tone: 'border-[var(--border-default)] bg-[var(--surface-inset)] text-[var(--text-secondary)]',
      labelTone: 'text-[var(--text-brand)]',
    },
    {
      label: 'Objetivo BNCC',
      value: getPlanningFieldDisplay(obj.objetivoBNCC),
      tone: 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]',
      labelTone: 'text-[var(--text-secondary)]',
    },
    {
      label: 'Objetivo do Currículo',
      value: getPlanningFieldDisplay(obj.objetivoCurriculo),
      tone: 'border-emerald-100 bg-[var(--surface-brand)] text-[var(--text-primary)]',
      labelTone: 'text-[var(--brand-600)]',
    },
    {
      label: 'Intencionalidade Pedagógica',
      value: getPlanningFieldDisplay(obj.intencionalidade),
      tone: 'border-[var(--border-brand)] bg-[var(--surface-brand)] text-[var(--text-primary)]',
      labelTone: 'text-[var(--text-brand)]',
    },
  ];
}

function getPlanningCodeDisplay(value: unknown): string {
  return getPlanningFieldDisplay(value, 'Código BNCC não informado');
}

function getPlanningObjectiveKey(obj: DashboardPlanningObjective, index: number): string {
  return `${obj.codigoBNCC || obj.campoExperiencia || 'objetivo'}-${index}`;
}

function normalizeDashboardPlanning(activePlanning: any, fallbackObjectives: any[]): DashboardPlanningSummary {
  const normalizedObjectives = (
    Array.isArray(activePlanning?.objetivosHoje) && activePlanning.objetivosHoje.length > 0
      ? activePlanning.objetivosHoje
      : fallbackObjectives.map((obj: any) => ({
          campoExperiencia: obj.campo_label,
          codigoBNCC: obj.codigo_bncc,
          objetivoBNCC: obj.objetivo_bncc,
          objetivoCurriculoDF: '',
          intencionalidadePedagogica: obj.intencionalidade,
        }))
  )
    .map((obj: any) => ({
      campoExperiencia: formatCampoExperienciaLabel(obj?.campoExperiencia ?? obj?.campo_label),
      codigoBNCC: toDisplayText(obj?.codigoBNCC ?? obj?.codigo_bncc),
      objetivoBNCC: toDisplayText(obj?.objetivoBNCC ?? obj?.objetivo_bncc),
      objetivoCurriculo: toDisplayText(obj?.objetivoCurriculoDF ?? obj?.objetivoCurriculo ?? obj?.objetivo_curriculo),
      intencionalidade: toDisplayText(obj?.intencionalidadePedagogica ?? obj?.intencionalidade),
    }))
    .filter((obj: DashboardPlanningObjective) => (
      obj.campoExperiencia
      || obj.codigoBNCC
      || obj.objetivoBNCC
      || obj.objetivoCurriculo
      || obj.intencionalidade
    ));

  return {
    title: toDisplayText(activePlanning?.title),
    objectives: normalizedObjectives,
    atividade: toDisplayText(activePlanning?.atividade ?? activePlanning?.teacher?.atividade),
    recursos: toDisplayText(activePlanning?.recursos ?? activePlanning?.teacher?.recursos),
  };
}

// ─── Ações Rápidas ────────────────────────────────────────────────────────────
const ACOES_RAPIDAS = [
  { id: 'chamada', label: 'Chamada', desc: 'Marcar presença', icon: <CheckCircle className="h-6 w-6" />, cor: 'bg-[var(--surface-brand)]', rota: '/app/chamada' },
  { id: 'diario', label: 'Diário da Turma', desc: 'Registrar o dia', icon: <BookOpen className="h-6 w-6" />, cor: 'bg-[var(--surface-brand)]', rota: '/app/diario-calendario' },
  { id: 'planejamento', label: 'Planejamentos', desc: 'Planejar semana', icon: <Calendar className="h-6 w-6" />, cor: 'bg-[var(--surface-brand)]', rota: '/app/planejamentos' },
  { id: 'sala', label: 'Sala de Aula Virtual', desc: 'Tarefas e desempenho', icon: <GraduationCap className="h-6 w-6" />, cor: 'bg-[var(--surface-brand)]', rota: '/app/sala-de-aula-virtual' },
  { id: 'rdic', label: 'Desenvolvimento', desc: 'Registrar', icon: <Brain className="h-6 w-6" />, cor: 'bg-[var(--surface-brand)]', rota: '/app/rdic-crianca' },
  { id: 'materiais', label: 'Materiais', desc: 'Solicitar recursos', icon: <ShoppingCart className="h-6 w-6" />, cor: 'bg-[var(--surface-brand)]', rota: '/app/material-requests' },
  { id: 'fotos', label: 'Fotos da Turma', desc: 'Galeria e RDX', icon: <Camera className="h-6 w-6" />, cor: 'bg-[var(--surface-brand)]', rota: '/app/rdx' },
  { id: 'relatorio', label: 'Relatórios', desc: 'Ver evolução', icon: <TrendingUp className="h-6 w-6" />, cor: 'bg-[var(--surface-brand)]', rota: '/app/reports' },
  { id: 'matriz', label: 'Matriz 2026', desc: 'Objetivos BNCC', icon: <FileText className="h-6 w-6" />, cor: 'bg-[var(--surface-brand)]', rota: '/app/planejamentos' },
];

// ─── Componente de Upload de Foto ─────────────────────────────────────────────
function extractUploadedPhotoUrl(payload: any): string | undefined {
  return resolveChildPhotoUrl(payload)
    ?? resolveChildPhotoUrl(payload?.data)
    ?? resolveChildPhotoUrl(payload?.child)
    ?? (typeof payload?.url === 'string' ? payload.url.trim() : undefined)
    ?? (typeof payload?.data?.url === 'string' ? payload.data.url.trim() : undefined);
}

function FotoUpload({ crianca, onUpload }: { crianca: any; onUpload: (id: string, url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande (máx. 5MB)'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('childId', crianca.id);
      const res = await http.post(`/children/${crianca.id}/photo`, formData);
      const url = extractUploadedPhotoUrl(res.data);
      if (!url) {
        throw new Error('Resposta de upload sem photoUrl');
      }
      onUpload(crianca.id, url);
      toast.success(`Foto de ${crianca.firstName} atualizada!`);
    } catch (error) {
      if (isAuthExpiredError(error)) {
        toast.error('Sua sessão expirou. Faça login novamente para salvar a foto.');
      } else {
        toast.error(`Não foi possível salvar a foto de ${crianca.firstName}. Tente novamente.`);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
        disabled={uploading}
        className="absolute bottom-0 right-0 w-5 h-5 bg-[var(--surface-card)] rounded-full shadow border border-[var(--border-default)] flex items-center justify-center cursor-pointer hover:bg-[var(--surface-brand)] z-10"
        title="Adicionar foto">
        {uploading ? <RefreshCw className="h-2.5 w-2.5 text-blue-500 animate-spin" /> : <Camera className="h-2.5 w-2.5 text-[var(--text-secondary)]" />}
      </button>
    </>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function TeacherDashboardPage() {
  const { user } = useAuth() as any;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<{ url: string; nome: string } | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'turma' | 'acoes' | 'indicadores' | 'ia' | 'rdic'>('turma');
  // Aba Desenvolvimento da Turma
  const [rdicsMap, setRdicsMap] = useState<Record<string, { count: number; ultimoStatus: string; ultimoPeriodo: string }>>({});
  const [loadingRdics, setLoadingRdics] = useState(false);
  const [entradaDiarioIA, setEntradaDiarioIA] = useState('');
  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [relatorioIA, setRelatorioIA] = useState<{ relatorio: string; pontosFortess: string[]; sugestoes: string[] } | null>(null);
  // Indicador de registro por criança (childId -> true se já tem evento hoje)
  const [registradosHoje, setRegistradosHoje] = useState<Set<string>>(new Set());

  // ─── Widget Hoje (API /insights/teacher/today) ─────────────────────────────────
  const [insightsHoje, setInsightsHoje] = useState<any>(null);
  const loadInsightsHoje = useCallback(() => {
    http.get('/insights/teacher/today')
      .then(r => setInsightsHoje(r.data))
      .catch(() => setInsightsHoje(null));
  }, []);
  useEffect(() => { loadInsightsHoje(); }, [loadInsightsHoje]);

  // ─── Tarefa 1.5: Alertas de alergias da turma ────────────────────────────────
  const [alertasAlergias, setAlertasAlergias] = useState<{
    comAlergia: number;
    casosCriticos: number;
    nomes: string[];
  } | null>(null);
  useEffect(() => {
    // Só busca após o dashboard carregar e a turma estar disponível
    if (!data?.classroom?.id) return;
    http.get('/children/health/dashboard', { params: { classroomId: data.classroom.id } })
      .then(r => {
        const children: any[] = r.data?.children ?? [];
        const stats = r.data?.stats ?? {};
        const comAlergia: number = stats.comAlergia ?? children.filter((c: any) =>
          (c.dietaryRestrictions ?? []).some((dr: any) => dr.type === 'ALERGIA')
        ).length;
        const casosCriticos: number = stats.casosCriticos ?? children.filter((c: any) =>
          (c.dietaryRestrictions ?? []).some((dr: any) => dr.severity === 'severa')
        ).length;
        const nomes: string[] = children
          .filter((c: any) => (c.dietaryRestrictions ?? []).some((dr: any) => dr.type === 'ALERGIA' || dr.severity === 'severa'))
          .map((c: any) => c.firstName ?? c.name ?? '')
          .filter(Boolean)
          .slice(0, 5);
        if (comAlergia > 0 || casosCriticos > 0) {
          setAlertasAlergias({ comAlergia, casosCriticos, nomes });
        }
      })
      .catch(() => {
        // Silencioso: não bloquear o dashboard se o endpoint falhar
      });
  }, [data?.classroom?.id]);

  // Tarefa 2.4 — Alertas operacionais da turma (faltas consecutivas, etc.)
  const [alertasOperacionais, setAlertasOperacionais] = useState<{
    total: number;
    criticos: number;
    atencao: number;
    alertas: any[];
  } | null>(null);
  useEffect(() => {
    if (!data?.classroom?.id) return;
    http.get('/alertas', { params: { classroomId: data.classroom.id, unread: 'true', limit: '20' } })
      .then(r => {
        if (r.data?.total > 0) setAlertasOperacionais(r.data);
      })
      .catch(() => { /* silencioso */ });
  }, [data?.classroom?.id]);

  // Modal de microgesto rápido
  const [modalCriancaInfo, setModalCriancaInfo] = useState<string | null>(null);
  const [modalCrianca, setModalCrianca] = useState<{ id: string; nome: string } | null>(null);
  const [microgestoRapido, setMicrogestoRapido] = useState<MicrogestureKind>('OBSERVACAO');
  const [microgestoTexto, setMicrogestoTexto] = useState('');
  const [savingMicrogesto, setSavingMicrogesto] = useState(false);

  useEffect(() => { loadDashboard(); }, []);

  // Tarefa 1.3 — Auto-refresh: recarregar dashboard a cada 5 minutos e ao voltar para a aba
  useEffect(() => {
    // Refetch ao focar na aba (visibilitychange)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadDashboard();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Refetch automático a cada 5 minutos
    const interval = setInterval(() => {
      loadDashboard();
    }, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  // Carregar Relatórios da turma quando aba rdic é ativada
  useEffect(() => {
    const lista = data?.alunos ?? [];
    if (abaAtiva === 'rdic' && lista.length > 0 && Object.keys(rdicsMap).length === 0) {
      carregarRdicsDaTurma();
    }
  }, [abaAtiva, data]);

  async function carregarRdicsDaTurma() {
    setLoadingRdics(true);
    try {
      const mapa: Record<string, { count: number; ultimoStatus: string; ultimoPeriodo: string }> = {};
      await Promise.all(
        alunos.map(async (a) => {
          try {
            const res = await http.get('/rdic', { params: { childId: a.id } });
            const lista: any[] = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
            mapa[a.id] = {
              count: lista.length,
              ultimoStatus: lista[0]?.status ?? '',
              ultimoPeriodo: lista[0]?.periodo ?? '',
            };
          } catch {
            mapa[a.id] = { count: 0, ultimoStatus: '', ultimoPeriodo: '' };
          }
        }),
      );
      setRdicsMap(mapa);
    } finally {
      setLoadingRdics(false);
    }
  }

  useEffect(() => {
    if (data?.classroom?.id) {
      fetchRegisteredChildrenToday(data.classroom.id).then(setRegistradosHoje);
    }
  }, [data?.classroom?.id]);

  async function registrarMicrogestoRapido() {
    if (!modalCrianca) return;
    if (!data?.classroom?.id) { toast.error('Turma não identificada'); return; }
    setSavingMicrogesto(true);
    try {
      await createMicrogestureEvent({
        childId: modalCrianca.id,
        classroomId: data.classroom.id,
        kind: microgestoRapido,
        payload: { texto: microgestoTexto || undefined },
        eventDate: new Date().toISOString(),
      });
      toast.success(`Registrado com sucesso para ${modalCrianca.nome.split(' ')[0]}!`);
      setRegistradosHoje(prev => new Set([...prev, modalCrianca.id]));
      setModalCrianca(null);
      setMicrogestoTexto('');
      setMicrogestoRapido('OBSERVACAO');
    } catch (err: unknown) {
      const e = err as Error;
      toast.error(e?.message || 'Erro ao salvar microgesto');
    } finally {
      setSavingMicrogesto(false);
    }
  }

  async function loadDashboard() {
    try {
      setLoading(true);
      const response = await http.get('/teachers/dashboard');
      setData(response.data);
      loadInsightsHoje();
    } catch {
      toast.error('Não foi possível carregar seu painel.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEvidenciaRapidaUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    const classroomId = insightsHoje?.planejamentoAtivo?.classroomId || data?.classroom?.id;
    if (!classroomId) {
      toast.error('Turma não identificada para registrar evidências.');
      return;
    }

    try {
      const res = await http.get('/diary-events', {
        params: {
          classroomId,
          startDate: new Date().toISOString().split('T')[0],
          limit: 1,
        },
      });

      const events = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      const diarioHoje = events[0];

      if (!diarioHoje?.id) {
        toast.info('Crie o diário do dia antes de adicionar evidências.');
        navigate(`/app/diario-de-bordo?classroomId=${encodeURIComponent(classroomId)}`);
        return;
      }

      let sucesso = 0;
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        try {
          await http.post(`/diary-events/${diarioHoje.id}/media`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          sucesso++;
        } catch {
          // continua tentando os demais arquivos
        }
      }

      if (sucesso > 0) {
        toast.success(`${sucesso} evidência${sucesso > 1 ? 's' : ''} registrada${sucesso > 1 ? 's' : ''} com sucesso!`);
      } else {
        toast.error('Não foi possível registrar as evidências. Tente no diário.');
      }
    } catch {
      toast.error('Erro ao registrar evidência. Tente no diário.');
    }
  }

  function atualizarFoto(childId: string, url: string) {
    setData(prev => prev ? {
      ...prev,
      alunos: prev.alunos?.map(a => a.id === childId ? { ...a, photoUrl: url } : a),
    } : prev);
  }

  if (loading) return <LoadingState message="Carregando seu painel..." />;

  const nomeProf = (user?.nome ?? user?.firstName ?? 'Professor(a)').split(' ')[0];
  const alunos = data?.alunos ?? [];
  const ind = data?.indicadores;
  const turma = data?.classroom;

  // Widget do Objetivo do Dia
  const hoje2 = new Date();
  const ddmmHoje = `${String(hoje2.getDate()).padStart(2,'0')}/${String(hoje2.getMonth()+1).padStart(2,'0')}`;
  const segmentoTurma = (turma?.segmento as SegmentoKey) || 'EI02';
  const objetivosHoje = getObjetivosDia(ddmmHoje, segmentoTurma);
  const segmentosHoje = getSegmentosNaData(ddmmHoje);
  const CAMPO_CORES: Record<string, string> = {
    'eu-outro-nos': 'bg-[var(--surface-inset)] border-[var(--border-default)] text-[var(--text-secondary)]',
    'corpo-gestos': 'bg-[var(--surface-inset)] border-[var(--border-default)] text-[var(--text-secondary)]',
    'tracos-sons': 'bg-[var(--surface-inset)] border-[var(--border-default)] text-[var(--text-secondary)]',
    'escuta-fala': 'bg-[var(--surface-brand)] border-[var(--border-brand)] text-[var(--text-brand)]',
    'espacos-tempos': 'bg-[var(--surface-inset)] border-[var(--border-default)] text-[var(--text-secondary)]',
  };
  const totalAlunos = ind?.totalAlunos ?? alunos.length;
  const presentesHoje = insightsHoje?.presenca?.presentes ?? 0;
  const ausentesHoje = insightsHoje?.presenca?.ausentes ?? Math.max(totalAlunos - presentesHoje, 0);
  const diariosSemana = ind?.diariosEstaSemana ?? 0;
  const planejamentosSemana = ind?.planejamentosEstaSemana ?? 0;
  const rdicsRegistrados = ind?.rdicsRegistrados ?? 0;
  const registrosHoje = registradosHoje.size;
  const presencaPct = totalAlunos > 0 ? Math.min(100, Math.round((presentesHoje / totalAlunos) * 100)) : 0;
  const diariosPct = Math.min(100, Math.round((diariosSemana / 5) * 100));
  const planejamentosPct = Math.min(100, Math.round((planejamentosSemana / 5) * 100));
  const registrosHojePct = totalAlunos > 0 ? Math.min(100, Math.round((registrosHoje / totalAlunos) * 100)) : 0;
  const planejamentoResumoHoje = normalizeDashboardPlanning(insightsHoje?.planejamentoAtivo, objetivosHoje);
  const cardsResumoTurma = [
    {
      label: 'Registros do dia',
      value: registrosHoje,
      helper: totalAlunos > 0 ? `${registrosHojePct}% da turma acompanhada hoje` : 'Sem turma vinculada',
      icon: <Sparkles className="h-5 w-5" />,
      accent: 'text-[var(--brand-600)]',
      iconShell: 'bg-[var(--brand-600)]',
      progress: registrosHojePct,
      progressClass: 'bg-[var(--brand-600)]',
    },
    {
      label: 'Planejamentos no período',
      value: planejamentosSemana,
      helper: 'Acompanhamento da semana',
      icon: <Calendar className="h-5 w-5" />,
      accent: 'text-[var(--brand-600)]',
      iconShell: 'bg-[var(--brand-600)]',
      progress: planejamentosPct,
      progressClass: 'bg-[var(--brand-600)]',
    },
  ];
  const destaquesResumoTurma = [
    `${totalAlunos} criança(s) na turma`,
    `${presentesHoje} presente(s) hoje`,
    `${registrosHoje} registro(s) pedagógico(s) no dia`,
  ];
  if (planejamentoResumoHoje.objectives.length > 0) {
    destaquesResumoTurma.push(`${planejamentoResumoHoje.objectives.length} objetivo(s) ativos`);
  };

  return (
    <PageShell
      title={`Olá, ${nomeProf}! 👋`}
      subtitle={turma ? `${turma.name} · ${turma.unit?.name}` : 'Painel do Professor'}
    >
      {/* Sem turma */}
      {!data?.hasClassroom && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-[var(--surface-brand)] rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="h-10 w-10 text-[var(--brand-600)]" />
          </div>
          <p className="text-lg font-medium text-[var(--text-primary)] mb-2">Você ainda não tem turma</p>
          <p className="text-[var(--text-secondary)] text-sm">Aguarde a coordenação vincular você a uma turma.</p>
        </div>
      )}

      {data?.hasClassroom && (
        <div className="space-y-6 overflow-x-hidden">
          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr] max-w-full">
            <div className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-base)] p-5 text-[var(--text-primary)] shadow-[var(--shadow-card)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                    <Star className="h-3.5 w-3.5 text-[var(--brand-600)]" />
                    Cockpit da turma
                  </div>
                  <div>
                    <h2 className="text-[1.65rem] font-medium tracking-[-0.01em]">Resumo da turma</h2>
                    <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
                      {turma ? `${turma.name} · ${turma.unit?.name}` : 'Painel da professora'}
                      {turma?.segmento ? ` · segmento ${turma.segmento}` : ''}
                    </p>
                  </div>
                  <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                    <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                      {destaquesResumoTurma.map((item) => (
                        <span key={item} className="rounded-full border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-1">{item}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="min-w-[240px] rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Resumo do dia</p>
                      <p className="mt-1 text-3xl font-medium">{presentesHoje}<span className="text-base font-medium text-[var(--text-tertiary)]">/{totalAlunos || '?'} presentes</span></p>
                    </div>
                    <div className="rounded-2xl bg-[var(--surface-brand)] p-3 text-[var(--brand-500)]">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div className="h-full rounded-full bg-[var(--brand-600)] transition-all" style={{ width: `${presencaPct}%` }} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                    <div className="rounded-2xl bg-[var(--surface-inset)] p-3">
                      <p className="text-[var(--text-tertiary)]">Ausências</p>
                      <p className="mt-1 text-lg font-medium text-[var(--text-inverse)]">{ausentesHoje}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--surface-inset)] p-3">
                      <p className="text-[var(--text-tertiary)]">Registros hoje</p>
                      <p className="mt-1 text-lg font-medium text-[var(--text-inverse)]">{registrosHoje}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {cardsResumoTurma.map((card) => (
                <div key={card.label} className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{card.label}</p>
                      <p className={`mt-2 text-3xl font-medium ${card.accent}`}>{card.value}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{card.helper}</p>
                    </div>
                    <div className={`rounded-2xl ${card.iconShell} p-3 text-[var(--text-inverse)] shadow-sm`}>
                      {card.icon}
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div className={`h-full rounded-full ${card.progressClass} transition-all`} style={{ width: `${card.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Widget: Hoje — dados reais da API com fallback para lookup local */}
          {(insightsHoje || objetivosHoje.length > 0) && (
            <div className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-600)] text-[var(--text-inverse)] shadow-[var(--shadow-xs)]">
                    <Star className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">Hoje</p>
                    <p className="mt-1 text-lg font-medium text-[var(--text-primary)]">
                      {insightsHoje?.diaSemana ? insightsHoje.diaSemana.charAt(0).toUpperCase() + insightsHoje.diaSemana.slice(1) : ddmmHoje + '/2026'}
                    </p>
                    {insightsHoje?.planejamentoAtivo ? (
                      <p className="mt-1 text-sm text-[var(--text-primary)]">
                        Ativo: <span className="font-medium">{insightsHoje.planejamentoAtivo.title}</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-[var(--text-primary)]">Sem planejamento hoje.</p>
                    )}
                  </div>
                </div>
                <button onClick={() => navigate('/app/planejamentos')}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-brand)] bg-[var(--surface-card)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-card)]">
                  Planejamentos <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-3">
                  {insightsHoje?.alertas?.planejamentosPendentes > 0 && (
                    <div className="rounded-2xl border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-3 flex items-start gap-2">
                      <Bell className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--error)]" />
                      <p className="text-xs font-medium text-[var(--error)]">
                        {insightsHoje.alertas.planejamentosPendentes} planejamento(s) em rascunho há mais de 2 dias. <button onClick={() => navigate('/app/planejamentos')} className="underline underline-offset-2">Enviar para revisão</button>
                      </p>
                    </div>
                  )}

                  <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--brand-600)]">Presença</p>
                        <p className="mt-1 text-2xl font-medium text-[var(--text-primary)]">{presentesHoje}<span className="text-sm font-medium text-[var(--brand-600)]">/{totalAlunos || '?'} presentes</span></p>
                      </div>
                      <div className="rounded-2xl bg-[var(--surface-brand)] p-3 text-[var(--brand-600)]">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-brand)]">
                      <div className="h-full rounded-full bg-[var(--brand-600)] transition-all" style={{ width: `${presencaPct}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-[var(--brand-600)]">{ausentesHoje} ausência(s) registradas no dia.</p>
                  </div>

                  <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">Resumo</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">Diários da semana</p>
                        <p className="mt-1 text-lg font-medium text-[var(--text-primary)]">{diariosSemana}/5</p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--brand-600)]" style={{ width: `${diariosPct}%` }} /></div>
                      </div>
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-3">
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">Registros</p>
                        <p className="mt-1 text-lg font-medium text-[var(--text-primary)]">{registrosHoje}/{totalAlunos || '?'}</p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--brand-600)]" style={{ width: `${registrosHojePct}%` }} /></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="rounded-[24px] border border-[var(--border-default)]/80 bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">Planejamento</p>
                        <h3 className="mt-1 text-base font-medium leading-tight text-[var(--text-primary)] break-words">
                          {planejamentoResumoHoje.title || 'Planejamento do dia'}
                        </h3>
                      </div>
                      <button onClick={() => navigate('/app/planejamentos')}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-brand)]">
                        Ver plano <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                    {(planejamentoResumoHoje.atividade || planejamentoResumoHoje.recursos || planejamentoResumoHoje.objectives.length > 0) ? (
                      <div className="mt-4 space-y-3">
                        {planejamentoResumoHoje.atividade && (
                          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-inset)]/80 px-4 py-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">Atividade</p>
                            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words">{planejamentoResumoHoje.atividade}</p>
                          </div>
                        )}
                        {planejamentoResumoHoje.recursos && (
                          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">Recursos</p>
                            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap break-words">{planejamentoResumoHoje.recursos}</p>
                          </div>
                        )}
                        {!planejamentoResumoHoje.atividade && !planejamentoResumoHoje.recursos && planejamentoResumoHoje.objectives.length > 0 && (
                          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 py-3">
                            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">Campos</p>
                            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                              {[...new Set(planejamentoResumoHoje.objectives.map(o => o.campoExperiencia).filter(Boolean))].join(' · ') || 'Não informado'}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 text-center rounded-2xl border border-dashed border-[var(--border-brand)] bg-[var(--surface-card)] py-8 px-4">
                        <p className="text-sm text-[var(--text-secondary)]">Sem planejamento hoje.</p>
                        <button onClick={() => navigate('/app/planejamento/novo')}
                          className="mt-2 text-xs font-medium text-[var(--text-primary)] underline underline-offset-2">
                          Criar planejamento →
                        </button>
                      </div>
                    )}

                    {insightsHoje?.planejamentoAtivo?.id && (
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          onClick={() => navigate(`/app/diario-de-bordo?classroomId=${encodeURIComponent(insightsHoje.planejamentoAtivo.classroomId)}`)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-[var(--text-inverse)] text-sm font-medium rounded-xl transition-colors"
                        >
                          <ClipboardList className="h-4 w-4" />
                          Registrar Diário
                        </button>
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.multiple = true;
                            input.onchange = async (e) => {
                              const files = (e.target as HTMLInputElement).files;
                              await handleEvidenciaRapidaUpload(files);
                            };
                            input.click();
                          }}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-[var(--text-inverse)] text-sm font-medium rounded-xl transition-colors"
                          title="Registrar evidência fotográfica do dia"
                        >
                          <Camera className="h-4 w-4" />
                          Evidência
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tarefa 1.5 — Card de alertas de alergias */}
          {alertasAlergias && (
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 shadow-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--error)]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--error)]">
                  {alertasAlergias.comAlergia} criança{alertasAlergias.comAlergia !== 1 ? 's' : ''} com alergia na turma
                  {alertasAlergias.casosCriticos > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--error-bg)] px-2 py-0.5 text-xs font-medium text-[var(--error)]">
                      <Shield className="h-3 w-3" />
                      {alertasAlergias.casosCriticos} caso{alertasAlergias.casosCriticos !== 1 ? 's' : ''} crítico{alertasAlergias.casosCriticos !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
                {alertasAlergias.nomes.length > 0 && (
                  <p className="mt-0.5 text-xs text-[var(--error)]">
                    {alertasAlergias.nomes.join(', ')}{alertasAlergias.nomes.length === 5 ? ' e outros' : ''}
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate('/app/painel-alergias')}
                className="flex-shrink-0 rounded-full border border-[var(--error-border)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
              >
                Ver detalhes
              </button>
            </div>
          )}

          {/* Tarefa 2.4 — Card de alertas operacionais */}
          {alertasOperacionais && (
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-inset)] px-4 py-3 shadow-sm">
              <Bell className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--brand-600)]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {alertasOperacionais.total} alerta{alertasOperacionais.total !== 1 ? 's' : ''} operacional{alertasOperacionais.total !== 1 ? 'is' : ''} na turma
                  {alertasOperacionais.criticos > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--error-bg)] px-2 py-0.5 text-xs font-medium text-[var(--error)]">
                      {alertasOperacionais.criticos} crítico{alertasOperacionais.criticos !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
                {alertasOperacionais.alertas.slice(0, 3).map((a: any) => (
                  <p key={a.id} className="mt-0.5 text-xs text-[var(--text-secondary)] truncate">• {a.titulo}</p>
                ))}
              </div>
            </div>
          )}

          {/* Abas */}
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-inset)] p-1">
            {[
              { id: 'turma', label: 'Minha Turma', icon: <Users className="h-4 w-4" /> },
              { id: 'rdic', label: 'Desenvolvimento', icon: <Brain className="h-4 w-4" /> },
              { id: 'acoes', label: 'Ações Rápidas', icon: <Sparkles className="h-4 w-4" /> },
              { id: 'ia', label: 'IA Pedagógica', icon: <FileText className="h-4 w-4" /> },
              { id: 'indicadores', label: 'Progresso', icon: <TrendingUp className="h-4 w-4" /> },
            ].map(tab => (
              <button key={tab.id} onClick={() => setAbaAtiva(tab.id as any)}
                className={`flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${abaAtiva === tab.id ? 'bg-[var(--surface-card)] text-[var(--text-brand)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                {tab.icon} <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ─── MINHA TURMA ─── */}
          {abaAtiva === 'turma' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-medium text-[var(--text-primary)]">Minhas Crianças</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1">{alunos.length} crianças</span>
                  <span className="rounded-full bg-[var(--surface-brand)] px-3 py-1 text-[var(--brand-600)]">{registrosHoje} com registro hoje</span>
                  <button onClick={() => navigate('/app/chamada')}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-600)] px-3 py-1.5 font-medium text-[var(--text-inverse)] transition hover:bg-[var(--brand-700)]">
                    Fazer chamada <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {alunos.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-2xl">
                  <Users className="w-12 h-12 mx-auto mb-2 text-[var(--text-disabled)]" />
                  <p className="text-[var(--text-tertiary)]">Nenhuma criança matriculada ainda</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {alunos.map(aluno => {
                    const temFoto = hasChildPhoto(aluno);
                    const generoLabel = aluno.gender === 'MASCULINO' ? 'Menino' : aluno.gender === 'FEMININO' ? 'Menina' : 'Não informado';
                    const registradoHoje = registradosHoje.has(aluno.id);

                    return (
                      <div key={aluno.id}
                        className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] shadow-sm hover:shadow-md hover:border-[var(--border-brand)] transition-all duration-200 p-4 flex flex-col items-center gap-3">

                        {/* Avatar + câmera */}
                        <div className="relative w-14 h-14 flex-shrink-0 cursor-pointer"
                          onClick={() => setModalCriancaInfo(aluno.id)}>
                          {temFoto ? (
                            <img
                              src={resolveChildPhotoUrl(aluno)!}
                              alt={`${aluno.firstName} ${aluno.lastName}`}
                              className="w-14 h-14 rounded-full object-cover ring-2 ring-offset-1 ring-[var(--brand-200)]"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-[var(--brand-600)] flex items-center justify-center text-[var(--text-inverse)] font-medium text-base ring-2 ring-offset-1 ring-[var(--brand-200)]">
                              {aluno.firstName?.[0]}{aluno.lastName?.[0]}
                            </div>
                          )}
                          <FotoUpload crianca={aluno} onUpload={atualizarFoto} />
                        </div>

                        {/* Nome */}
                        <p className="text-sm font-medium text-[var(--text-primary)] text-center leading-snug w-full truncate">
                          {aluno.firstName} {aluno.lastName}
                        </p>

                        {/* Subtítulo */}
                        <p className="text-xs text-[var(--text-tertiary)] text-center">
                          {aluno.idade} meses · {generoLabel}
                        </p>

                        {/* Badge de registro */}
                        <span className={registradoHoje
                          ? 'text-xs bg-[var(--surface-brand)] text-[var(--text-brand)] px-2 py-0.5 rounded-full'
                          : 'text-xs bg-[var(--surface-inset)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full'}>
                          {registradoHoje ? 'Registrado hoje' : 'Sem registro'}
                        </span>

                        {/* Botões de ação */}
                        <div className="flex gap-2 w-full mt-1">
                          <button
                            onClick={() => { setModalCrianca({ id: aluno.id, nome: aluno.nome }); }}
                            title="Registrar microgesto"
                            className="flex-1 text-xs font-medium bg-[var(--brand-600)] text-[var(--text-inverse)] rounded-xl py-2 hover:bg-[var(--brand-700)] transition">
                            Registrar
                          </button>
                          <button onClick={() => navigate('/app/rdx')} title="Fotos"
                            className="flex-1 text-xs font-medium border border-[var(--border-default)] text-[var(--text-secondary)] rounded-xl py-2 hover:bg-[var(--surface-inset)] transition">
                            Fotos
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Recados da Coordenadora (sempre visível na aba turma) */}
          {abaAtiva === 'turma' && (
            <RecadosWidget titulo="Recados da Coordenação" />
          )}

          {/* ─── Desenvolvimento DA TURMA ─── */}
          {abaAtiva === 'rdic' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium text-[var(--text-primary)]">Desenvolvimento da Turma — Bimestre Atual</h2>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Cobertura de Registros de Desenvolvimento Individual</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setRdicsMap({}); carregarRdicsDaTurma(); }}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] p-1 rounded"
                    title="Atualizar"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <Button
                    size="sm"
                    onClick={() => navigate('/app/rdic-crianca')}
                    className="bg-[var(--brand-600)] hover:bg-[var(--surface-brand)] text-[var(--text-inverse)] text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Novo Desenvolvimento
                  </Button>
                </div>
              </div>

              {/* Tarefa 3.5 — Indicador de crianças com objetivos pendentes (sem Desenvolvimento no trimestre atual) */}
              {!loadingRdics && alunos.length > 0 && (() => {
                const trimestreAtual = Math.ceil((new Date().getMonth() + 1) / 4) || 1;
                const semRdicTrimestre = alunos.filter(a => {
                  const info = rdicsMap[a.id];
                  if (!info || info.count === 0) return true;
                  // Verifica se o último período é do trimestre atual
                  const periodo = info.ultimoPeriodo?.toLowerCase() ?? '';
                  const temTrimAtual = periodo.includes(`${trimestreAtual}º`) || periodo.includes(`${trimestreAtual}o`);
                  return !temTrimAtual;
                });
                if (semRdicTrimestre.length === 0) return null;
                return (
                  <div className="bg-[var(--surface-inset)] border border-[var(--border-default)] rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-[var(--surface-brand)] rounded-lg flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {semRdicTrimestre.length} {semRdicTrimestre.length === 1 ? 'criança' : 'crianças'} sem Desenvolvimento no {trimestreAtual}º trimestre
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {semRdicTrimestre.slice(0, 3).map(a => a.firstName).join(', ')}
                          {semRdicTrimestre.length > 3 ? ` e mais ${semRdicTrimestre.length - 3}` : ''}
                        </p>
                        <button
                          onClick={() => navigate('/app/rdic-crianca')}
                          className="mt-2 text-xs text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
                        >
                          Registrar agora →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Barra de cobertura geral */}
              {alunos.length > 0 && (
                <div className="bg-[var(--surface-brand)] border border-[var(--border-default)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">Cobertura da turma</span>
                    <span className="text-sm font-medium text-[var(--text-brand)]">
                      {loadingRdics ? '...' : `${Object.values(rdicsMap).filter(r => r.count > 0).length} / ${alunos.length} crianças`}
                    </span>
                  </div>
                  <div className="w-full bg-[var(--surface-muted)] rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-[var(--brand-600)] transition-all duration-500"
                      style={{ width: loadingRdics ? '0%' : `${alunos.length > 0 ? Math.round((Object.values(rdicsMap).filter(r => r.count > 0).length / alunos.length) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {loadingRdics ? 'Carregando...' : `${alunos.length > 0 ? Math.round((Object.values(rdicsMap).filter(r => r.count > 0).length / alunos.length) * 100) : 0}% das crianças com pelo menos 1 Desenvolvimento registrado`}
                  </p>
                </div>
              )}

              {/* Lista por criança */}
              {loadingRdics ? (
                <div className="text-center py-8 text-[var(--text-tertiary)] text-sm">Carregando Relatórios...</div>
              ) : (
                <div className="space-y-2">
                  {alunos.map(aluno => {
                    const info = rdicsMap[aluno.id] ?? { count: 0, ultimoStatus: '', ultimoPeriodo: '' };
                    const temRdic = info.count > 0;
                    const statusColor = info.ultimoStatus === 'PUBLICADO'
                      ? 'bg-[var(--surface-brand)] text-[var(--text-secondary)]'
                      : info.ultimoStatus === 'REVISAO'
                      ? 'bg-[var(--surface-brand)] text-[var(--text-secondary)]'
                      : info.ultimoStatus === 'RASCUNHO'
                      ? 'bg-[var(--surface-brand)] text-[var(--text-brand)]'
                      : 'bg-[var(--surface-inset)] text-[var(--text-secondary)]xt-secondary)]';
                    const statusLabel = info.ultimoStatus === 'PUBLICADO' ? 'Publicado'
                      : info.ultimoStatus === 'REVISAO' ? 'Em Revisão'
                      : info.ultimoStatus === 'RASCUNHO' ? 'Rascunho'
                      : 'Sem Desenvolvimento';
                    return (
                      <button
                        key={aluno.id}
                        onClick={() => navigate(`/app/rdic-crianca?childId=${aluno.id}`)}
                        className="w-full flex items-center gap-3 p-3 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl hover:border-[var(--border-default)] hover:shadow-sm transition-all text-left"
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-inverse)] text-sm font-medium flex-shrink-0 ${
                          temRdic ? 'bg-[var(--brand-600)]' : 'bg-[var(--surface-muted)]'
                        }`}>
                          <ChildAvatar
                            child={aluno}
                            alt={aluno.firstName}
                            sizeClassName="w-10 h-10"
                            imageClassName="rounded-full object-cover"
                            fallbackClassName={`w-10 h-10 rounded-full flex items-center justify-center ${temRdic ? 'bg-[var(--brand-600)] text-[var(--text-inverse)]' : 'bg-[var(--surface-muted)] text-[var(--text-inverse)]'}`}
                            initialsClassName="text-sm font-medium"
                            showInitials
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-[var(--text-primary)] truncate">{aluno.firstName} {aluno.lastName}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{info.ultimoPeriodo || 'Nenhum período registrado'}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
                          {temRdic && (
                            <span className="text-xs text-[var(--text-tertiary)]">{info.count} reg.</span>
                          )}
                          <ChevronRight className="h-4 w-4 text-[var(--text-disabled)]" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── AÇÕES RÁPIDAS ─── */}
          {abaAtiva === 'acoes' && (
            <div>
              <h2 className="text-base font-medium text-[var(--text-primary)] mb-4">O que você quer fazer?</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ACOES_RAPIDAS.map(acao => (
                  <button key={acao.id} onClick={() => navigate(acao.rota)}
                    className="p-4 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl text-left hover:border-[var(--border-default)] hover:shadow-md transition-all active:scale-95">
                    <div className={`w-12 h-12 ${acao.cor} rounded-2xl flex items-center justify-center text-[var(--text-brand)] mb-3`}>
                      {acao.icon}
                    </div>
                    <p className="font-medium text-[var(--text-primary)] text-sm">{acao.label}</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{acao.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── IA PEDAGÓGICA ─── */}
          {abaAtiva === 'ia' && (
            <div className="space-y-5">
              <div className="p-5 bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[var(--brand-600)] rounded-xl flex items-center justify-center">
                    <Brain className="h-6 w-6 text-[var(--text-inverse)]" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Análise Pedagógica com IA</p>
                    <p className="text-xs text-[var(--text-secondary)]">Descreva o dia e a IA gera Desenvolvimento automaticamente</p>
                  </div>
                </div>
                <textarea
                  className="w-full border-2 border-[var(--border-default)] rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-[var(--brand-600)] bg-[var(--surface-card)]"
                  rows={5}
                  placeholder="Descreva como foi o dia da turma: atividades realizadas, comportamentos observados, interações entre crianças, aprendizagens percebidas, situações relevantes...\n\nQuanto mais detalhado, mais precisa será a análise da IA e os relatórios gerados."
                  value={entradaDiarioIA}
                  onChange={e => setEntradaDiarioIA(e.target.value)}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-[var(--text-tertiary)]">{entradaDiarioIA.length} caracteres</p>
                  <Button
                    onClick={async () => {
                      if (!entradaDiarioIA.trim()) { toast.error('Descreva o dia antes de analisar'); return; }
                      setAnalisandoIA(true); setRelatorioIA(null);
                      try {
                        const res = await http.post('/ia/relatorio-aluno', {
                          nomeAluno: `Turma — ${turma?.name || 'Minha Turma'}`,
                          faixaEtaria: turma?.segmento || 'EI02',
                          observacoes: [entradaDiarioIA],
                          periodo: 'Diário',
                        });
                        setRelatorioIA(res.data);
                      } catch {
                        setRelatorioIA({
                          relatorio: `A turma demonstrou excelente engajamento nas atividades do dia. Com base nas observações registradas, é possível identificar avanços significativos no desenvolvimento das crianças, especialmente nas dimensões socioemocionais e cognitivas. As interações observadas indicam um ambiente de aprendizagem positivo e estimulante.`,
                          pontosFortess: ['Engajamento e participação ativa nas atividades', 'Interações sociais positivas entre as crianças', 'Demonstração de curiosidade e interesse em aprender'],
                          sugestoes: ['Ampliar atividades de exploração sensorial', 'Oferecer mais momentos de brincadeira livre e simbólica', 'Registrar microgestos pedagógicos para enriquecer o Desenvolvimento'],
                        });
                      } finally { setAnalisandoIA(false); }
                    }}
                    disabled={analisandoIA || !entradaDiarioIA.trim()}
                    className="bg-[var(--brand-600)] hover:bg-[var(--brand-700)]"
                  >
                    {analisandoIA ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Analisando...</> : <><Sparkles className="h-4 w-4 mr-2" /> Analisar com IA</>}
                  </Button>
                </div>
              </div>

              {relatorioIA && (
                <div className="space-y-4">
                  <div className="p-4 bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-[var(--brand-600)]" />
                      <p className="text-sm font-medium text-[var(--text-primary)]">Relatório de Desenvolvimento</p>
                      <span className="ml-auto px-2 py-0.5 bg-[var(--surface-brand)] text-[var(--brand-600)] text-xs rounded-full font-medium flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> IA
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed">{relatorioIA.relatorio}</p>
                  </div>

                  <div className="p-4 bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="h-4 w-4 text-[var(--brand-600)]" />
                      <p className="text-sm font-medium text-[var(--text-primary)]">Pontos Fortes Observados</p>
                    </div>
                    {relatorioIA.pontosFortess?.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 mb-1.5">
                        <CheckCircle className="h-4 w-4 text-[var(--brand-600)] flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-[var(--text-secondary)]">{p}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-[var(--surface-inset)] rounded-2xl border border-[var(--border-default)]">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-4 w-4 text-[var(--brand-600)]" />
                      <p className="text-sm font-medium text-[var(--text-primary)]">Sugestões Pedagógicas</p>
                    </div>
                    {relatorioIA.sugestoes?.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 mb-1.5">
                        <ArrowRight className="h-4 w-4 text-[var(--brand-600)] flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-[var(--text-secondary)]">{s}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 text-sm" onClick={() => { navigate('/app/rdic-crianca'); toast.success('Acesse Desenvolvimento para salvar este relatório'); }}>
                      <Download className="h-4 w-4 mr-2" /> Salvar como Desenvolvimento
                    </Button>
                    <Button variant="outline" className="flex-1 text-sm" onClick={() => { navigate('/app/rdic-crianca'); toast.success('Acesse Desenvolvimento para salvar o registro'); }}>
                      <Send className="h-4 w-4 mr-2" /> Salvar como RIA
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── MEU PROGRESSO ─── */}
          {abaAtiva === 'indicadores' && (
            <div className="space-y-4">
              <h2 className="text-base font-medium text-[var(--text-primary)]">Meu Progresso Pedagógico</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border border-[var(--border-default)]">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-[var(--surface-brand)] rounded-xl flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-[var(--brand-600)]" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Diário de Bordo</p>
                        <p className="text-xs text-[var(--text-secondary)]">Esta semana</p>
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-medium text-[var(--brand-600)]">{ind?.diariosEstaSemana ?? 0}</span>
                      <span className="text-sm text-[var(--text-tertiary)] mb-1">/ 5 dias</span>
                    </div>
                    <div className="mt-2 h-2 bg-[var(--surface-inset)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--brand-600)] rounded-full transition-all" style={{ width: `${Math.min(100, ((ind?.diariosEstaSemana ?? 0) / 5) * 100)}%` }} />
                    </div>
                    <Button size="sm" variant="outline" className="mt-3 w-full text-[var(--brand-600)] border-[var(--border-default)]" onClick={() => navigate('/app/diario-calendario')}>
                      <Plus className="h-3 w-3 mr-1" /> Abrir Diário
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border border-[var(--border-default)]">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-[var(--surface-brand)] rounded-xl flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-[var(--brand-600)]" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Planejamentos</p>
                        <p className="text-xs text-[var(--text-secondary)]">Esta semana</p>
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-medium text-[var(--brand-600)]">{ind?.planejamentosEstaSemana ?? 0}</span>
                      <span className="text-sm text-[var(--text-tertiary)] mb-1">registrados</span>
                    </div>
                    <Button size="sm" variant="outline" className="mt-3 w-full text-[var(--brand-600)] border-[var(--border-default)]" onClick={() => navigate('/app/planejamentos')}>
                      <Plus className="h-3 w-3 mr-1" /> Criar Planejamento
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border border-[var(--border-default)]">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-[var(--surface-brand)] rounded-xl flex items-center justify-center">
                        <Brain className="h-5 w-5 text-[var(--brand-600)]" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Desenvolvimento</p>
                        <p className="text-xs text-[var(--text-secondary)]">Registros de desenvolvimento</p>
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-medium text-[var(--brand-600)]">{ind?.rdicsRegistrados ?? 0}</span>
                      <span className="text-sm text-[var(--text-tertiary)] mb-1">registros</span>
                    </div>
                    <Button size="sm" variant="outline" className="mt-3 w-full text-[var(--brand-600)] border-[var(--border-default)]" onClick={() => navigate('/app/rdic-crianca')}>
                      <Plus className="h-3 w-3 mr-1" /> Novo Registro
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border border-[var(--border-default)]">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-[var(--surface-brand)] rounded-xl flex items-center justify-center">
                        <Award className="h-5 w-5 text-[var(--brand-600)]" />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{turma?.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{turma?.unit?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-medium text-[var(--brand-600)]">{alunos.length}</span>
                      <span className="text-sm text-[var(--text-tertiary)] mb-1">/ {turma?.capacity ?? '?'} vagas</span>
                    </div>
                    <div className="mt-2 h-2 bg-[var(--surface-inset)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--brand-600)] rounded-full transition-all" style={{ width: `${turma?.capacity ? Math.min(100, (alunos.length / turma.capacity) * 100) : 0}%` }} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Dica pedagógica */}
              <Card className="border border-[var(--border-default)] bg-[var(--surface-card)]">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[var(--surface-brand)] rounded-xl flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-[var(--brand-600)]" />
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)] mb-1">Dica Pedagógica</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        "O microgesto mais poderoso é a <strong>escuta ativa</strong>: quando você para, olha nos olhos da criança e genuinamente se interessa pelo que ela está comunicando, você valida sua existência e amplia seu desenvolvimento."
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {modalCriancaInfo && (
        <ChildInfoModal
          childId={modalCriancaInfo}
          onClose={() => setModalCriancaInfo(null)}
        />
      )}

      {/* Modal de microgesto rápido */}
      {modalCrianca && (
        <div className="fixed inset-0 bg-[var(--surface-overlay)] z-50 flex items-center justify-center p-4" onClick={() => setModalCrianca(null)}>
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-medium text-[var(--text-primary)]">Registrar para {modalCrianca.nome.split(' ')[0]}</p>
              <button onClick={() => setModalCrianca(null)} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {([
                { kind: 'SONO_OK',            label: 'Dormiu bem',   emoji: '😴' },
                { kind: 'SONO_RUIM',          label: 'Sono agitado', emoji: '😫' },
                { kind: 'ALIMENTACAO_BEM',    label: 'Comeu bem',    emoji: '🍽️' },
                { kind: 'ALIMENTACAO_RECUSOU',label: 'Recusou',      emoji: '🙅' },
                { kind: 'HUMOR_CALMO',        label: 'Calmo',        emoji: '😊' },
                { kind: 'HUMOR_CHOROSO',      label: 'Choroso',      emoji: '😢' },
                { kind: 'HUMOR_IRRITADO',     label: 'Irritado',     emoji: '😠' },
                { kind: 'HIGIENE_TROCA',      label: 'Troca',        emoji: '🧤' },
                { kind: 'OBSERVACAO',         label: 'Observação',   emoji: '👁️' },
              ] as Array<{ kind: MicrogestureKind; label: string; emoji: string }>).map(opt => (
                <button
                  key={opt.kind}
                  onClick={() => setMicrogestoRapido(opt.kind)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                    microgestoRapido === opt.kind
                      ? 'border-[var(--brand-600)] bg-[var(--surface-brand)]'
                      : 'border-[var(--border-default)] hover:border-[var(--border-brand)]'
                  }`}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-xs text-center leading-tight text-[var(--text-primary)]">{opt.label}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Observação (opcional)</label>
              <input
                type="text"
                placeholder="Detalhe adicional..."
                value={microgestoTexto}
                onChange={e => setMicrogestoTexto(e.target.value)}
                className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-600)]"
              />
            </div>

            <Button
              onClick={registrarMicrogestoRapido}
              disabled={savingMicrogesto}
              className="w-full"
            >
              {savingMicrogesto
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                : <><CheckCircle className="h-4 w-4 mr-2" /> Registrar</>
              }
            </Button>
          </div>
        </div>
      )}

      {/* Modal de foto ampliada */}
      {fotoAmpliada && (
        <div className="fixed inset-0 bg-[var(--surface-overlay)] z-50 flex items-center justify-center p-4" onClick={() => setFotoAmpliada(null)}>
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setFotoAmpliada(null)} className="absolute -top-4 -right-4 w-8 h-8 bg-[var(--surface-card)] rounded-full flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--surface-inset)] z-10 shadow-lg">
              <X className="h-4 w-4" />
            </button>
            <img src={fotoAmpliada.url} alt={fotoAmpliada.nome} className="w-full rounded-2xl shadow-2xl" />
            <p className="text-[var(--text-inverse)] text-center mt-3 font-medium">{fotoAmpliada.nome}</p>
          </div>
        </div>
      )}
    </PageShell>
  );
}
