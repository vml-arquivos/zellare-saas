import React from 'react';
import { ArrowRight } from 'lucide-react';

interface AtalhoItem {
  label: string;
  desc: string;
  icon: React.ReactNode;
  className: string;
  action: () => void;
}

interface AtalhosExecutivosProps {
  items: AtalhoItem[];
}

/**
 * AtalhosExecutivos - cards de navegação rápida no tema Zelare
 * Fornece acesso direto aos fluxos principais
 */
export function AtalhosExecutivos({ items }: AtalhosExecutivosProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {items?.map(item => (
        <button
          key={item.label}
          onClick={item.action}
          className="group ds-card p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
        >
          <div className="h-full">
            <div className="flex items-start justify-between gap-3">
              <div className="ds-icon-tile">
                {item.icon}
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--text-brand-soft)] transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-3 text-sm font-normal text-[var(--text-primary)]">{item.label}</p>
            <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{item.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
