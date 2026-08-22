import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import {
  getActiveNavigationGroupId,
  getNavigationGroups,
  navigationItemMatchesPath,
  type NavigationGroup,
  type NavigationItem,
} from './navigationManifest';

interface SidebarProps {
  onClose?: () => void;
}

const OPEN_GROUPS_KEY = 'zelare:navigation:open-groups';

function readOpenGroups(): string[] {
  try {
    const raw = sessionStorage.getItem(OPEN_GROUPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function isActive(location: ReturnType<typeof useLocation>, navItem: NavigationItem) {
  return navigationItemMatchesPath(location.pathname, location.search, navItem.path, navItem.exact);
}

function NavigationLink({ item, location, onNavigate }: { item: NavigationItem; location: ReturnType<typeof useLocation>; onNavigate?: () => void }) {
  const active = isActive(location, item);
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      data-testid={`nav-item-${item.id}`}
      className={`group flex min-h-10 items-center justify-between gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] ${
        active
          ? 'bg-[var(--surface-brand)] text-[var(--text-primary)] shadow-ds-glow'
          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-inset)] hover:text-[var(--text-primary)]'
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-[var(--text-brand)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]'}`} aria-hidden="true" />
        <span className="truncate">{item.label}</span>
      </span>
      {item.badge && (
        <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
          active ? 'bg-[var(--brand-600)] text-[var(--text-inverse)]' : 'bg-[var(--surface-brand)] text-[var(--text-brand-soft)]'
        }`}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function NavigationGroupView({
  group,
  open,
  active,
  onToggle,
  location,
  onNavigate,
}: {
  group: NavigationGroup;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  location: ReturnType<typeof useLocation>;
  onNavigate?: () => void;
}) {
  return (
    <section className="space-y-1" data-testid={`nav-group-${group.id}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`nav-group-content-${group.id}`}
        data-testid={`nav-group-toggle-${group.id}`}
        className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] ${
          active ? 'text-[var(--text-brand)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-inset)] hover:text-[var(--text-primary)]'
        }`}
      >
        <span className="flex-1 truncate">{group.title}</span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div id={`nav-group-content-${group.id}`} hidden={!open} className="space-y-0.5 pl-1">
        {group.items.map((item) => <NavigationLink key={item.id} item={item} location={location} onNavigate={onNavigate} />)}
      </div>
    </section>
  );
}

export function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const groups = useMemo(() => getNavigationGroups(user), [user]);
  const activeGroupId = getActiveNavigationGroupId(groups, location.pathname, location.search);
  const [openGroups, setOpenGroups] = useState<string[]>(() => readOpenGroups());

  useEffect(() => {
    try { sessionStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(openGroups)); } catch { /* storage unavailable */ }
  }, [openGroups]);

  const visibleOpenGroups = useMemo(
    () => new Set(activeGroupId ? [...openGroups, activeGroupId] : openGroups),
    [activeGroupId, openGroups],
  );

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]);
  }

  const profileLabel = user?.roles?.some((role) => (typeof role === 'string' ? role === 'DEVELOPER' : role.level === 'DEVELOPER'))
    ? 'Desenvolvedor'
    : user?.nome || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Usuário';

  return (
    <aside className="zelare-sidebar relative flex h-full min-h-screen w-[var(--sidebar-width)] flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-sidebar)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]" data-testid="sidebar">
      <div className="border-b border-[var(--border-subtle)] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/app/dashboard" onClick={onClose} className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]" aria-label="Ir para o painel principal">
            <img
              src={import.meta.env.VITE_APP_LOGO_URL || '/brand/zelare-logo-square.png'}
              alt={import.meta.env.VITE_APP_NAME || 'Zelare'}
              className="h-9 w-auto flex-shrink-0 object-contain"
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
            />
            <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{import.meta.env.VITE_APP_NAME || 'Zelare'}</span>
          </Link>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--surface-inset)] hover:text-[var(--text-primary)] md:hidden" aria-label="Fechar menu">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Perfil ativo</p>
          <p className="mt-0.5 truncate text-sm font-medium text-[var(--text-primary)]">{profileLabel}</p>
          {user?.unit?.name && <p className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">{user.unit.name}</p>}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Navegação principal">
        {groups.map((group) => (
          <NavigationGroupView
            key={group.id}
            group={group}
            open={visibleOpenGroups.has(group.id)}
            active={activeGroupId === group.id}
            onToggle={() => toggleGroup(group.id)}
            location={location}
            onNavigate={onClose}
          />
        ))}
        {groups.length === 0 && <p className="px-3 py-6 text-center text-xs text-[var(--text-tertiary)]">Nenhum módulo disponível para este perfil.</p>}
      </nav>

      <div className="border-t border-[var(--border-subtle)] px-3 py-3">
        <p className="text-center text-[10px] text-[var(--text-tertiary)]">{import.meta.env.VITE_APP_NAME || 'Zelare'} © 2026</p>
      </div>
    </aside>
  );
}
