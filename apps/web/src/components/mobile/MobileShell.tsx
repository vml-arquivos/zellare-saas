/**
 * MobileShell — Layout PWA mobile-first
 *
 * - Header compacto com nome do usuário e botão de logout
 * - Bottom navigation com 5 módulos
 * - Banner de status offline
 * - Design limpo, sem nada do desktop
 */

import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  ClipboardList, BookOpen, Eye, HeartPulse, Package, Users,
  Wifi, WifiOff, RefreshCw, RotateCw, LogOut, Monitor, Moon, Sun,
} from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useAuth } from '../../app/AuthProvider';
import { useTheme } from '../../app/ThemeProvider';
import { hardRefreshPWA, BUILD_ID } from '../../lib/pwaUpdate';
import PwaInstallAction from './PwaInstallAction';

const NAV = [
  { path: '/app/mobile/chamada',    label: 'Chamada',    Icon: ClipboardList },
  { path: '/app/mobile/diario',     label: 'Diário',     Icon: BookOpen },
  { path: '/app/mobile/observacao', label: 'Observação', Icon: Eye },
  { path: '/app/mobile/ocorrencia', label: 'Ocorrência', Icon: HeartPulse },
  { path: '/app/mobile/alunos',     label: 'Alunos',     Icon: Users },
  { path: '/app/mobile/material',   label: 'Material',   Icon: Package },
];

// Considera a aba ativa também nas sub-rotas (ex.: /alunos/:childId → aba Alunos)
function isNavActive(path: string, pathname: string): boolean {
  if (pathname === path) return true;
  if (path === '/app/mobile/alunos') return pathname.startsWith('/app/mobile/alunos');
  return false;
}

export default function MobileShell() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { isOnline, queueCount, isSyncing, syncNow } = useOfflineSync();

  const nomeUsuario = (user as any)?.nome?.split(' ')[0]
    ?? (user as any)?.firstName
    ?? (user as any)?.email?.split('@')[0]
    ?? 'Professor(a)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', background: 'var(--surface-page)', color: 'var(--text-primary)',
      fontFamily: '"Inter","system-ui",sans-serif',
    }}>

      {/* ── Header compacto ─────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        paddingTop: 'max(10px, env(safe-area-inset-top))',
        background: 'var(--surface-topbar)',
        borderBottom: '0.5px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        flexShrink: 0,
      }}>
        {/* Logo + nome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--brand-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: 'var(--text-inverse)', fontSize: 14, fontWeight: 700 }}>Z</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Olá, {nomeUsuario}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.2 }}>
              Zelare · v{BUILD_ID}
            </p>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PwaInstallAction />

          {/* Atualizar app (força nova versão — destrava cache do PWA no iOS) */}
          <button
            type="button"
            onClick={() => {
              if (confirm('Atualizar o app para a versão mais recente? A tela vai recarregar.')) {
                hardRefreshPWA();
              }
            }}
            title="Atualizar app"
            style={{
              width: 38, height: 38, borderRadius: 11, border: '0.5px solid var(--border-default)',
              background: 'var(--surface-subtle)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-tertiary)',
            }}
          >
            <RotateCw size={16} />
          </button>

          {/* Alternância de tema */}
          <button
            type="button"
            onClick={toggleTheme}
            title={resolvedTheme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            aria-label={resolvedTheme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            aria-pressed={resolvedTheme === 'dark'}
            style={{
              width: 38, height: 38, borderRadius: 11, border: '0.5px solid var(--border-default)',
              background: 'var(--surface-subtle)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-tertiary)',
            }}
          >
            {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Botão versão desktop */}
          <button
            type="button"
            className="mobile-desktop-switch"
            onClick={() => navigate('/app/teacher-dashboard')}
            title="Versão desktop"
            style={{
              width: 38, height: 38, borderRadius: 11, border: '0.5px solid var(--border-default)',
              background: 'var(--surface-subtle)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-tertiary)',
            }}
          >
            <Monitor size={16} />
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={() => { logout?.(); navigate('/login'); }}
            title="Sair"
            style={{
              width: 34, height: 34, borderRadius: 10, border: '0.5px solid var(--error-border)',
              background: 'var(--error-bg)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--error)',
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Banner offline/sync ──────────────────────────────────── */}
      {(!isOnline || queueCount > 0) && (
        <div role="status" aria-live="polite" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 16px', flexShrink: 0,
          background: isOnline ? 'var(--warning-bg)' : 'var(--error-bg)',
          borderBottom: `0.5px solid ${isOnline ? 'var(--warning-border)' : 'var(--error-border)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isOnline
              ? <Wifi size={13} color="var(--warning)" />
              : <WifiOff size={13} color="var(--error)" />}
            <span style={{ fontSize: 12, color: isOnline ? 'var(--warning)' : 'var(--error)' }}>
              {isOnline
                ? `${queueCount} ação${queueCount !== 1 ? 'ões' : ''} aguardando envio`
                : `Sem conexão · ${queueCount} salva${queueCount !== 1 ? 's' : ''} localmente`}
            </span>
          </div>
          {isOnline && queueCount > 0 && (
            <button onClick={syncNow} disabled={isSyncing} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              color: 'var(--warning)', fontSize: 12, fontWeight: 500,
              opacity: isSyncing ? 0.6 : 1,
            }}>
              <RefreshCw size={12} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              Sincronizar
            </button>
          )}
        </div>
      )}

      {/* ── Conteúdo da página ───────────────────────────────────── */}
      <div className="mobile-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <Outlet />
      </div>

      {/* ── Bottom navigation ────────────────────────────────────── */}
      <nav aria-label="Navegação principal mobile" style={{
        display: 'flex',
        background: 'var(--surface-base)',
        borderTop: '0.5px solid var(--border-default)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: 'var(--shadow-lg)',
        flexShrink: 0,
      }}>
        {NAV.map(({ path, label, Icon }) => {
          const active = isNavActive(path, location.pathname);
          return (
            <button key={path} type="button" aria-current={active ? 'page' : undefined} onClick={() => navigate(path)} style={{
              flex: '1 1 0', minWidth: 48, minHeight: 60,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '7px 2px 8px',
              background: 'none', border: 'none', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              position: 'relative',
            }}>
              {/* Indicador ativo */}
              {active && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 32, height: 2.5, borderRadius: '0 0 4px 4px',
                  background: 'var(--accent-cyan)',
                }} />
              )}
              <div style={{
                width: 34, height: 34, borderRadius: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? 'var(--surface-brand)' : 'transparent',
                transition: 'background 0.15s',
              }}>
                <Icon
                  size={19}
                  strokeWidth={active ? 2.5 : 1.8}
                  color={active ? 'var(--text-brand-soft)' : 'var(--text-tertiary)'}
                />
              </div>
              <span style={{
                fontSize: 10, fontWeight: active ? 600 : 400,
                color: active ? 'var(--text-brand-soft)' : 'var(--text-tertiary)',
                letterSpacing: 0, lineHeight: 1, whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }\n        @media (max-width: 380px) { .mobile-desktop-switch { display: none !important; } }`}</style>
    </div>
  );
}
