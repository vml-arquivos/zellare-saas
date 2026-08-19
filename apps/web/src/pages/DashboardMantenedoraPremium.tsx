import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, Cell, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, School, AlertCircle, CheckCircle, Clock, DollarSign, FileText, RefreshCw } from 'lucide-react';
import { getGlobalStats, type GlobalStats } from '../api/analytics';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

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

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">Carregando dados reais do painel...</div>;
  if (error || !stats) return <div className="flex min-h-screen items-center justify-center bg-gray-950 p-6"><div className="max-w-xl rounded-2xl border border-red-800 bg-red-950/40 p-6 text-red-100"><h1 className="text-xl font-semibold">Painel indisponível</h1><p className="mt-2 text-sm">{error || 'Nenhuma resposta real foi recebida.'}</p><Button onClick={() => void load()} className="mt-4 bg-red-700 hover:bg-red-600"><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div></div>;

  const monthlyData = stats.monthlyData.map((item) => ({ ...item, month: item.month.slice(5) ? `${item.month.slice(5)}/${item.month.slice(0, 4)}` : item.month }));
  const unitsData = stats.units.map((item, index) => ({ ...item, color: COLORS[index % COLORS.length] }));
  const activitiesData = [
    { type: 'Atividades publicadas', count: stats.completedActivities, color: COLORS[0] },
    { type: 'Alertas críticos', count: stats.criticalAlerts, color: COLORS[2] },
    { type: 'Requisições pendentes', count: stats.pendingRequests, color: COLORS[3] },
  ];
  const revenueLabel = stats.revenueAvailable && stats.monthlyRevenue !== null ? `R$ ${(stats.monthlyRevenue / 1000).toFixed(0)}k` : 'Não integrado';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-4xl font-bold text-white">Painel da Mantenedora</h1><p className="mt-2 text-gray-400">Visão geral.</p><p className="mt-1 text-xs text-gray-500">Atualizado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(stats.generatedAt))}</p></div><Button onClick={() => void load()} variant="outline" className="border-gray-700 bg-gray-900 text-gray-200"><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button></div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"><Card className="border-0 bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-white/90">Unidades ativas</CardTitle><School className="h-5 w-5 text-white/80" /></CardHeader><CardContent><div className="text-3xl font-bold text-white">{stats.totalUnits}</div><p className="mt-1 text-xs text-white/70">Unidades</p></CardContent></Card><Card className="border-0 bg-gradient-to-br from-green-600 to-green-700 shadow-xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-white/90">Alunos ativos</CardTitle><Users className="h-5 w-5 text-white/80" /></CardHeader><CardContent><div className="text-3xl font-bold text-white">{stats.totalStudents}</div><p className="mt-1 text-xs text-white/70">Matrículas</p></CardContent></Card><Card className="border-0 bg-gradient-to-br from-purple-600 to-purple-700 shadow-xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-white/90">Professores</CardTitle><Users className="h-5 w-5 text-white/80" /></CardHeader><CardContent><div className="text-3xl font-bold text-white">{stats.totalTeachers}</div><p className="mt-1 text-xs text-white/70">Turmas</p></CardContent></Card><Card className="border-0 bg-gradient-to-br from-orange-600 to-orange-700 shadow-xl"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm text-white/90">Receita mensal</CardTitle><DollarSign className="h-5 w-5 text-white/80" /></CardHeader><CardContent><div className="text-2xl font-bold text-white">{revenueLabel}</div><p className="mt-1 text-xs text-white/70">{stats.revenueAvailable ? 'Integrada' : 'Sem integração'}</p></CardContent></Card></div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2"><Card className="border-gray-800 bg-gray-900/50 shadow-xl"><CardHeader><CardTitle className="text-white">Alunos por unidade</CardTitle><CardDescription className="text-gray-400">Matrículas por unidade.</CardDescription></CardHeader><CardContent><ResponsiveContainer width="100%" height={320}><BarChart data={unitsData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="name" stroke="#9CA3AF" angle={-35} textAnchor="end" height={90} /><YAxis stroke="#9CA3AF" /><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} /><Bar dataKey="students" name="Alunos" radius={[8, 8, 0, 0]}>{unitsData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer></CardContent></Card><Card className="border-gray-800 bg-gray-900/50 shadow-xl"><CardHeader><CardTitle className="text-white">Atividade operacional</CardTitle><CardDescription className="text-gray-400">Dados do período.</CardDescription></CardHeader><CardContent><ResponsiveContainer width="100%" height={320}><PieChart><Pie data={activitiesData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${(((percent as number) || 0) * 100).toFixed(0)}%`} outerRadius={105} dataKey="count">{activitiesData.map((entry) => <Cell key={entry.type} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} /></PieChart></ResponsiveContainer></CardContent></Card></div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2"><Card className="border-gray-800 bg-gray-900/50 shadow-xl"><CardHeader><CardTitle className="text-white">Série real disponível</CardTitle><CardDescription className="text-gray-400">Dados disponíveis.</CardDescription></CardHeader><CardContent><ResponsiveContainer width="100%" height={280}><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="month" stroke="#9CA3AF" /><YAxis stroke="#9CA3AF" /><Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} /><Legend /><Bar dataKey="students" fill="#3B82F6" name="Alunos" /><Bar dataKey="activities" fill="#10B981" name="Atividades" /></BarChart></ResponsiveContainer></CardContent></Card><Card className="border-gray-800 bg-gray-900/50 shadow-xl"><CardHeader><CardTitle className="text-white">Indicadores de performance</CardTitle><CardDescription className="text-gray-400">Indicadores.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between rounded-lg bg-gray-800/50 p-4"><div className="flex items-center gap-3"><CheckCircle className="h-6 w-6 text-green-500" /><div><p className="text-sm text-gray-400">Taxa de presença</p><p className="text-2xl font-bold text-white">{stats.avgAttendance}%</p></div></div><Badge className="bg-green-600 text-white">Real</Badge></div><div className="flex items-center justify-between rounded-lg bg-gray-800/50 p-4"><div className="flex items-center gap-3"><FileText className="h-6 w-6 text-blue-500" /><div><p className="text-sm text-gray-400">Atividades publicadas</p><p className="text-2xl font-bold text-white">{stats.completedActivities}</p></div></div><Badge className="bg-blue-600 text-white">Mês corrente</Badge></div><div className="flex items-center justify-between rounded-lg bg-gray-800/50 p-4"><div className="flex items-center gap-3"><Clock className="h-6 w-6 text-orange-500" /><div><p className="text-sm text-gray-400">Requisições pendentes</p><p className="text-2xl font-bold text-white">{stats.pendingRequests}</p></div></div><Badge className="bg-orange-600 text-white">Ação</Badge></div><div className="flex items-center justify-between rounded-lg bg-gray-800/50 p-4"><div className="flex items-center gap-3"><AlertCircle className="h-6 w-6 text-red-500" /><div><p className="text-sm text-gray-400">Alertas críticos</p><p className="text-2xl font-bold text-white">{stats.criticalAlerts}</p></div></div><Badge className="bg-red-600 text-white">48 horas</Badge></div></CardContent></Card></div>

      <Card className="border-gray-800 bg-gray-900/50 shadow-xl"><CardHeader><CardTitle className="text-white">Ações operacionais</CardTitle><CardDescription className="text-gray-400">Ações.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-2 gap-4 md:grid-cols-4"><Button onClick={() => navigate('/app/admin/unidades')} className="h-20 bg-blue-600 text-white hover:bg-blue-700"><School className="mr-2 h-5 w-5" />Unidades</Button><Button onClick={() => navigate('/app/admin/usuarios')} className="h-20 bg-green-600 text-white hover:bg-green-700"><Users className="mr-2 h-5 w-5" />Usuários</Button><Button onClick={() => navigate('/app/reports')} className="h-20 bg-purple-600 text-white hover:bg-purple-700"><FileText className="mr-2 h-5 w-5" />Relatórios</Button><Button onClick={() => navigate('/app/financeiro')} className="h-20 bg-orange-600 text-white hover:bg-orange-700"><DollarSign className="mr-2 h-5 w-5" />Financeiro</Button></div></CardContent></Card>
    </div>
  );
}
