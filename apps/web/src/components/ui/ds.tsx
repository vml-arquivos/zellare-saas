/**
 * ds.tsx — Design System Unificado do Zelare
 *
 * Componentes premium reutilizáveis para todos os painéis.
 * Identidade visual única: limpa, precisa, sem ornamento desnecessário.
 *
 * Uso: import { Card, KpiCard, StatRow, Badge, SectionHeader, TabBar, EmptyData } from '@/components/ui/ds'
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2, AlertTriangle, CheckCircle, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Card base ────────────────────────────────────────────────────────────────
export function Card({
  children, className, onClick, padding = true,
}: { children: React.ReactNode; className?: string; onClick?: () => void; padding?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'ds-card',
        padding && 'p-4',
        onClick && 'ds-card-interactive',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── KPI Card premium ─────────────────────────────────────────────────────────
type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
const TONE_STYLES: Record<Tone, { bg: string; text: string; sub: string; icon: string; border: string }> = {
  default: { bg: 'bg-[var(--surface-inset)]', text: 'text-[var(--text-primary)]', sub: 'text-[var(--text-tertiary)]', icon: 'text-[var(--text-secondary)]', border: 'border-[var(--border-default)]' },
  success: { bg: 'bg-[var(--success-bg)]', text: 'text-[var(--success)]', sub: 'text-[var(--success)]', icon: 'text-[var(--success)]', border: 'border-[var(--success-border)]' },
  warning: { bg: 'bg-[var(--warning-bg)]', text: 'text-[var(--warning)]', sub: 'text-[var(--warning)]', icon: 'text-[var(--warning)]', border: 'border-[var(--warning-border)]' },
  danger: { bg: 'bg-[var(--error-bg)]', text: 'text-[var(--error)]', sub: 'text-[var(--error)]', icon: 'text-[var(--error)]', border: 'border-[var(--error-border)]' },
  info: { bg: 'bg-[var(--info-bg)]', text: 'text-[var(--info)]', sub: 'text-[var(--info)]', icon: 'text-[var(--info)]', border: 'border-[var(--info-border)]' },
  purple: { bg: 'bg-[var(--surface-brand)]', text: 'text-[var(--text-brand)]', sub: 'text-[var(--text-brand-soft)]', icon: 'text-[var(--text-brand-soft)]', border: 'border-[var(--border-brand)]' },
};

export function KpiCard({
  label, value, icon, helper, tone = 'default', trend, onClick,
}: {
  label: string; value: string | number; icon: React.ReactNode;
  helper?: string; tone?: Tone; trend?: 'up' | 'down' | 'flat'; onClick?: () => void;
}) {
  const s = TONE_STYLES[tone];
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  return (
    <div
      onClick={onClick}
      className={cn(
        'ds-kpi', s.bg, s.border,
        onClick && 'cursor-pointer hover:brightness-[0.98] active:scale-[0.98] transition-transform duration-150',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2 rounded-xl bg-[var(--surface-base)]/70', s.icon)}>{icon}</div>
        {trend && <TrendIcon className={cn('h-3.5 w-3.5', s.sub)} />}
      </div>
      <p className={cn('text-2xl font-medium tabular-nums leading-none', s.text)}>{value}</p>
      <p className={cn('text-xs mt-1.5 font-normal', s.sub)}>{label}</p>
      {helper && <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{helper}</p>}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, string> = {
  success: 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)]',
  danger: 'bg-[var(--error-bg)] text-[var(--error)] border-[var(--error-border)]',
  info: 'bg-[var(--info-bg)] text-[var(--info)] border-[var(--info-border)]',
  purple: 'bg-[var(--surface-brand)] text-[var(--text-brand)] border-[var(--border-brand)]',
  default: 'bg-[var(--surface-inset)] text-[var(--text-secondary)] border-[var(--border-default)]',
};
export function Badge({ label, variant = 'default' }: { label: string; variant?: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', BADGE_STYLES[variant] ?? BADGE_STYLES.default)}>
      {label}
    </span>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
export function SectionHeader({
  title, icon, action, badge,
}: { title: string; icon?: React.ReactNode; action?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <div className="text-[var(--text-tertiary)] flex-shrink-0">{icon}</div>}
        <h2 className="text-sm font-medium text-[var(--text-primary)] truncate">{title}</h2>
        {badge}
      </div>
      {action}
    </div>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────
export function TabBar<T extends string>({
  tabs, active, onChange, extra,
}: {
  tabs: Array<{ id: T; label: string; icon?: React.ReactNode; badge?: number }>;
  active: T; onChange: (id: T) => void; extra?: React.ReactNode;
}) {
  return (
    <div className="ds-tab-bar">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn('ds-tab', active === t.id && 'ds-tab-active')}
        >
          {t.icon}
          {t.label}
          {t.badge != null && t.badge > 0 && (
            <span className="ml-1 min-w-[18px] h-[18px] px-1 bg-[var(--error)] text-[var(--text-inverse)] text-[10px] font-medium rounded-full flex items-center justify-center">
              {t.badge}
            </span>
          )}
        </button>
      ))}
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );
}

// ─── Barra de progresso ───────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'blue', showLabel = true }: {
  value: number; max?: number; color?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple'; showLabel?: boolean;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const COLORS = {
    blue: 'bg-[var(--brand-600)]',
    emerald: 'bg-[var(--success)]',
    amber: 'bg-[var(--warning)]',
    red: 'bg-[var(--error)]',
    purple: 'bg-[var(--accent-violet)]',
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--surface-muted)] rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', COLORS[color])} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums w-8 text-right">{pct}%</span>}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function EmptyData({ label = 'Sem dados disponíveis' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-2xl bg-[var(--surface-inset)] border border-[var(--border-subtle)] flex items-center justify-center mb-3">
        <Info className="h-5 w-5 text-[var(--text-disabled)]" />
      </div>
      <p className="text-sm text-[var(--text-tertiary)]">{label}</p>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('ds-loading', className)} />;
}
export function SkeletonGrid({ n = 4, cols = 4 }: { n?: number; cols?: number }) {
  return (
    <div className={cn('grid gap-3', `grid-cols-2 sm:grid-cols-${cols}`)}>
      {Array.from({ length: n }).map((_, i) => <SkeletonBlock key={i} className="h-24" />)}
    </div>
  );
}

// ─── Alert banner ─────────────────────────────────────────────────────────────
export function AlertBanner({ type, children }: { type: 'warning' | 'danger' | 'info' | 'success'; children: React.ReactNode }) {
  const styles = {
    warning: 'bg-[var(--warning-bg)] border-[var(--warning-border)] text-[var(--warning)]',
    danger: 'bg-[var(--error-bg)] border-[var(--error-border)] text-[var(--error)]',
    info: 'bg-[var(--info-bg)] border-[var(--info-border)] text-[var(--info)]',
    success: 'bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--success)]',
  };
  const Icon = type === 'danger' ? AlertTriangle : type === 'success' ? CheckCircle : Info;
  return (
    <div className={cn('flex items-start gap-2.5 p-3 rounded-xl border text-sm', styles[type])}>
      <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

// ─── Stat row (linha horizontal de dado) ─────────────────────────────────────
export function StatRow({ label, value, sub, action }: {
  label: string; value: string | number; sub?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-[var(--text-secondary)] truncate">{label}</p>
        {sub && <p className="text-xs text-[var(--text-tertiary)] truncate">{sub}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">{value}</span>
        {action}
      </div>
    </div>
  );
}

// ─── Loading spinner inline ───────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' };
  return <Loader2 className={cn('animate-spin text-[var(--text-tertiary)]', sizes[size])} />;
}
