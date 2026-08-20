import React from 'react';
import { BookOpen, ClipboardList, FileText } from 'lucide-react';
import { KPIGrid } from './KPIGrid';
import { AtalhosExecutivos } from './AtalhosExecutivos';

interface ModuloAvaliacaoPlanoProps {
  // KPI props
  totalPendencias: number;
  diariosEstaSemana: number;
  diariosPublicados: number;
  diariosRascunho: number;
  
  // Atalhos
  atalhosAvaliacao: any[];
  
  // Ações pendentes
  planejamentosParaRevisar: number;
  diariosEmRascunho: number;
  
  // Handlers
  onPendenciasClick: () => void;
  onDiariosClick: () => void;
  onAtalhoClick: (atalho: any) => void;
  onPlanejamentosClick: () => void;
  onDiariosRascunhoClick: () => void;
}

/**
 * ModuloAvaliacaoPlano - Módulo 1: Avaliação do Plano
 * Agrupa KPIs, atalhos e ações relacionadas a planejamentos e diários
 */
export function ModuloAvaliacaoPlano({
  totalPendencias,
  diariosEstaSemana,
  diariosPublicados,
  diariosRascunho,
  atalhosAvaliacao,
  planejamentosParaRevisar,
  diariosEmRascunho,
  onPendenciasClick,
  onDiariosClick,
  onAtalhoClick,
  onPlanejamentosClick,
  onDiariosRascunhoClick,
}: ModuloAvaliacaoPlanoProps) {
  return (
    <div className="space-y-4">
      {/* Heading do módulo */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 bg-[var(--accent-violet)] rounded-full" />
        <h2 className="text-lg font-normal text-[var(--text-primary)]">Avaliação do Plano</h2>
        <p className="text-sm text-[var(--text-secondary)] ml-auto">Planejamentos, diários e execução</p>
      </div>

      {/* KPI: Pendências + Diários */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        {/* Pendências */}
        <button
          onClick={onPendenciasClick}
          className="ds-card p-4 text-left hover:bg-[var(--surface-card-hover)] transition-colors group"
        >
          <p className="text-[11px] font-normal uppercase tracking-[0.15em] text-[var(--text-tertiary)]">Pendências</p>
          <p className="mt-1.5 text-3xl font-normal text-[var(--accent-violet)] group-hover:text-[var(--text-brand)] transition-colors">{totalPendencias}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">planejamentos · diários</p>
          <p className="mt-2 text-[10px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]">Ver detalhes →</p>
        </button>

        {/* Diários */}
        <button
          onClick={onDiariosClick}
          className="ds-card p-4 text-left hover:bg-[var(--surface-card-hover)] transition-colors group"
        >
          <p className="text-[11px] font-normal uppercase tracking-[0.15em] text-[var(--text-tertiary)]">Diários</p>
          <p className="mt-1.5 text-3xl font-normal text-[var(--accent-cyan)] group-hover:text-[var(--text-brand)] transition-colors">{diariosEstaSemana ?? 0}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{diariosPublicados} publicados · {diariosRascunho} rascunho(s)</p>
          <p className="mt-2 text-[10px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]">Analisar →</p>
        </button>
      </div>

      {/* Atalhos: Planejamentos, Diários, Relatórios */}
      <AtalhosExecutivos items={atalhosAvaliacao} />

      {/* Ações pendentes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {planejamentosParaRevisar > 0 && (
          <button
            onClick={onPlanejamentosClick}
            className="ds-surface flex items-center gap-3 p-4 rounded-2xl text-left hover:bg-[var(--surface-card-hover)] transition-all"
          >
            <span className="w-10 h-10 ds-icon-tile rounded-xl flex items-center justify-center text-lg font-normal flex-shrink-0">
              {planejamentosParaRevisar}
            </span>
            <div>
              <p className="text-sm font-normal text-[var(--text-primary)]">Planejamentos</p>
              <p className="text-xs text-[var(--warning)]">aguardando revisão</p>
            </div>
          </button>
        )}
        
        {diariosEmRascunho > 0 && (
          <button
            onClick={onDiariosRascunhoClick}
            className="ds-surface flex items-center gap-3 p-4 rounded-2xl text-left hover:bg-[var(--surface-card-hover)] transition-all"
          >
            <span className="w-10 h-10 ds-icon-tile rounded-xl flex items-center justify-center text-lg font-normal flex-shrink-0">
              {diariosEmRascunho}
            </span>
            <div>
              <p className="text-sm font-normal text-[var(--text-primary)]">Diários</p>
              <p className="text-xs text-[var(--text-brand-soft)]">em rascunho</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
