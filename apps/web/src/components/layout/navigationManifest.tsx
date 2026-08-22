import type { LucideIcon } from 'lucide-react';
import {
  Apple,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Building2,
  Bus,
  Camera,
  ClipboardCheck,
  ClipboardList,
  FileArchive,
  FileText,
  FolderCheck,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Layers3,
  LayoutDashboard,
  MessageCircle,
  Network,
  PackageOpen,
  PanelTop,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Shield,
  Sparkles,
  Stethoscope,
  Trophy,
  UserCheck,
  UserCircle,
  Users,
  Utensils,
} from 'lucide-react';
import type { User } from '../../api/auth';
function normalizeRoles(user: User | null): string[] {
  const roles = user?.roles;
  if (!Array.isArray(roles)) return [];
  return roles.map((role) => typeof role === 'string' ? role : role.level).filter(Boolean) as string[];
}

function normalizeRoleTypes(user: User | null): string[] {
  const roles = user?.roles;
  if (!Array.isArray(roles)) return [];
  return roles.map((role) => typeof role === 'string' ? '' : role.type).filter(Boolean) as string[];
}

export type NavigationCapability =
  | 'overview.read'
  | 'pedagogy.read'
  | 'pedagogy.write'
  | 'care.read'
  | 'family.read'
  | 'family.manage'
  | 'materials.read'
  | 'materials.manage'
  | 'admin.read'
  | 'admin.write'
  | 'operations.read'
  | 'operations.write'
  | 'operations.manage';

export interface NavigationItem {
  id: string;
  path: string;
  label: string;
  icon: LucideIcon;
  levels?: string[];
  types?: string[];
  capability?: NavigationCapability;
  featureFlag?: string;
  badge?: string;
  exact?: boolean;
}

export interface NavigationGroup {
  id: string;
  title: string;
  items: NavigationItem[];
  featureFlag?: string;
}

const TEAM_LEVELS = ['PROFESSOR', 'PROFESSOR_AUXILIAR', 'UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'];
const MANAGEMENT_LEVELS = ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'];
const NETWORK_LEVELS = ['STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'];
const TEACHER_LEVELS = ['PROFESSOR', 'PROFESSOR_AUXILIAR', 'DEVELOPER'];
const UNIT_ADMIN_TYPES = ['UNIDADE_ADMINISTRATIVO', 'UNIDADE_DIRETOR', 'UNIDADE_COORDENADOR_PEDAGOGICO'];

const item = (
  id: string,
  path: string,
  label: string,
  icon: LucideIcon,
  options: Omit<NavigationItem, 'id' | 'path' | 'label' | 'icon'> = {},
): NavigationItem => ({ id, path, label, icon, ...options });

/**
 * Manifesto único de navegação. A visibilidade é derivada do manifesto e do
 * usuário autenticado; páginas continuam protegidas pelo guard do roteador.
 */
export const NAVIGATION_MANIFEST: NavigationGroup[] = [
  {
    id: 'overview',
    title: 'Visão Geral',
    items: [
      item('dashboard', '/app/dashboard', 'Painel principal', LayoutDashboard, { levels: TEAM_LEVELS, capability: 'overview.read' }),
      item('teacher-dashboard', '/app/teacher-dashboard', 'Painel do professor', GraduationCap, { levels: TEAM_LEVELS, capability: 'overview.read' }),
      item('unit-dashboard', '/app/unidade', 'Painel da unidade', Building2, { levels: MANAGEMENT_LEVELS, capability: 'overview.read' }),
      item('director-dashboard', '/app/diretor', 'Painel do diretor', Shield, { levels: ['UNIDADE', 'MANTENEDORA', 'DEVELOPER'], types: ['UNIDADE_DIRETOR'], capability: 'overview.read' }),
      item('coordination-dashboard', '/app/coordenacao-pedagogica', 'Painel da coordenação', PanelTop, { levels: MANAGEMENT_LEVELS, types: ['UNIDADE_COORDENADOR_PEDAGOGICO'], capability: 'overview.read' }),
      item('central-dashboard', '/app/central', 'Análises centrais', Network, { levels: NETWORK_LEVELS, capability: 'overview.read' }),
      item('general-coordination', '/app/coordenacao-geral', 'Coordenação geral', Network, { levels: NETWORK_LEVELS, capability: 'overview.read' }),
      item('psychology-dashboard', '/app/psicologo', 'Psicologia', Stethoscope, { levels: NETWORK_LEVELS, types: ['STAFF_CENTRAL_PSICOLOGIA'], capability: 'overview.read' }),
      item('nutrition-dashboard', '/app/nutricionista', 'Nutrição', Utensils, { levels: ['UNIDADE', 'MANTENEDORA', 'DEVELOPER'], types: ['UNIDADE_NUTRICIONISTA'], capability: 'overview.read' }),
      item('secretariat-dashboard', '/app/secretaria', 'Secretaria', UserCheck, { levels: ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'], types: UNIT_ADMIN_TYPES, capability: 'overview.read' }),
      item('command-center', '/app/onda2', 'Command Center', Network, { levels: MANAGEMENT_LEVELS, capability: 'overview.read' }),
      item('coverage-metrics', '/app/metricas-cobertura', 'Cobertura', BarChart3, { levels: MANAGEMENT_LEVELS, capability: 'overview.read' }),
    ],
  },
  {
    id: 'pedagogy',
    title: 'Coordenação Pedagógica',
    items: [
      item('planning-list', '/app/planejamentos', 'Planejamentos', BookOpen, { levels: TEAM_LEVELS, capability: 'pedagogy.read' }),
      item('daily-planning', '/app/planejamento-diario', 'Planejamento diário', ClipboardList, { levels: TEAM_LEVELS, capability: 'pedagogy.read' }),
      item('daily-diary', '/app/diario-calendario', 'Diário', ClipboardList, { levels: TEAM_LEVELS, capability: 'pedagogy.write' }),
      item('logbook', '/app/diario-de-bordo', 'Diário de bordo', ClipboardCheck, { levels: TEAM_LEVELS, capability: 'pedagogy.write' }),
      item('teacher-plan-create', '/app/planejamento/novo', 'Criar plano de aula', BookOpen, { levels: TEACHER_LEVELS, capability: 'pedagogy.write', badge: 'Professor' }),
      item('curriculum-matrix', '/app/matriz-pedagogica', 'Matriz pedagógica', Layers3, { levels: TEAM_LEVELS, capability: 'pedagogy.read' }),
      item('coordination', '/app/coordenacao', 'Turmas e reuniões', Users, { levels: MANAGEMENT_LEVELS, capability: 'pedagogy.read' }),
      item('review', '/app/rdic-coord', 'Revisão pedagógica', Brain, { levels: MANAGEMENT_LEVELS, capability: 'pedagogy.read' }),
      item('review-hub', '/app/review-hub', 'Central de revisão', Layers3, { levels: MANAGEMENT_LEVELS, capability: 'pedagogy.read' }),
      item('child-development', '/app/rdic-crianca', 'Desenvolvimento', Brain, { levels: TEAM_LEVELS, capability: 'pedagogy.read' }),
      item('ria', '/app/rdic-ria', 'Registros de desenvolvimento', Brain, { levels: TEAM_LEVELS, capability: 'pedagogy.write' }),
      item('general-reports', '/app/rdic-geral', 'Relatórios gerais', FileText, { levels: NETWORK_LEVELS, capability: 'pedagogy.read' }),
      item('reports', '/app/reports', 'Relatórios', BarChart3, { levels: TEAM_LEVELS, capability: 'pedagogy.read' }),
      item('intelligence', '/app/inteligencia', 'Inteligência', Sparkles, { levels: MANAGEMENT_LEVELS, capability: 'pedagogy.read' }),
      item('classroom-photos', '/app/rdx', 'Fotos da turma', Camera, { levels: TEAM_LEVELS, capability: 'pedagogy.write' }),
      item('virtual-classroom', '/app/sala-de-aula-virtual', 'Sala de aula virtual', Sparkles, { levels: TEAM_LEVELS, capability: 'pedagogy.read' }),
      item('teacher-ranking', '/app/ranking-preenchimento', 'Ranking', Trophy, { levels: TEAM_LEVELS, capability: 'pedagogy.read' }),
      item('official-profiles', '/app/rdic-perfis', 'Perfis documentais', FileText, { levels: ['MANTENEDORA', 'DEVELOPER'], capability: 'pedagogy.read', badge: 'Oficial' }),
    ],
  },
  {
    id: 'care',
    title: 'Cuidado',
    items: [
      item('care-overview', '/app/cuidado', 'Visão de cuidado', HeartPulse, { levels: TEAM_LEVELS, capability: 'care.read' }),
      item('allergies', '/app/painel-alergias', 'Alergias e dietas', Apple, { levels: TEAM_LEVELS, capability: 'care.read' }),
      item('child-care-analysis', '/app/desenvolvimento-infantil', 'Acompanhamento infantil', HeartHandshake, { levels: NETWORK_LEVELS, capability: 'care.read' }),
    ],
  },
  {
    id: 'family',
    title: 'Famílias e LGPD',
    items: [
      item('family-links', '/app/familia/vinculos', 'Vínculos e consentimentos', HeartHandshake, { levels: MANAGEMENT_LEVELS, capability: 'family.manage', badge: 'LGPD' }),
      item('family-attendances', '/app/atendimentos-pais', 'Atendimentos dos pais', MessageCircle, { levels: TEAM_LEVELS, capability: 'family.read' }),
      item('family-timeline', '/app/timeline-familiar', 'Timeline da criança', HeartPulse, { levels: ['FAMILIA', ...TEAM_LEVELS], capability: 'family.read' }),
      item('family-circle', '/app/family-circle', 'Family Circle', MessageCircle, { levels: ['FAMILIA', ...TEAM_LEVELS], capability: 'family.read' }),
    ],
  },
  {
    id: 'materials',
    title: 'Materiais e Compras',
    items: [
      item('material-requests', '/app/material-requests', 'Requisições de materiais', ShoppingCart, { levels: TEAM_LEVELS, capability: 'materials.read' }),
      item('purchase-orders', '/app/pedidos-compra', 'Pedidos de compra', ShoppingBag, { levels: MANAGEMENT_LEVELS, capability: 'materials.manage' }),
      item('catalog-import', '/app/catalog-import', 'Catálogo de produtos', PackageOpen, { levels: ['UNIDADE', 'MANTENEDORA', 'DEVELOPER'], capability: 'materials.manage' }),
      item('material-consumption', '/app/relatorio-consumo-materiais', 'Consumo de materiais', BarChart3, { levels: MANAGEMENT_LEVELS, capability: 'materials.read' }),
      item('material-consumption-dashboard', '/app/dashboard-consumo-materiais', 'Gráficos de consumo', BarChart3, { levels: MANAGEMENT_LEVELS, capability: 'materials.read' }),
      item('nutrition-orders', '/app/nutricionista?s=pedidos', 'Pedidos de nutrição', ShoppingCart, { levels: ['UNIDADE', 'MANTENEDORA', 'DEVELOPER'], types: ['UNIDADE_NUTRICIONISTA'], capability: 'materials.read' }),
    ],
  },
  {
    id: 'administration',
    title: 'Administração',
    items: [
      item('users', '/app/admin/usuarios', 'Usuários', Users, { levels: MANAGEMENT_LEVELS, capability: 'admin.read' }),
      item('units', '/app/admin/unidades', 'Unidades', Building2, { levels: NETWORK_LEVELS, capability: 'admin.write' }),
      item('classrooms', '/app/admin/turmas', 'Turmas', GraduationCap, { levels: MANAGEMENT_LEVELS, capability: 'admin.write' }),
      item('secretariat-enrollments', '/app/secretaria/matriculas', 'Matrículas e fichas', UserCheck, { levels: ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'], types: UNIT_ADMIN_TYPES, capability: 'admin.write' }),
      item('new-enrollment', '/app/secretaria/matriculas/nova', 'Nova matrícula', UserCheck, { levels: ['UNIDADE', 'MANTENEDORA', 'DEVELOPER'], types: UNIT_ADMIN_TYPES, capability: 'admin.write' }),
      item('staff', '/app/secretaria/funcionarios', 'Funcionários', Users, { levels: ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'], types: UNIT_ADMIN_TYPES, capability: 'admin.read' }),
      item('secretariat-movements', '/app/secretaria/movimentacoes', 'Movimentações', FileArchive, { levels: ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'], types: UNIT_ADMIN_TYPES, capability: 'admin.write' }),
      item('secretariat-documents', '/app/secretaria/atestados', 'Atestados e documentos', FolderCheck, { levels: ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'], types: UNIT_ADMIN_TYPES, capability: 'admin.read' }),
      item('secretariat-absences', '/app/secretaria/faltas', 'Controle de faltas', ClipboardList, { levels: ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'], types: UNIT_ADMIN_TYPES, capability: 'admin.read' }),
      item('secretariat-occurrences', '/app/secretaria/ocorrencias', 'Saúde e ocorrências', HeartPulse, { levels: ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'], types: UNIT_ADMIN_TYPES, capability: 'admin.read' }),
      item('secretariat-communication', '/app/secretaria/comunicacao', 'Comunicados', Bell, { levels: ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'], types: UNIT_ADMIN_TYPES, capability: 'admin.write' }),
      item('transport', '/app/secretaria/transporte', 'Transporte e retirada', Bus, { levels: ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'], types: UNIT_ADMIN_TYPES, capability: 'admin.read' }),
      item('finance', '/app/financeiro', 'Financeiro e ponto', BarChart3, { levels: ['UNIDADE', 'STAFF_CENTRAL', 'MANTENEDORA', 'DEVELOPER'], capability: 'admin.read' }),
      item('settings', '/app/configuracoes', 'Configurações', Settings, { levels: ['FAMILIA', ...TEAM_LEVELS], capability: 'admin.read' }),
      item('profile', '/app/meu-perfil', 'Meu perfil', UserCircle, { levels: ['FAMILIA', ...TEAM_LEVELS], capability: 'admin.read' }),
    ],
  },
  {
    id: 'operations',
    title: 'Operação',
    items: [
      item('attendance', '/app/chamada', 'Chamada', ClipboardCheck, { levels: TEAM_LEVELS, capability: 'operations.write' }),
      item('planning-calendar', '/app/planejamentos-calendario', 'Calendário pedagógico', ClipboardList, { levels: TEAM_LEVELS, capability: 'operations.read' }),
      item('mobile', '/app/mobile/chamada', 'App mobile (PWA)', PanelTop, { levels: TEAM_LEVELS, capability: 'operations.read', badge: 'PWA' }),
    ],
  },
];

function featureFlagsFromUser(user: User | null): Set<string> {
  const raw = user?.featureFlags ?? user?.flags;
  if (Array.isArray(raw)) return new Set(raw.filter((flag): flag is string => typeof flag === 'string'));
  if (raw && typeof raw === 'object') {
    return new Set(Object.entries(raw as Record<string, unknown>).filter(([, enabled]) => enabled === true).map(([flag]) => flag));
  }
  return new Set();
}

function matchesRole(user: User | null, navItem: NavigationItem): boolean {
  if (!user) return false;
  const levels = normalizeRoles(user);
  const types = normalizeRoleTypes(user);
  if (levels.includes('DEVELOPER')) return true;
  const hasLevel = !navItem.levels?.length || navItem.levels.some((level) => levels.includes(level));
  const hasType = !navItem.types?.length || navItem.types.some((type) => types.includes(type));
  return hasLevel && hasType;
}

export function isNavigationItemVisible(user: User | null, navItem: NavigationItem): boolean {
  if (!matchesRole(user, navItem)) return false;
  if (!navItem.featureFlag) return true;
  return featureFlagsFromUser(user).has(navItem.featureFlag);
}

export function getNavigationGroups(user: User | null): NavigationGroup[] {
  return NAVIGATION_MANIFEST
    .filter((group) => !group.featureFlag || featureFlagsFromUser(user).has(group.featureFlag))
    .map((group) => ({
      ...group,
      items: group.items.filter((navItem) => isNavigationItemVisible(user, navItem)),
    }))
    .filter((group) => group.items.length > 0);
}

export function navigationItemMatchesPath(pathname: string, search: string, itemPath: string, exact = false): boolean {
  const [itemPathname, itemSearch] = itemPath.split('?');
  if (itemSearch) {
    if (pathname !== itemPathname) return false;
    const expected = new URLSearchParams(itemSearch);
    const current = new URLSearchParams(search);
    for (const [key, value] of expected.entries()) if (current.get(key) !== value) return false;
    return true;
  }
  const isPathMatch = exact
    ? pathname === itemPathname
    : pathname === itemPathname || pathname.startsWith(`${itemPathname}/`);
  if (!isPathMatch) return false;
  return !new URLSearchParams(search).has('s') || !itemPathname.endsWith('/nutricionista');
}

export function getActiveNavigationGroupId(groups: NavigationGroup[], pathname: string, search: string): string | null {
  return groups.find((group) => group.items.some((navItem) => navigationItemMatchesPath(pathname, search, navItem.path, navItem.exact)))?.id ?? null;
}
