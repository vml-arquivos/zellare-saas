import React from 'react';
import { Bell } from 'lucide-react';

interface PendenciasAlertProps {
  totalPendencias: number;
  planejamentosParaRevisar: number;
  requisicoesParaAnalisar: number;
}

/**
 * PendenciasAlert - Banner de pendências no topo
 * Mostra total de itens que precisam de atenção
 */
export function PendenciasAlert({
  totalPendencias,
  planejamentosParaRevisar,
  requisicoesParaAnalisar,
}: PendenciasAlertProps) {
  if (totalPendencias <= 0) {
    return null;
  }

  return (
    <div className="mb-4 ds-alert ds-alert-warning rounded-2xl flex items-center gap-3">
      <Bell className="h-6 w-6 text-[var(--warning)] flex-shrink-0" />
      <div>
        <p className="font-normal text-[var(--text-primary)]">
          {totalPendencias} {totalPendencias === 1 ? 'item precisa' : 'itens precisam'} da sua atenção
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          {planejamentosParaRevisar > 0 ? `${planejamentosParaRevisar} planejamento(s) para revisar` : ''}
          {planejamentosParaRevisar > 0 && requisicoesParaAnalisar > 0 ? ' · ' : ''}
          {requisicoesParaAnalisar > 0 ? `${requisicoesParaAnalisar} pedido(s) de material` : ''}
        </p>
      </div>
    </div>
  );
}
