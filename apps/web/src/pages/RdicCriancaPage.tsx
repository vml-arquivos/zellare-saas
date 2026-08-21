/**
 * RdicCriancaPage.tsx
 * Tela dedicada de Desenvolvimento por criança para o professor.
 *
 * Fluxo:
 * 1. Professor seleciona a turma (carregada automaticamente via /teachers/dashboard)
 * 2. Professor seleciona a criança da turma
 * 3. Preenche o formulário Desenvolvimento com os 5 Campos de Experiência da BNCC
 * 4. Pode gerar um rascunho automático via Motor de IA LGPD (dados anonimizados)
 * 5. Salva o Desenvolvimento no banco
 */
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { hasRole, isProfessor as checkIsProfessor } from '../api/auth';
import { useAutoSave } from '../hooks/useAutoSave';
import { PageShell } from '../components/ui/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ChildAvatar } from '../components/children/ChildAvatar';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { toast } from 'sonner';
import http from '../api/http';
import {
  Brain, Sparkles, User, Users, ChevronLeft, ChevronRight,
  Save, RefreshCw, CheckCircle, AlertCircle, Star,
  BookOpen, Heart, Music, Palette, Calculator, MessageSquare,
  ArrowLeft, FileText, Eye, EyeOff, Send, Plus, Printer,
} from 'lucide-react';
// ─── Tipos ────────────────────────────────────────────────────────────────────────────────
interface Aluno {
  id: string;
  nome: string;
  firstName: string;
  lastName: string;
  idade: number;
  dateOfBirth?: string | null;
  gender: string;
  photoUrl?: string;
}

// FIX: calcular idade real a partir de dateOfBirth
function calcularIdade(dateOfBirth?: string | null): number {
  if (!dateOfBirth) return 0;
  const nasc = new Date(dateOfBirth);
  if (isNaN(nasc.getTime())) return 0;
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return Math.max(0, anos);
}

interface Turma {
  id: string;
  name: string;
  code: string;
  segmento?: string;
  unit: { name: string };
}

interface IndicadorAvaliacao {
  codigo: string;
  descricao: string;
  nivel: 'NAO_OBSERVADO' | 'EM_DESENVOLVIMENTO' | 'CONSOLIDADO' | 'AMPLIADO';
}

interface DimensaoAvaliacao {
  dimensao: string;
  indicadores: IndicadorAvaliacao[];
}

interface EvidenciasResumo {
  diarios: number;
  observacoes: number;
  microgestos: number;
  diasComRegistro: number;
  pontosAtencao: number;
}

interface RdicSalvo {
  id: string;
  childId: string;
  child?: { firstName: string; lastName: string };
  periodo: string;
  periodoEnum?: string | null;
  anoLetivo: number;
  status: 'RASCUNHO' | 'EM_REVISAO' | 'DEVOLVIDO' | 'APROVADO' | 'FINALIZADO' | 'PUBLICADO' | string;
  rascunhoJson?: {
    trimestre?: number;
    dimensoes?: DimensaoAvaliacao[];
    diagnosticoExpress?: DiagnosticoExpress | null;
    observacaoGeral?: string;
    proximosPassos?: string;
  } | null;
  reviewComment?: string;
  criadoEm: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
}

interface RelatorioIAConsolidado {
  reportId?: string;
  status?: string;
  relatorio: string;
  pontosFortess: string[];
  sugestoes: string[];
  anonimizado: boolean;
  totalObservacoes: number;
  codigoAnonimizado: string;
  periodoInicio?: string;
  periodoFim?: string;
  fontes?: Record<string, number>;
  requerRevisaoHumana?: boolean;
}

interface DiagnosticoExpress {
  child: { id: string; firstName: string; lastName: string };
  classroom: { id: string; name: string } | null;
  periodo: { startDate: string; endDate: string };
  fontes: {
    diariosPublicados: number;
    observacoesDesenvolvimento: number;
    diasComRegistro: number;
    microgestos: number;
  };
  porNivel: Record<string, number>;
  porCategoria: Record<string, number>;
  habilidades: Array<{
    microgestoId: string;
    label: string;
    categoria: string;
    nivel: string;
    ocorrencias: number;
  }>;
  tendencia: 'SEM_DADOS' | 'ATENCAO' | 'FAVORAVEL' | 'EM_DESENVOLVIMENTO' | string;
  pontosAtencao: string[];
  proximosPassos: string[];
}

function gerarObservacaoExpress(diagnostico: DiagnosticoExpress | null): string {
  if (!diagnostico) return '';
  const { fontes, tendencia, pontosAtencao } = diagnostico;
  const tendenciaLabel: Record<string, string> = {
    SEM_DADOS: 'ainda sem registros suficientes para uma leitura do período',
    ATENCAO: 'pontos que pedem acompanhamento pedagógico próximo',
    FAVORAVEL: 'evidências predominantemente favoráveis',
    EM_DESENVOLVIMENTO: 'habilidades em desenvolvimento e em acompanhamento',
  };
  const destaque = pontosAtencao.length > 0
    ? ` Pontos para acompanhar: ${pontosAtencao.slice(0, 3).join('; ')}.`
    : '';
  return `Registro estruturado do período: ${fontes.microgestos} marcações de desenvolvimento em ${fontes.diasComRegistro} dia(s), com ${fontes.diariosPublicados} diário(s) publicado(s) e ${fontes.observacoesDesenvolvimento} observação(ões) de desenvolvimento. A leitura indica ${tendenciaLabel[tendencia] ?? 'uma trajetória em acompanhamento'}.${destaque}`;
}

// ─── Dimensões BNCC (5 Campos de Experiência) ─────────────────────────────────
const DIMENSOES_BNCC = [
  {
    id: 'eu-outro-nos',
    label: 'O eu, o outro e o nós',
    descricao: 'Identidade, autonomia, relações sociais e afetivas',
    icon: Heart,
    cor: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800', badge: 'bg-pink-100 text-pink-700', btn: 'bg-pink-600 hover:bg-pink-700' },
    indicadores: [
      { codigo: 'EO01', descricao: 'Demonstra interesse em interagir com outras crianças e adultos' },
      { codigo: 'EO02', descricao: 'Expressa necessidades, desejos e emoções de forma verbal ou não verbal' },
      { codigo: 'EO03', descricao: 'Participa de brincadeiras coletivas e situações de cuidado' },
      { codigo: 'EO04', descricao: 'Demonstra empatia e respeito nas relações com os outros' },
      { codigo: 'EO05', descricao: 'Reconhece e respeita diferenças entre as pessoas' },
    ],
  },
  {
    id: 'corpo-gestos',
    label: 'Corpo, gestos e movimentos',
    descricao: 'Desenvolvimento motor, expressão corporal e coordenação',
    icon: Users,
    cor: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-700', btn: 'bg-orange-600 hover:bg-orange-700' },
    indicadores: [
      { codigo: 'CG01', descricao: 'Explora e controla movimentos corporais amplos e finos' },
      { codigo: 'CG02', descricao: 'Utiliza o corpo para expressar emoções e comunicar-se' },
      { codigo: 'CG03', descricao: 'Demonstra equilíbrio, coordenação e lateralidade' },
      { codigo: 'CG04', descricao: 'Participa de brincadeiras que envolvem movimento e expressão corporal' },
      { codigo: 'CG05', descricao: 'Demonstra autonomia nos cuidados pessoais (higiene, alimentação)' },
    ],
  },
  {
    id: 'tracos-sons',
    label: 'Traços, sons, cores e formas',
    descricao: 'Expressão artística, criatividade e apreciação estética',
    icon: Palette,
    cor: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700' },
    indicadores: [
      { codigo: 'TS01', descricao: 'Explora diferentes materiais plásticos e sonoros' },
      { codigo: 'TS02', descricao: 'Produz trabalhos artísticos com intencionalidade expressiva' },
      { codigo: 'TS03', descricao: 'Aprecia e comenta produções artísticas próprias e dos colegas' },
      { codigo: 'TS04', descricao: 'Demonstra criatividade e imaginação nas produções' },
      { codigo: 'TS05', descricao: 'Identifica e nomeia cores, formas e texturas no ambiente' },
    ],
  },
  {
    id: 'escuta-fala',
    label: 'Escuta, fala, pensamento e imaginação',
    descricao: 'Linguagem oral e escrita, narrativa e letramento emergente',
    icon: MessageSquare,
    cor: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700', btn: 'bg-blue-600 hover:bg-blue-700' },
    indicadores: [
      { codigo: 'EF01', descricao: 'Demonstra interesse por histórias, livros e situações de leitura' },
      { codigo: 'EF02', descricao: 'Comunica-se oralmente com clareza e amplia o vocabulário' },
      { codigo: 'EF03', descricao: 'Reconhece letras, palavras e inicia a escrita espontânea' },
      { codigo: 'EF04', descricao: 'Reconta histórias e cria narrativas com coerência' },
      { codigo: 'EF05', descricao: 'Participa ativamente de rodas de conversa e situações de escuta' },
    ],
  },
  {
    id: 'espacos-tempos',
    label: 'Espaços, tempos, quantidades, relações e transformações',
    descricao: 'Raciocínio lógico-matemático, ciências e exploração do mundo',
    icon: Calculator,
    cor: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100 text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
    indicadores: [
      { codigo: 'ET01', descricao: 'Explora e descreve características do ambiente natural e social' },
      { codigo: 'ET02', descricao: 'Estabelece relações de comparação, classificação e seriação' },
      { codigo: 'ET03', descricao: 'Compreende noções de número, quantidade e medida' },
      { codigo: 'ET04', descricao: 'Resolve situações-problema com autonomia e criatividade' },
      { codigo: 'ET05', descricao: 'Demonstra curiosidade e interesse por fenômenos naturais' },
    ],
  },
];

const NIVEIS: Array<{ id: IndicadorAvaliacao['nivel']; label: string; short: string; cor: string; corBg: string }> = [
  { id: 'NAO_OBSERVADO', label: 'Não Observado', short: 'NO', cor: 'text-gray-500', corBg: 'bg-gray-100 border-gray-300 text-gray-600' },
  { id: 'EM_DESENVOLVIMENTO', label: 'Em Desenvolvimento', short: 'ED', cor: 'text-yellow-600', corBg: 'bg-yellow-100 border-yellow-300 text-yellow-700' },
  { id: 'CONSOLIDADO', label: 'Consolidado', short: 'C', cor: 'text-green-600', corBg: 'bg-green-100 border-green-300 text-green-700' },
  { id: 'AMPLIADO', label: 'Ampliado', short: 'A', cor: 'text-blue-600', corBg: 'bg-blue-100 border-blue-300 text-blue-700' },
];

/** SEDF 2026 — Calendário Trimestral */
const TRIMESTRES = [
  { id: 1, label: '1º Trimestre', periodo: 'Fev–Mai 2026', valor: 'PRIMEIRO_TRIMESTRE'  },
  { id: 2, label: '2º Trimestre', periodo: 'Jun–Set 2026', valor: 'SEGUNDO_TRIMESTRE'   },
  { id: 3, label: '3º Trimestre', periodo: 'Out–Dez 2026', valor: 'TERCEIRO_TRIMESTRE'  },
] as const;
type TrimestreId = (typeof TRIMESTRES)[number]['id'];

function periodoDoTrimestre(trimestreId: TrimestreId) {
  const ano = new Date().getFullYear();
  const periodos: Record<TrimestreId, { start: string; end: string }> = {
    1: { start: `${ano}-02-01`, end: `${ano}-05-31` },
    2: { start: `${ano}-06-01`, end: `${ano}-09-30` },
    3: { start: `${ano}-10-01`, end: `${ano}-12-31` },
  };
  return periodos[trimestreId];
}

// ─── Kanban: status e agrupamento ───────────────────────────────────────────
const RDIC_STATUS = {
  PENDING:     'PENDING',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  CONCLUIDO:   'CONCLUIDO',
} as const

const KANBAN_TABS = [
  {
    key:         RDIC_STATUS.PENDING,
    label:       'Pendentes',
    description: 'Sem Desenvolvimento iniciado neste trimestre',
    color:       'text-red-600 border-red-400',
    badge:       'bg-red-100 text-red-700',
  },
  {
    key:         RDIC_STATUS.EM_ANDAMENTO,
    label:       'Em Andamento',
    description: 'Desenvolvimento em rascunho ou devolvido para correção',
    color:       'text-yellow-600 border-yellow-400',
    badge:       'bg-yellow-100 text-yellow-700',
  },
  {
    key:         RDIC_STATUS.CONCLUIDO,
    label:       'Concluídos',
    description: 'Desenvolvimento enviado para revisão, aprovado ou publicado',
    color:       'text-green-600 border-green-400',
    badge:       'bg-green-100 text-green-700',
  },
]

function resolveRdicStatus(rdics: RdicSalvo[], trimestreAtual: number): string {
  try {
    const ano = new Date().getFullYear();
    const trimestreLabel = `${trimestreAtual}º Trimestre`;
    const rdic = rdics?.find(
      r => r?.anoLetivo === ano && (r?.periodo ?? '').includes(trimestreLabel)
    ) ?? null;
    if (!rdic) return RDIC_STATUS.PENDING;
    const s = rdic?.status ?? '';
    if (s === 'RASCUNHO' || s === 'DEVOLVIDO') return RDIC_STATUS.EM_ANDAMENTO;
    if (['EM_REVISAO', 'APROVADO', 'FINALIZADO', 'PUBLICADO'].includes(s)) return RDIC_STATUS.CONCLUIDO;
    return RDIC_STATUS.PENDING;
  } catch {
    return RDIC_STATUS.PENDING;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function criarDimensoesVazias(): DimensaoAvaliacao[] {
  return DIMENSOES_BNCC.map(d => ({
    dimensao: d.id,
    indicadores: d.indicadores.map(ind => ({
      codigo: ind.codigo,
      descricao: ind.descricao,
      nivel: 'NAO_OBSERVADO' as const,
    })),
  }));
}

function calcularProgresso(dimensoes: DimensaoAvaliacao[]): { total: number; preenchidos: number; pct: number } {
  const total = dimensoes.reduce((s, d) => s + d.indicadores.length, 0);
  const preenchidos = dimensoes.reduce(
    (s, d) => s + d.indicadores.filter(i => i.nivel !== 'NAO_OBSERVADO').length,
    0,
  );
  return { total, preenchidos, pct: total > 0 ? Math.round((preenchidos / total) * 100) : 0 };
}

// ─── Paleta de avatares por inicial ──────────────────────────────────────────
const AVATAR_PALETTE: Record<string, string> = {
  A:'from-rose-400 to-pink-500', B:'from-orange-400 to-amber-500',
  C:'from-yellow-400 to-orange-400', D:'from-lime-400 to-green-500',
  E:'from-emerald-400 to-teal-500', F:'from-cyan-400 to-sky-500',
  G:'from-blue-400 to-indigo-500', H:'from-violet-400 to-purple-500',
  I:'from-fuchsia-400 to-pink-500', J:'from-rose-400 to-red-500',
  K:'from-amber-400 to-yellow-500', L:'from-teal-400 to-cyan-500',
  M:'from-indigo-400 to-blue-500', N:'from-purple-400 to-violet-500',
  O:'from-pink-400 to-rose-500', P:'from-sky-400 to-blue-500',
  Q:'from-green-400 to-emerald-500', R:'from-orange-400 to-red-500',
  S:'from-cyan-400 to-teal-500', T:'from-violet-400 to-indigo-500',
  U:'from-amber-400 to-orange-500', V:'from-lime-400 to-teal-500',
  W:'from-blue-400 to-cyan-500', X:'from-fuchsia-400 to-violet-500',
  Y:'from-yellow-400 to-lime-500', Z:'from-rose-400 to-fuchsia-500',
};
function getAvatarGradient(nome?: string | null): string {
  const inicial = nome?.trim().charAt(0).toUpperCase() || 'A';
  return AVATAR_PALETTE[inicial] ?? 'from-indigo-400 to-purple-500';
}

// ─── Componente de Card de Criança ────────────────────────────────────────────
function CardCrianca({
  aluno,
  selecionado,
  onClick,
  rdicsCount,
  evidencias,
}: {
  aluno: Aluno;
  selecionado: boolean;
  onClick: () => void;
  rdicsCount: number;
  evidencias?: EvidenciasResumo;
}) {
  const iniciais = `${aluno.firstName?.trim().charAt(0) ?? ''}${aluno.lastName?.trim().charAt(0) ?? ''}`.toUpperCase() || '—';
  const gradient = getAvatarGradient(aluno.firstName);
  const genero = aluno.gender === 'FEMININO' ? 'Menina' : aluno.gender === 'MASCULINO' ? 'Menino' : '';
  const generoIcon = aluno.gender === 'FEMININO' ? '♀' : aluno.gender === 'MASCULINO' ? '♂' : '';
  const generoColor = aluno.gender === 'FEMININO' ? 'text-pink-400' : 'text-blue-400';

  return (
    <button
      onClick={onClick}
      className={`group w-full text-left rounded-2xl border-2 overflow-hidden transition-all duration-150 ${
        selecionado
          ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
          : 'border-gray-100 bg-white hover:border-blue-300 hover:shadow-md'
      }`}
    >
      {/* Faixa de cor no topo */}
      <div className={`h-1 w-full bg-gradient-to-r ${selecionado ? 'from-blue-500 to-blue-400' : gradient}`} />

      <div className="flex items-center gap-3 p-3">
        {/* Avatar */}
        <div className={`w-11 h-11 rounded-full flex-shrink-0 overflow-hidden ring-2 transition-all ${
          selecionado ? 'ring-blue-300' : 'ring-white group-hover:ring-blue-100'
        }`}>
          {aluno.photoUrl ? (
            <img src={aluno.photoUrl} alt={aluno.firstName} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${
              selecionado ? 'from-blue-500 to-blue-600' : gradient
            } text-white font-bold text-sm`}>
              {iniciais}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm leading-tight truncate ${selecionado ? 'text-blue-900' : 'text-gray-800'}`}>
            {aluno.firstName} {aluno.lastName}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {aluno.idade} meses
            {genero && (
              <span className={`ml-1.5 font-medium ${generoColor}`}>
                {generoIcon} {genero}
              </span>
            )}
          </p>
        </div>

        {/* Status do documento oficial RDIC + evidências naturais do Diário */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className={`text-[11px] px-2 py-1 rounded-lg font-semibold border ${
            rdicsCount > 0
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-gray-50 text-gray-400 border-gray-200'
          }`}>
            {rdicsCount > 0 ? `✓ ${rdicsCount} RDIC` : 'RDIC pendente'}
          </div>
          {evidencias && (evidencias.diarios + evidencias.observacoes) > 0 && (
            <div className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {evidencias.diarios + evidencias.observacoes} evidências do Diário
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Componente de Indicador ──────────────────────────────────────────────────
function IndicadorRow({
  indicador,
  onChange,
}: {
  indicador: IndicadorAvaliacao;
  onChange: (nivel: IndicadorAvaliacao['nivel']) => void;
}) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span className="text-xs font-mono text-gray-400 mr-2">{indicador.codigo}</span>
          <span className="text-sm text-gray-700">{indicador.descricao}</span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {NIVEIS.map(nivel => (
            <button
              key={nivel.id}
              onClick={() => onChange(nivel.id)}
              title={nivel.label}
              className={`w-8 h-8 rounded-lg text-xs font-bold border-2 transition-all ${
                indicador.nivel === nivel.id
                  ? `${nivel.corBg} border-current scale-110 shadow-sm`
                  : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
              }`}
            >
              {nivel.short}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function RdicCriancaPage() {
  const { user } = useAuth() as any;
  const [searchParams] = useSearchParams();
  const preselectedChildId = searchParams.get('childId');
  const preselectedClassroomId = searchParams.get('classroomId');
  // Perfil: PROFESSOR usa /teachers/dashboard; UNIDADE/outros usam lookup
  const isPrivilegedScope = ['DEVELOPER', 'MANTENEDORA', 'STAFF_CENTRAL', 'UNIDADE'].some((role) => hasRole(user, role));
  // Contas privilegiadas podem também carregar PROFESSOR no token, mas devem
  // enxergar o escopo administrativo de unidades, não o dashboard de professor.
  const isProf = checkIsProfessor(user) && !isPrivilegedScope;
  const [loading, setLoading] = useState(true);
  const [turma, setTurma] = useState<Turma | null>(null);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null);
  const [rdicsDoAluno, setRdicsDoAluno] = useState<RdicSalvo[]>([]);
  const [loadingRdics, setLoadingRdics] = useState(false);

  // Formulário Desenvolvimento
  /** SEDF 2026: 1ºT Fev–Mai(2-5), 2ºT Jun–Set(6-9), 3ºT Out–Dez(10-12) */
  const calcularTrimestreAtual = (): TrimestreId => {
    const mes = new Date().getMonth() + 1;
    if (mes >= 2 && mes <= 5) return 1;
    if (mes >= 6 && mes <= 9) return 2;
    return 3;
  };
  const [trimestre, setTrimestre] = useState<TrimestreId>(calcularTrimestreAtual);
  // Tarefa 2.3 — recarregar evidências ao mudar trimestre
  const handleSetTrimestre = (t: TrimestreId) => {
    setTrimestre(t);
    if (alunoSelecionado) {
      carregarEvidencias(alunoSelecionado.id, t);
      carregarDiagnosticoExpress(alunoSelecionado.id, t);
    }
    if (turma?.id) void carregarResumoExpressTurma(turma.id, t);
  };
  const [dimensoes, setDimensoes] = useState<DimensaoAvaliacao[]>(criarDimensoesVazias());
  const [observacaoGeral, setObservacaoGeral] = useState('');
  const [proximosPassos, setProximosPassos] = useState('');
    const [saving, setSaving] = useState(false);

  // IA LGPD
  const [gerandoIA, setGerandoIA] = useState(false);
  const [relatorioIA, setRelatorioIA] = useState<RelatorioIAConsolidado | null>(null);
  const [mostrarRelatorioIA, setMostrarRelatorioIA] = useState(false);

  // Navegação — declarado ANTES do useAutoSave para evitar TDZ no bundle de produção
  const [etapa, setEtapa] = useState<'selecionar' | 'formulario' | 'historico'>('selecionar');

  // ─── Auto-save no localStorage ───────────────────────────────────────────────────────────────────────
  const rdicAutoSaveKey = alunoSelecionado
    ? `rdic-rascunho-${user?.id ?? 'anon'}-${alunoSelecionado.id}-t${trimestre}`
    : null;
  const rdicAutoSaveData = { dimensoes, observacaoGeral, proximosPassos, trimestre };
  const { hasDraft: rdicHasDraft, clearDraft: rdicClearDraft, lastSaved: rdicLastSaved } = useAutoSave({
    key: rdicAutoSaveKey ?? 'rdic-noop',
    data: rdicAutoSaveData,
    enabled: !!alunoSelecionado && etapa === 'formulario',
    onRestore: (saved) => {
      if (saved.dimensoes && Array.isArray(saved.dimensoes)) setDimensoes(saved.dimensoes);
      if (typeof saved.observacaoGeral === 'string') setObservacaoGeral(saved.observacaoGeral);
      if (typeof saved.proximosPassos === 'string') setProximosPassos(saved.proximosPassos);
      toast.info('Rascunho do Desenvolvimento recuperado automaticamente.');
    },
  });
  const [dimensaoAberta, setDimensaoAberta] = useState<string | null>('eu-outro-nos');
  // Kanban
  const [kanbanTab, setKanbanTab] = useState<string>(RDIC_STATUS.PENDING);
  const [rdicsMap, setRdicsMap] = useState<Record<string, RdicSalvo[]>>({});
  const [evidenciasMap, setEvidenciasMap] = useState<Record<string, EvidenciasResumo>>({});
  const [loadingEvidenciasTurma, setLoadingEvidenciasTurma] = useState(false);

  // Tarefa 2.3 — Evidências do diário no período
  const [evidencias, setEvidencias] = useState<{ tipo: string; count: number; label: string; cor: string }[]>([]);
  const [loadingEvidencias, setLoadingEvidencias] = useState(false);
  const [diagnosticoExpress, setDiagnosticoExpress] = useState<DiagnosticoExpress | null>(null);
  const [loadingDiagnosticoExpress, setLoadingDiagnosticoExpress] = useState(false);
  const [evidenciasExpanded, setEvidenciasExpanded] = useState(true);

  // ─── Carregar turma e alunos ──────────────────────────────────────────────
  useEffect(() => {
    carregarTurma();
  }, []);

  async function carregarTurma() {
    try {
      setLoading(true);
      if (isProf) {
        // ── Fluxo PROFESSOR: usa /teachers/dashboard ──
        const res = await http.get('/teachers/dashboard');
        if (res.data?.hasClassroom) {
          setTurma(res.data.classroom);
          void carregarResumoExpressTurma(res.data.classroom.id, trimestre);
          const lista: Aluno[] = res.data.alunos ?? [];
          setAlunos(lista);
          carregarRdicsMapParaTurma(lista, res.data?.classroom?.id);
          if (preselectedChildId) {
            const aluno = lista.find(a => a.id === preselectedChildId);
            if (aluno) {
              setAlunoSelecionado(aluno);
              setEtapa('formulario');
              void carregarEvidencias(aluno.id, trimestre);
              void carregarDiagnosticoExpress(aluno.id, trimestre);
              const rdicsRes = await http.get('/rdic', { params: { childId: aluno.id } }).catch(() => ({ data: [] }));
              setRdicsDoAluno(Array.isArray(rdicsRes.data) ? rdicsRes.data : rdicsRes.data?.data ?? []);
            }
          }
        }
      } else {
        // ── Fluxo UNIDADE/STAFF_CENTRAL/outros: usa lookup ──
        let unitId = (user as any)?.unitId as string | undefined;
        let classRes = await http.get('/lookup/classrooms/accessible', {
          params: unitId ? { unitId } : {},
        });
        let turmasList: { id: string; name: string; code?: string; unitId?: string }[] = Array.isArray(classRes.data)
          ? classRes.data
          : classRes.data?.data ?? [];

        // DEVELOPER/MANTENEDORA/STAFF_CENTRAL podem não possuir unitId no token.
        // Nesses casos, resolve a primeira unidade real do escopo e só então lista as turmas.
        if (turmasList.length === 0 && isPrivilegedScope) {
          const unitsRes = await http.get('/lookup/units/accessible');
          const units: Array<{ id: string }> = Array.isArray(unitsRes.data)
            ? unitsRes.data
            : unitsRes.data?.data ?? [];
          const rememberedUnitId = sessionStorage.getItem('zelare:selectedUnitId') ?? undefined;
          const selectedUnit = units.find((item) => item.id === unitId || item.id === rememberedUnitId) ?? units[0];
          unitId = selectedUnit?.id;
          if (unitId) {
            classRes = await http.get('/lookup/classrooms/accessible', { params: { unitId } });
            turmasList = Array.isArray(classRes.data)
              ? classRes.data
              : classRes.data?.data ?? [];
          }
        }
        if (turmasList.length === 0) return;
        // Usar classroomId da URL se disponível, senão a primeira turma
        const targetId = preselectedClassroomId ?? turmasList[0].id;
        const turmaInfo = turmasList.find(t => t.id === targetId) ?? turmasList[0];
        const resolvedUnitId = turmaInfo.unitId ?? unitId;
        const unitRes = await http.get(`/units/${resolvedUnitId}`).catch(() => ({ data: { name: '' } }));
        const turmaObj: Turma = {
          id: turmaInfo.id,
          name: turmaInfo.name,
          code: turmaInfo.code ?? '',
          unit: { name: unitRes.data?.name ?? '' },
        };
        setTurma(turmaObj);
        void carregarResumoExpressTurma(turmaObj.id, trimestre);
        const childrenRes = await http.get(`/lookup/classrooms/${turmaInfo.id}/children`);
        const lista: Aluno[] = (Array.isArray(childrenRes.data) ? childrenRes.data : childrenRes.data?.data ?? []).map((c: any) => ({
          id: c.id,
          nome: `${c.firstName} ${c.lastName}`,
          firstName: c.firstName,
          lastName: c.lastName,
          dateOfBirth: c.dateOfBirth ?? null,
          idade: calcularIdade(c.dateOfBirth),
          gender: c.gender ?? '',
          photoUrl: c.photoUrl ?? undefined,
        }));
        setAlunos(lista);
        carregarRdicsMapParaTurma(lista, turmaInfo.id);
        if (preselectedChildId) {
          const aluno = lista.find(a => a.id === preselectedChildId);
          if (aluno) {
            setAlunoSelecionado(aluno);
            setEtapa('formulario');
            const rdicsRes = await http.get('/rdic', { params: { childId: aluno.id } }).catch(() => ({ data: [] }));
            setRdicsDoAluno(Array.isArray(rdicsRes.data) ? rdicsRes.data : rdicsRes.data?.data ?? []);
          }
        }
      }
     } catch {
      toast.error('Não foi possível carregar a turma.');
    } finally {
      setLoading(false);
    }
  }
  // Carrega Relatórios de todos os alunos em paralelo para o Kanban
  async function carregarRdicsMapParaTurma(lista: Aluno[], classroomId?: string) {
    if (!lista || lista.length === 0) return;
    try {
      const resultados = await Promise.allSettled(
        lista.map(a =>
          http
            .get('/rdic', {
              params: {
                childId: a.id,
                ...(classroomId ? { classroomId } : {}),
              },
            })
            .catch(() => ({ data: [] }))
        )
      );
      const mapa: Record<string, RdicSalvo[]> = {};
      lista.forEach((a, i) => {
        const r = resultados[i];
        const raw = r.status === 'fulfilled' ? r.value?.data : [];
        mapa[a.id] = Array.isArray(raw) ? raw : raw?.data ?? [];
      });
      setRdicsMap(mapa);
    } catch {
      // silencioso — Kanban fica com todos pendentes
    }
  }
  async function carregarResumoExpressTurma(classroomId: string, trimestreId: TrimestreId) {
    const { start, end } = periodoDoTrimestre(trimestreId);
    setLoadingEvidenciasTurma(true);
    try {
      const res = await http.get('/rdic/turma/express-summary', {
        params: { classroomId, startDate: `${start}T00:00:00.000Z`, endDate: `${end}T23:59:59.999Z` },
      });
      const mapa: Record<string, EvidenciasResumo> = {};
      for (const item of (res.data?.criancas ?? [])) {
        mapa[item.childId] = {
          diarios: Number(item.diarios ?? 0),
          observacoes: Number(item.observacoes ?? 0),
          microgestos: Number(item.microgestos ?? 0),
          diasComRegistro: Number(item.diasComRegistro ?? 0),
          pontosAtencao: Number(item.pontosAtencao ?? 0),
        };
      }
      setEvidenciasMap(mapa);
    } catch {
      setEvidenciasMap({});
    } finally {
      setLoadingEvidenciasTurma(false);
    }
  }

  // Tarefa 2.3 — Carregar evidências do diário para o período do trimestre selecionado
  async function carregarDiagnosticoExpress(childId: string, trimestreId: TrimestreId) {
    const { start, end } = periodoDoTrimestre(trimestreId);
    setLoadingDiagnosticoExpress(true);
    try {
      const res = await http.get(`/rdic/child/${childId}/express-summary`, {
        params: { startDate: `${start}T00:00:00.000Z`, endDate: `${end}T23:59:59.999Z` },
      });
      setDiagnosticoExpress(res.data as DiagnosticoExpress);
    } catch {
      setDiagnosticoExpress(null);
    } finally {
      setLoadingDiagnosticoExpress(false);
    }
  }

  async function carregarEvidencias(childId: string, trimestreId: TrimestreId) {
    const { start, end } = periodoDoTrimestre(trimestreId);
    setLoadingEvidencias(true);
    try {
      const res = await http.get('/diary-events', { params: { childId, startDate: start, endDate: end, limit: '500' } });
      const data: any[] = Array.isArray(res?.data) ? res.data : (res?.data?.data ?? []);
      const LABELS: Record<string, string> = {
        ATIVIDADE_PEDAGOGICA: 'Atividades pedagógicas',
        DESENVOLVIMENTO: 'Desenvolvimento',
        COMPORTAMENTO: 'Comportamento social',
        SAUDE: 'Saúde',
        REFEICAO: 'Refeição',
        HIGIENE: 'Higiene',
        SONO: 'Sono',
        FAMILIA: 'Família',
        OBSERVACAO: 'Observações',
        AVALIACAO: 'Avaliações',
        OUTRO: 'Outros',
      };
      const CORES: Record<string, string> = {
        ATIVIDADE_PEDAGOGICA: 'bg-blue-100 text-blue-700 border-blue-200',
        DESENVOLVIMENTO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        COMPORTAMENTO: 'bg-amber-100 text-amber-700 border-amber-200',
        SAUDE: 'bg-red-100 text-red-700 border-red-200',
        REFEICAO: 'bg-orange-100 text-orange-700 border-orange-200',
        HIGIENE: 'bg-cyan-100 text-cyan-700 border-cyan-200',
        SONO: 'bg-purple-100 text-purple-700 border-purple-200',
        FAMILIA: 'bg-pink-100 text-pink-700 border-pink-200',
        OBSERVACAO: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        AVALIACAO: 'bg-teal-100 text-teal-700 border-teal-200',
        OUTRO: 'bg-gray-100 text-gray-700 border-gray-200',
      };
      const contagem: Record<string, number> = {};
      for (const ev of data) {
        const t = ev.type ?? 'OUTRO';
        contagem[t] = (contagem[t] ?? 0) + 1;
      }
      const lista = Object.entries(contagem)
        .sort(([,a],[,b]) => b - a)
        .map(([tipo, count]) => ({
          tipo,
          count,
          label: LABELS[tipo] ?? tipo.replace(/_/g, ' '),
          cor: CORES[tipo] ?? 'bg-gray-100 text-gray-700 border-gray-200',
        }));
      setEvidencias(lista);
    } catch {
      setEvidencias([]);
    } finally {
      setLoadingEvidencias(false);
    }
  }

   async function selecionarAluno(aluno: Aluno) {
    setAlunoSelecionado(aluno);
    setDimensoes(criarDimensoesVazias());
    setObservacaoGeral('');
    setProximosPassos('');
    setRelatorioIA(null);
    setMostrarRelatorioIA(false);
    setDiagnosticoExpress(null);
    setEtapa('formulario');
    // Tarefa 2.3 — carregar evidências do período
    carregarEvidencias(aluno.id, trimestre);
    carregarDiagnosticoExpress(aluno.id, trimestre);

    try {
      setLoadingRdics(true);
      const res = await http.get('/rdic', { params: { childId: aluno.id } });
      const lista: RdicSalvo[] = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      setRdicsDoAluno(lista);

      // Pré-popular com rascunho existente do trimestre atual
      const ano = new Date().getFullYear();
      const trimestreAtual = TRIMESTRES.find(t => t.id === trimestre);
      const periodo = trimestreAtual?.label ?? `${trimestre}º Trimestre`;
      const rascunhoExistente = lista.find(
        r => r.periodo === periodo &&
             r.anoLetivo === ano &&
             (r.status === 'RASCUNHO' || r.status === 'DEVOLVIDO')
      );
      if (rascunhoExistente?.rascunhoJson) {
        const j = rascunhoExistente.rascunhoJson;
        if (j.dimensoes && j.dimensoes.length > 0) setDimensoes(j.dimensoes);
        if (j.diagnosticoExpress) setDiagnosticoExpress(j.diagnosticoExpress);
        if (j.observacaoGeral) setObservacaoGeral(j.observacaoGeral);
        if (j.proximosPassos) setProximosPassos(j.proximosPassos);
      }
    } catch {
      setRdicsDoAluno([]);
    } finally {
      setLoadingRdics(false);
    }
  }
  async function carregarRdicsDoAluno(childId: string) {
    try {
      setLoadingRdics(true);
      const res = await http.get('/rdic', { params: { childId } });
      setRdicsDoAluno(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
    } catch {
      setRdicsDoAluno([]);
    } finally {
      setLoadingRdics(false);
    }
  }

  // ─── Atualizar nível de indicador ─────────────────────────────────────────
  function atualizarNivel(dimensaoId: string, codigoIndicador: string, nivel: IndicadorAvaliacao['nivel']) {
    setDimensoes(prev =>
      prev.map(d =>
        d.dimensao === dimensaoId
          ? {
              ...d,
              indicadores: d.indicadores.map(ind =>
                ind.codigo === codigoIndicador ? { ...ind, nivel } : ind,
              ),
            }
          : d,
      ),
    );
  }

  // ─── Gerar rascunho via IA LGPD ───────────────────────────────────────────
  async function gerarRascunhoIA() {
    if (!alunoSelecionado) return;
    setGerandoIA(true);
    setRelatorioIA(null);
    try {
      const ano = new Date().getFullYear();
      const trimestreAtual = TRIMESTRES.find(t => t.id === trimestre);
      const { start, end } = periodoDoTrimestre(trimestre);
      const periodo = `${trimestreAtual?.label ?? `${trimestre}º Trimestre`} ${ano}`;
      const res = await http.post('/ia/relatorio-consolidado-lgpd', {
        childId: alunoSelecionado.id,
        periodo,
        startDate: `${start}T00:00:00.000Z`,
        endDate: `${end}T23:59:59.999Z`,
      });
      setRelatorioIA(res.data);
      setMostrarRelatorioIA(true);
      // Preencher automaticamente observação geral com o rascunho da IA
      if (res.data?.relatorio && !observacaoGeral.trim()) {
        setObservacaoGeral(res.data.relatorio);
      }
      if (res.data?.sugestoes?.length > 0 && !proximosPassos.trim()) {
        setProximosPassos(res.data.sugestoes.join('\n'));
      }
      const fontes = Object.entries(res.data?.fontes ?? {})
        .filter(([, value]) => Number(value) > 0)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' · ');
      toast.success(`Relatório salvo em revisão humana com ${res.data.totalObservacoes} anotações pedagógicas${fontes ? ` (${fontes})` : ''}.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro ao gerar rascunho com IA';
      toast.error(msg);
    } finally {
      setGerandoIA(false);
    }
  }

  // ─── Salvar Desenvolvimento ──────────────────────────────────────────────────────────
  async function salvarRdic() {
    if (!alunoSelecionado) return;
    const observacaoFinal = observacaoGeral.trim() || gerarObservacaoExpress(diagnosticoExpress);
    const proximosPassosFinal = proximosPassos.trim() || diagnosticoExpress?.proximosPassos.join('\n') || '';
    if (!observacaoFinal) {
      toast.error('Marque pelo menos uma evidência ou escreva uma observação antes de salvar');
      return;
    }
    if (!observacaoGeral.trim()) setObservacaoGeral(observacaoFinal);
    if (!proximosPassos.trim() && proximosPassosFinal) setProximosPassos(proximosPassosFinal);
    setSaving(true);
    try {
      const trimestreAtual = TRIMESTRES.find(t => t.id === trimestre);
      const ano = new Date().getFullYear();
      const periodoLabel = trimestreAtual?.label ?? `${trimestre}º Trimestre`;
      const payload = {
        childId:      alunoSelecionado.id,
        classroomId:  turma?.id,
        periodo:      periodoLabel,
        periodoEnum:  trimestreAtual?.valor ?? null,
        anoLetivo:    ano,
        rascunhoJson: {
          trimestre,
          dimensoes,
          diagnosticoExpress,
          observacaoGeral: observacaoFinal,
          proximosPassos: proximosPassosFinal,
        },
      };
      const existente = rdicsDoAluno.find(
        r => r.periodo === payload.periodo && r.anoLetivo === ano &&
             (r.status === 'RASCUNHO' || r.status === 'DEVOLVIDO')
      );
      if (existente) {
        await http.patch(`/rdic/${existente.id}`, { rascunhoJson: payload.rascunhoJson });
      } else {
        await http.post('/rdic', payload);
      }
      toast.success(`Desenvolvimento de ${alunoSelecionado.firstName} salvo com sucesso!`);
      rdicClearDraft();
      await carregarRdicsDoAluno(alunoSelecionado.id);
      setEtapa('historico');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar Desenvolvimento');
    } finally {
      setSaving(false);
    }
  }

  // ─── Progresso ────────────────────────────────────────────────────────────
  const progresso = calcularProgresso(dimensoes);

  // Grupos Kanban — useMemo DEVE ficar ANTES de qualquer early return (React #310)
  const kanbanGrupos = useMemo(() => {
    const grupos: Record<string, Aluno[]> = {
      [RDIC_STATUS.PENDING]:      [],
      [RDIC_STATUS.EM_ANDAMENTO]: [],
      [RDIC_STATUS.CONCLUIDO]:    [],
    };
    alunos.forEach(a => {
      const rdics = rdicsMap[a.id] ?? [];
      const status = resolveRdicStatus(rdics, trimestre);
      grupos[status]?.push(a);
    });
    return grupos;
  }, [alunos, rdicsMap, trimestre]);

  // ─── Render: Loading ──────────────────────────────────────────────────────
  if (loading) return <LoadingState message="Carregando turma..." />;

  // ─── Render: Sem turma ────────────────────────────────────────────────────
  if (!turma) {
    return (
      <PageShell title="Desenvolvimento" subtitle="Registro por criança">
        <EmptyState
          icon={<Users className="h-12 w-12 text-gray-400" />}
          title={isProf ? 'Você ainda não tem turma' : 'Nenhuma turma encontrada'}
          description={isProf
            ? 'Sem turma vinculada.'
            : 'Nenhuma turma disponível.'}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Desenvolvimento"
      subtitle={`${turma.name} · ${turma.unit?.name}`}
    >
      {/* ─── Cabeçalho informativo ─── */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Brain className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-indigo-800">Desenvolvimento</h3>
            <p className="text-sm text-indigo-600 mt-0.5">
              Registre a evolução de cada criança.
            </p>
          </div>
        </div>
      </div>

      {/* ─── ETAPA 1: Kanban de crianças por status de Desenvolvimento ─── */}
      {etapa === 'selecionar' && (
        <div className="space-y-5">
          {/* Cabeçalho + seletor de trimestre */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Criança</h2>
              <p className="text-sm text-gray-500">{alunos.length} alunos na turma</p>
              <p className="text-xs text-indigo-500 mt-1">
                {loadingEvidenciasTurma ? 'Atualizando evidências do Diário...' : 'Registros do Diário'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">Período:</span>
              <div className="flex gap-1">
                {TRIMESTRES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTrimestre(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      trimestre === t.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {t.id}º T
                  </button>
                ))}
              </div>
            </div>
          </div>

          {alunos.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12 text-gray-400" />}
              title="Nenhuma criança encontrada"
              description="A turma está sem crianças."
            />
          ) : (
            <>
              {/* Abas Kanban */}
              <div className="flex gap-2 bg-gray-100 rounded-2xl p-1.5">
                {KANBAN_TABS.map(tab => {
                  const count = kanbanGrupos[tab.key]?.length ?? 0;
                  const ativo = kanbanTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setKanbanTab(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                        ativo
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                        ativo ? tab.badge : 'bg-gray-100 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Descrição da aba ativa */}
              {(() => {
                const tabAtiva = KANBAN_TABS.find(t => t.key === kanbanTab);
                return tabAtiva ? (
                  <p className="text-xs text-gray-500 -mt-2">{tabAtiva.description}</p>
                ) : null;
              })()}

              {/* Cards da aba ativa */}
              {(kanbanGrupos[kanbanTab] ?? []).length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  Nenhuma criança nesta categoria para o {trimestre}º trimestre.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(kanbanGrupos[kanbanTab] ?? []).map(aluno => (
                    <CardCrianca
                      key={aluno.id}
                      aluno={aluno}
                      selecionado={alunoSelecionado?.id === aluno.id}
                      onClick={() => selecionarAluno(aluno)}
                      rdicsCount={(rdicsMap[aluno.id] ?? []).length}
                      evidencias={evidenciasMap[aluno.id]}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── ETAPA 2: Formulário Desenvolvimento ─── */}
      {etapa === 'formulario' && alunoSelecionado && (
        <div className="space-y-6">
          {/* Banner de auto-save */}
          {rdicHasDraft && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm">
              <span className="text-amber-800">
                💾 Rascunho salvo automaticamente
                {rdicLastSaved && ` às ${rdicLastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
              <button onClick={rdicClearDraft} className="text-xs text-amber-600 underline hover:text-amber-800">Descartar rascunho</button>
            </div>
          )}
          {/* Header da criança selecionada */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setEtapa('selecionar')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Trocar criança
            </button>
            <div className="flex items-center gap-3 flex-1">
              <ChildAvatar
                child={alunoSelecionado}
                alt={alunoSelecionado.firstName}
                sizeClassName="w-12 h-12"
                imageClassName="rounded-full object-cover"
                fallbackClassName="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white"
                initialsClassName="text-sm font-bold text-white"
                showInitials
              />
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {alunoSelecionado.firstName} {alunoSelecionado.lastName}
                </h2>
                <p className="text-sm text-gray-500">{alunoSelecionado.idade} anos · {turma.name}</p>
              </div>
            </div>
            {rdicsDoAluno.length > 0 && (
              <button
                onClick={() => setEtapa('historico')}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition-all"
              >
                <FileText className="h-4 w-4" />
                Ver histórico ({rdicsDoAluno.length})
              </button>
            )}
          </div>

          {/* Seleção de trimestre */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Período de Avaliação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TRIMESTRES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSetTrimestre(t.id)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      trimestre === t.id
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-gray-200 hover:border-blue-300 text-gray-700'
                    }`}
                  >
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.periodo}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tarefa 2.3 — Evidências registradas no período */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <button
              onClick={() => setEvidenciasExpanded(v => !v)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                <span className="font-semibold text-indigo-800 text-sm">
                  Evidências registradas no período
                  {evidencias.length > 0 && (
                    <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                      {evidencias.reduce((s, e) => s + e.count, 0)} registros
                    </span>
                  )}
                </span>
              </div>
              <ChevronRight className={`h-4 w-4 text-indigo-400 transition-transform ${evidenciasExpanded ? 'rotate-90' : ''}`} />
            </button>

            {evidenciasExpanded && (
              <div className="mt-3">
                {loadingEvidencias ? (
                  <p className="text-xs text-indigo-500 animate-pulse">Carregando evidências...</p>
                ) : evidencias.length === 0 ? (
                  <p className="text-xs text-indigo-500">Nenhum registro no diário para este trimestre.</p>
                ) : (
                  <>
                    <p className="text-xs text-indigo-600 mb-2">
                      Clique em “Gerar Rascunho IA” abaixo para usar estas evidências como base para o Desenvolvimento.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {evidencias.map(ev => (
                        <span
                          key={ev.tipo}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${ev.cor}`}
                        >
                          <span className="tabular-nums font-bold">{ev.count}</span>
                          {ev.label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Diagnóstico rápido por marcações reais */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-emerald-900">RDIC Express — leitura rápida do período</h3>
                </div>
                <p className="mt-1 text-xs text-emerald-700">
                  Marcações do Diário de Bordo e observações reais cruzadas automaticamente. Use como base e revise antes de enviar.
                </p>
              </div>
              {diagnosticoExpress && (
                <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  diagnosticoExpress.tendencia === 'ATENCAO'
                    ? 'bg-rose-100 text-rose-700'
                    : diagnosticoExpress.tendencia === 'FAVORAVEL'
                      ? 'bg-emerald-100 text-emerald-700'
                      : diagnosticoExpress.tendencia === 'SEM_DADOS'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-100 text-amber-700'
                }`}>
                  {diagnosticoExpress.tendencia === 'ATENCAO' ? 'Acompanhar' : diagnosticoExpress.tendencia === 'FAVORAVEL' ? 'Evidências favoráveis' : diagnosticoExpress.tendencia === 'SEM_DADOS' ? 'Sem dados suficientes' : 'Em desenvolvimento'}
                </span>
              )}
            </div>

            {loadingDiagnosticoExpress ? (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin" /> Cruzando registros autorizados do período...
              </div>
            ) : diagnosticoExpress ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    ['Marcações', diagnosticoExpress.fontes.microgestos],
                    ['Dias com registro', diagnosticoExpress.fontes.diasComRegistro],
                    ['Diários publicados', diagnosticoExpress.fontes.diariosPublicados],
                    ['Observações', diagnosticoExpress.fontes.observacoesDesenvolvimento],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-white bg-white/80 p-3 shadow-sm">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-slate-800">{value}</p>
                    </div>
                  ))}
                </div>

                {diagnosticoExpress.habilidades.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Habilidades mais registradas</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {diagnosticoExpress.habilidades.slice(0, 6).map((habilidade) => (
                        <span key={`${habilidade.microgestoId}-${habilidade.nivel}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">
                          <strong>{habilidade.label}</strong> · {habilidade.nivel.replace(/_/g, ' ').toLowerCase()} · {habilidade.ocorrencias}x
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/70 p-3 text-xs text-slate-500">
                    Ainda não há marcações estruturadas neste período. O formulário continua disponível para registro direto.
                  </p>
                )}

                {diagnosticoExpress.pontosAtencao.length > 0 && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Pontos para acompanhar</p>
                    <p className="mt-1 text-sm text-rose-800">{diagnosticoExpress.pontosAtencao.join(' · ')}</p>
                  </div>
                )}

                <p className="mt-3 text-[11px] text-slate-500">
                  O resumo é pedagógico e operacional; não substitui observação direta, avaliação profissional ou diagnóstico clínico.
                </p>
              </>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-emerald-200 bg-white/70 p-3 text-xs text-slate-500">
                O resumo rápido não pôde ser carregado. Você pode continuar com o preenchimento manual sem perder o fluxo atual.
              </p>
            )}
          </div>

          {/* Barra de progresso */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progresso do preenchimento</span>
              <span className={`text-sm font-bold ${progresso.pct === 100 ? 'text-green-600' : 'text-gray-600'}`}>
                {progresso.preenchidos}/{progresso.total} indicadores ({progresso.pct}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  progresso.pct === 100 ? 'bg-green-500' : progresso.pct >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${progresso.pct}%` }}
              />
            </div>
            <div className="flex gap-4 mt-3 flex-wrap">
              {NIVEIS.map(n => {
                const count = dimensoes.reduce(
                  (s, d) => s + d.indicadores.filter(i => i.nivel === n.id).length,
                  0,
                );
                return (
                  <div key={n.id} className="flex items-center gap-1.5">
                    <span className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center border ${n.corBg}`}>{n.short}</span>
                    <span className="text-xs text-gray-600">{n.label}: <strong>{count}</strong></span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botão IA LGPD */}
          <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-violet-800 text-sm">Motor de IA Assistiva LGPD</p>
                  <p className="text-xs text-violet-600 mt-0.5">
                    Gera um rascunho de observação geral e próximos passos com base nas entradas do Diário de Bordo.
                    Os dados são <strong>anonimizados automaticamente</strong> antes de serem enviados à IA.
                  </p>
                </div>
              </div>
              <Button
                onClick={gerarRascunhoIA}
                disabled={gerandoIA}
                className="flex-shrink-0 bg-violet-600 hover:bg-violet-700 text-white text-sm"
              >
                {gerandoIA ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Gerar Rascunho IA</>
                )}
              </Button>
            </div>

            {/* Resultado da IA */}
            {relatorioIA && (
              <div className="mt-4 border-t border-violet-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-700">
                      Rascunho · {relatorioIA.totalObservacoes} observações
                    </span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Código: {relatorioIA.codigoAnonimizado}
                    </span>
                    {relatorioIA.status && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {relatorioIA.status === 'EM_REVISAO' ? 'Em revisão' : relatorioIA.status}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setMostrarRelatorioIA(v => !v)}
                    className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
                  >
                    {mostrarRelatorioIA ? <><EyeOff className="h-3 w-3" /> Ocultar</> : <><Eye className="h-3 w-3" /> Ver</>}
                  </button>
                </div>

                {mostrarRelatorioIA && (
                  <div className="space-y-3">
                    <div className="bg-white rounded-lg p-3 border border-violet-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Relatório IA</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{relatorioIA.relatorio}</p>
                    </div>
                    {relatorioIA.pontosFortess?.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                        <p className="text-xs font-semibold text-green-700 uppercase mb-2">Pontos Fortes</p>
                        <ul className="space-y-1">
                          {relatorioIA.pontosFortess.map((p, i) => (
                            <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                              <Star className="h-3 w-3 mt-1 flex-shrink-0" /> {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {relatorioIA.sugestoes?.length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-700 uppercase mb-2">Sugestões</p>
                        <ul className="space-y-1">
                          {relatorioIA.sugestoes.map((s, i) => (
                            <li key={i} className="text-sm text-blue-800 flex items-start gap-2">
                              <ChevronRight className="h-3 w-3 mt-1 flex-shrink-0" /> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {relatorioIA.fontes && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">Fontes</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(relatorioIA.fontes).filter(([, value]) => Number(value) > 0).map(([fonte, valor]) => (
                            <span key={fonte} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 border border-slate-200">
                              {fonte.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}: {valor}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 italic">
                      * Em revisão humana. A IA não gera diagnóstico ou laudo clínico.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5 Campos de Experiência BNCC */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800">Campos de experiência</h3>
            {DIMENSOES_BNCC.map(dim => {
              const dimData = dimensoes.find(d => d.dimensao === dim.id);
              const aberta = dimensaoAberta === dim.id;
              const DimIcon = dim.icon;
              const consolidados = dimData?.indicadores.filter(i => i.nivel === 'CONSOLIDADO' || i.nivel === 'AMPLIADO').length ?? 0;
              const total = dim.indicadores.length;

              return (
                <div key={dim.id} className={`border-2 rounded-xl overflow-hidden ${dim.cor.border}`}>
                  {/* Header da dimensão */}
                  <button
                    onClick={() => setDimensaoAberta(aberta ? null : dim.id)}
                    className={`w-full flex items-center justify-between p-4 ${dim.cor.bg} transition-colors hover:opacity-90`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${dim.cor.badge}`}>
                        <DimIcon className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className={`font-semibold text-sm ${dim.cor.text}`}>{dim.label}</p>
                        <p className="text-xs text-gray-500">{dim.descricao}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${dim.cor.badge}`}>
                        {consolidados}/{total} avaliados
                      </span>
                      {aberta ? (
                        <ChevronRight className="h-4 w-4 text-gray-500 rotate-90 transition-transform" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500 transition-transform" />
                      )}
                    </div>
                  </button>

                  {/* Indicadores */}
                  {aberta && dimData && (
                    <div className="bg-white px-4 pb-2">
                      {/* Legenda */}
                      <div className="flex gap-3 py-3 border-b border-gray-100 flex-wrap">
                        {NIVEIS.map(n => (
                          <div key={n.id} className="flex items-center gap-1">
                            <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center border ${n.corBg}`}>{n.short}</span>
                            <span className="text-xs text-gray-500">{n.label}</span>
                          </div>
                        ))}
                      </div>
                      {dimData.indicadores.map(ind => (
                        <IndicadorRow
                          key={ind.codigo}
                          indicador={ind}
                          onChange={nivel => atualizarNivel(dim.id, ind.codigo, nivel)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Observação Geral */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                Observação Geral do Professor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Observação geral sobre o desenvolvimento de {alunoSelecionado.firstName}
                  <span className="text-gray-400 font-normal ml-1">(obrigatório)</span>
                </Label>
                <Textarea
                  value={observacaoGeral}
                  onChange={e => setObservacaoGeral(e.target.value)}
                  placeholder={`Descreva o desenvolvimento geral de ${alunoSelecionado.firstName} neste trimestre (${TRIMESTRES.find(t => t.id === trimestre)?.periodo ?? ''}), considerando avanços, dificuldades e aspectos relevantes...`}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">{observacaoGeral.length} caracteres</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Próximos passos e encaminhamentos
                  <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                </Label>
                <Textarea
                  value={proximosPassos}
                  onChange={e => setProximosPassos(e.target.value)}
                  placeholder="Próximos passos..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Botões de ação */}
          <div className="flex items-center justify-between gap-3 pb-6">
            <button
              onClick={() => setEtapa('selecionar')}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="flex gap-3">
              {rdicsDoAluno.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setEtapa('historico')}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" /> Histórico
                </Button>
              )}
              <Button
                onClick={salvarRdic}
                disabled={saving || (!observacaoGeral.trim() && !diagnosticoExpress)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
              >
                {saving ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Salvando...</>
                ) : (
                  <><Save className="h-4 w-4" /> Salvar Rascunho</>
                )}
              </Button>
              <Button
                onClick={async () => {
                  if (!alunoSelecionado) return;
                  await salvarRdic();
                  // Após salvar, buscar o Desenvolvimento recém-criado e enviar para revisão
                  try {
                    const lista = await http.get('/rdic', { params: { childId: alunoSelecionado.id } });
                    const rdics = Array.isArray(lista.data) ? lista.data : lista.data?.data ?? [];
                    const trimestreAtual = TRIMESTRES.find(t => t.id === trimestre);
                    const ano = new Date().getFullYear();
                    const periodo = trimestreAtual?.label ?? `${trimestre}º Trimestre`;
                    const rdic = rdics.find((r: any) => r.periodo === periodo && r.anoLetivo === ano && (r.status === 'RASCUNHO' || r.status === 'DEVOLVIDO'));
                    if (rdic) {
                      await http.patch(`/rdic/${rdic.id}/enviar-revisao`);
                      toast.success('Desenvolvimento enviado para revisão da coordenação pedagógica!');
                      await carregarRdicsDoAluno(alunoSelecionado.id);
                      setEtapa('historico');
                    }
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message || 'Erro ao enviar para revisão');
                  }
                }}
                disabled={saving || (!observacaoGeral.trim() && !diagnosticoExpress)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Send className="h-4 w-4" /> Enviar para Revisão
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPA 3: Histórico de Relatórios da criança ─── */}
      {etapa === 'historico' && alunoSelecionado && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setEtapa('formulario')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar ao formulário
            </button>
            <h2 className="text-lg font-semibold text-gray-800 flex-1">
              Histórico de Relatórios — {alunoSelecionado.firstName} {alunoSelecionado.lastName}
            </h2>
            <Button
              onClick={() => setEtapa('formulario')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              <Plus className="h-4 w-4" /> Novo Desenvolvimento
            </Button>
            <Button
              onClick={() => {
                const printWindow = window.open('', '_blank');
                if (!printWindow || !alunoSelecionado) return;
                const rdicsHtml = rdicsDoAluno.map(rdic => {
                  const prog = calcularProgresso(rdic.rascunhoJson?.dimensoes ?? []);
                  const dimHtml = (rdic.rascunhoJson?.dimensoes ?? []).map(d => {
                    const def = DIMENSOES_BNCC.find(x => x.id === d.dimensao);
                    const indsHtml = d.indicadores.map(ind =>
                      `<tr><td style="padding:4px 8px;font-size:12px;color:#555">${ind.codigo}</td><td style="padding:4px 8px;font-size:12px">${ind.descricao}</td><td style="padding:4px 8px;font-size:12px;text-align:center;font-weight:600;color:${ind.nivel==='CONSOLIDADO'?'var(--success)':ind.nivel==='AMPLIADO'?'var(--brand-700)':ind.nivel==='EM_DESENVOLVIMENTO'?'var(--warning)':'var(--text-tertiary)'}">${ind.nivel.replace('_',' ')}</td></tr>`
                    ).join('');
                    return `<div style="margin-bottom:16px"><h4 style="font-size:13px;font-weight:700;color:var(--text-primary);margin:0 0 6px">${def?.label ?? d.dimensao}</h4><table style="width:100%;border-collapse:collapse;border:1px solid var(--border-default)"><thead><tr style="background:var(--surface-inset)"><th style="padding:4px 8px;font-size:11px;text-align:left">Código</th><th style="padding:4px 8px;font-size:11px;text-align:left">Indicador</th><th style="padding:4px 8px;font-size:11px;text-align:center">Nível</th></tr></thead><tbody>${indsHtml}</tbody></table></div>`;
                  }).join('');
                  return `<div style="page-break-inside:avoid;margin-bottom:32px;border:1px solid var(--border-default);border-radius:8px;padding:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="font-size:15px;font-weight:700;margin:0">${rdic.periodo}</h3><span style="font-size:12px;padding:2px 8px;border-radius:12px;background:${rdic.status==='PUBLICADO'?'var(--success-bg)':rdic.status==='REVISAO'?'var(--warning-bg)':'var(--surface-subtle)'};color:${rdic.status==='PUBLICADO'?'var(--success)':rdic.status==='REVISAO'?'var(--warning)':'var(--text-tertiary)'}">${rdic.status}</span></div>${dimHtml}<div style="margin-top:12px;padding:12px;background:var(--surface-inset);border-radius:6px"><p style="font-size:12px;font-weight:700;margin:0 0 4px">Observação Geral:</p><p style="font-size:12px;color:var(--text-primary);margin:0">${rdic.rascunhoJson?.observacaoGeral || '—'}</p></div>${rdic.rascunhoJson?.proximosPassos?`<div style="margin-top:8px;padding:12px;background:var(--success-bg);border-radius:6px"><p style="font-size:12px;font-weight:700;margin:0 0 4px">Próximos Passos:</p><p style="font-size:12px;color:var(--text-primary);margin:0">${rdic.rascunhoJson?.proximosPassos}</p></div>`:''}<p style="font-size:11px;color:var(--text-tertiary);margin-top:8px">Progresso: ${prog.pct}% preenchido · Registrado em ${new Date(rdic.criadoEm).toLocaleDateString('pt-BR')}</p></div>`;
                }).join('');
                printWindow.document.write(`<!DOCTYPE html><html><head><title>Desenvolvimento — ${alunoSelecionado.firstName} ${alunoSelecionado.lastName}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin-bottom:4px}h2{font-size:14px;font-weight:400;color:var(--text-tertiary);margin:0 0 24px}@media print{.no-print{display:none}}</style></head><body><h1>Desenvolvimento — Relatório de Desenvolvimento Individual da Criança</h1><h2>${alunoSelecionado.firstName} ${alunoSelecionado.lastName} · ${turma?.name ?? ''} · ${turma?.unit?.name ?? ''}</h2><p style="font-size:12px;color:var(--text-tertiary);margin-bottom:24px">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>${rdicsHtml}</body></html>`);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => printWindow.print(), 500);
              }}
              disabled={rdicsDoAluno.length === 0}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white text-sm disabled:opacity-40"
            >
              <Printer className="h-4 w-4" /> Exportar PDF
            </Button>
          </div>

          {loadingRdics && <LoadingState message="Carregando histórico..." />}

          {!loadingRdics && rdicsDoAluno.length === 0 && (
            <EmptyState
              icon={<FileText className="h-12 w-12 text-gray-400" />}
              title="Nenhum Desenvolvimento registrado"
              description={`${alunoSelecionado.firstName} ainda não tem Relatórios. Clique em "Novo Desenvolvimento" para criar o primeiro.`}
            />
          )}

          {!loadingRdics && rdicsDoAluno.length > 0 && (
            <div className="space-y-3">
              {rdicsDoAluno.map(rdic => {
                const prog = calcularProgresso(rdic.rascunhoJson?.dimensoes ?? []);
                return (
                  <Card key={rdic.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-800">{rdic.periodo}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              rdic.status === 'PUBLICADO'  ? 'bg-green-100 text-green-700' :
                              rdic.status === 'APROVADO'   ? 'bg-emerald-100 text-emerald-700' :
                              rdic.status === 'FINALIZADO' ? 'bg-blue-100 text-blue-700' :
                              rdic.status === 'EM_REVISAO' ? 'bg-yellow-100 text-yellow-700' :
                              rdic.status === 'DEVOLVIDO'  ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {rdic.status === 'PUBLICADO'  ? '✓ Publicado' :
                               rdic.status === 'APROVADO'   ? '✓ Aprovado' :
                               rdic.status === 'FINALIZADO' ? 'Finalizado' :
                               rdic.status === 'EM_REVISAO' ? 'Em Revisão' :
                               rdic.status === 'DEVOLVIDO'  ? 'Devolvido' : 'Rascunho'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{rdic.rascunhoJson?.observacaoGeral ?? ''}</p>
                          {rdic.status === 'DEVOLVIDO' && rdic.reviewComment && (
                            <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-2 flex gap-2">
                              <span className="text-xs font-semibold text-orange-700">Devolvido pela coordenação:</span>
                              <span className="text-xs text-orange-600">{rdic.reviewComment}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-24 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="bg-blue-500 h-1.5 rounded-full"
                                  style={{ width: `${prog.pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{prog.pct}% preenchido</span>
                            </div>
                            <span className="text-xs text-gray-400">
                              {new Date(rdic.criadoEm).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                        <CheckCircle className={`h-5 w-5 flex-shrink-0 ${
                          rdic.status === 'PUBLICADO' || rdic.status === 'APROVADO' ? 'text-green-500' : 'text-gray-300'
                        }`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
