import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, Cell, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, School, AlertCircle, CheckCircle, Clock, DollarSign, FileText, RefreshCw } from 'lucide-react';
import { getGlobalStats, type GlobalStats } from '../api/analytics';

const COLORS = ['var(--accent-violet)', 'var(--accent-cyan)', 'var(--success)', 'var(--accent-violet)', 'var(--accent-cyan)', 'var(--brand-500)', 'var(--warning)'];

function errorMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || (error instanceof Error ? error.message : 'Não foi possível carregar o painel global.');
}

export default function DashboardMantenedoraPremium() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setStats(await getGlobalStats());
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] text-primary">Carregando dados do painel...</div>;
  if (error || !stats) return <div className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] p-6"><div className="max-w-xl rounded-2xl border-[var(--error-border)] bg-[var(--error-bg)] p-6 text-primary"><h1 className="text-xl font-semibold">Painel indisponível</h1><p className="mt-2 text-sm">{error || 'Nenhuma resposta foi recebida.'}</p><Button onClick={() => void load()} className="mt-4 ds-btn-primary"><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div></div>;

  const monthlyData = stats.monthlyData.map((item) => ({ ...item, month: item.month.slice(5) ? `${item.month.slice(5)}/${item.month.slice(0, 4)}` : item.month }));
  const unitsData = stats.units.map((item, index) => ({ ...item, color: COLORS[index % COLORS.length] }));
  const activitiesData = [
    { type: 'Atividades publicadas', count: stats.completedActivities, color: COLORS[0] },
    { type: 'Alertas críticos', count: stats.criticalAlerts, color: COLORS[2] },
    { type: 'Requisições pendentes', count: stats.pendingRequests, color: COLORS[3] },
  ];
  const revenueLabel = stats.revenueAvailable && stats.monthlyRevenue !== null ? `R$ ${(stats.monthlyRevenue / 1000).toFixed(0)}k` : 'Não integrado';

  return (
    <div className="min-h-screen bg-[var(--surface-page)] p-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-4xl font-normal text-primary">Painel da Mantenedora</h1><p className="mt-2 text-secondary">Visão geral.</p><p className="mt-1 text-xs text-tertiary">Atualizado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(stats.generatedAt))}</p></div><Button onClick={() => void load()} variant="outline" className="ds-btn-secondary"><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button></div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"><Card className="ds-card shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-primary">Unidades ativas</CardTitle><School className="h-5 w-5 text-brand-soft" /></CardHeader><CardContent><div className="text-3xl font-normal text-primary">{stats.totalUnits}</div><p className="mt-1 text-xs text-secondary">Unidades</p></CardContent></Card><Card className="ds-card shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-primary">Alunos ativos</CardTitle><Users className="h-5 w-5 text-brand-soft" /></CardHeader><CardContent><div className="text-3xl font-normal text-primary">{stats.totalStudents}</div><p className="mt-1 text-xs text-secondary">Matrículas</p></CardContent></Card><Card className="ds-card shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-primary">Professores</CardTitle><Users className="h-5 w-5 text-brand-soft" /></CardHeader><CardContent><div className="text-3xl font-normal text-primary">{stats.totalTeachers}</div><p className="mt-1 text-xs text-secondary">Turmas</p></CardContent></Card><Card className="ds-card shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-primary">Receita mensal</CardTitle><DollarSign className="h-5 w-5 text-brand-soft" /></CardHeader><CardContent><div className="text-2xl font-normal text-primary">{revenueLabel}</div><p className="mt-1 text-xs text-secondary">{stats.revenueAvailable ? 'Integrada' : 'Sem integração'}</p></CardContent></Card></div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2"><Card className="ds-card shadow-sm"><CardHeader><CardTitle className="text-primary">Alunos por unidade</CardTitle><CardDescription className="text-secondary">Matrículas por unidade.</CardDescription></CardHeader><CardContent><ResponsiveContainer width="100%" height={320}><BarChart data={unitsData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis dataKey="name" stroke="var(--text-tertiary)" angle={-35} textAnchor="end" height={90} /><YAxis stroke="var(--text-tertiary)" /><Tooltip contentStyle={{ backgroundColor: 'var(--surface-modal)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Bar dataKey="students" name="Alunos" radius={[8, 8, 0, 0]}>{unitsData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer></CardContent></Card><Card className="ds-card shadow-sm"><CardHeader><CardTitle className="text-primary">Atividade operacional</CardTitle><CardDescription className="text-secondary">Dados do período.</CardDescription></CardHeader><CardContent><ResponsiveContainer width="100%" height={320}><PieChart><Pie data={activitiesData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${(((percent as number) || 0) * 100).toFixed(0)}%`} outerRadius={105} dataKey="count">{activitiesData.map((entry) => <Cell key={entry.type} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ backgroundColor: 'var(--surface-modal)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /></PieChart></ResponsiveContainer></CardContent></Card></div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2"><Card className="ds-card shadow-sm"><CardHeader><CardTitle className="text-primary">Série histórica</CardTitle><CardDescription className="text-secondary">Dados disponíveis.</CardDescription></CardHeader><CardContent><ResponsiveContainer width="100%" height={280}><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis dataKey="month" stroke="var(--text-tertiary)" /><YAxis stroke="var(--text-tertiary)" /><Tooltip contentStyle={{ backgroundColor: 'var(--surface-modal)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Legend /><Bar dataKey="students" fill="var(--accent-violet)" name="Alunos" /><Bar dataKey="activities" fill="var(--success)" name="Atividades" /></BarChart></ResponsiveContainer></CardContent></Card><Card className="ds-card shadow-sm"><CardHeader><CardTitle className="text-primary">Indicadores de performance</CardTitle><CardDescription className="text-secondary">Indicadores.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between rounded-lg ds-surface p-4"><div className="flex items-center gap-3"><CheckCircle className="h-6 w-6 text-secondary" /><div><p className="text-sm text-secondary">Taxa de presença</p><p className="text-2xl font-normal text-primary">{stats.avgAttendance}%</p></div></div><Badge className="ds-badge-green">Atual</Badge></div><div className="flex items-center justify-between rounded-lg ds-surface p-4"><div className="flex items-center gap-3"><FileText className="h-6 w-6 text-blue-500" /><div><p className="text-sm text-secondary">Atividades publicadas</p><p className="text-2xl font-normal text-primary">{stats.completedActivities}</p></div></div><Badge className="ds-badge-brand">Mês corrente</Badge></div><div className="flex items-center justify-between rounded-lg ds-surface p-4"><div className="flex items-center gap-3"><Clock className="h-6 w-6 text-orange-500" /><div><p className="text-sm text-secondary">Requisições pendentes</p><p className="text-2xl font-normal text-primary">{stats.pendingRequests}</p></div></div><Badge className="ds-badge-amber">Ação</Badge></div><div className="flex items-center justify-between rounded-lg ds-surface p-4"><div className="flex items-center gap-3"><AlertCircle className="h-6 w-6 text-red-500" /><div><p className="text-sm text-secondary">Alertas críticos</p><p className="text-2xl font-normal text-primary">{stats.criticalAlerts}</p></div></div><Badge className="ds-badge-red">48 horas</Badge></div></CardContent></Card></div>

      <Card className="ds-card shadow-sm"><CardHeader><CardTitle className="text-primary">Ações operacionais</CardTitle><CardDescription className="text-secondary">Ações.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-2 gap-4 md:grid-cols-4"><Button onClick={() => navigate('/app/admin/unidades')} className="h-20 ds-btn-primary"><School className="mr-2 h-5 w-5" />Unidades</Button><Button onClick={() => navigate('/app/admin/usuarios')} className="h-20 ds-btn-primary"><Users className="mr-2 h-5 w-5" />Usuários</Button><Button onClick={() => navigate('/app/reports')} className="h-20 ds-btn-primary"><FileText className="mr-2 h-5 w-5" />Relatórios</Button><Button onClick={() => navigate('/app/financeiro')} className="h-20 ds-btn-primary"><DollarSign className="mr-2 h-5 w-5" />Financeiro</Button></div></CardContent></Card>
    </div>
  );
}
