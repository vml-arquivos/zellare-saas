import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface Alerta {
  id: string;
  titulo: string;
  descricao?: string;
  canal?: 'OPERACIONAL' | 'ACOMPANHAMENTO' | string;
  prioridadeOperacional?: 'NORMAL' | 'URGENTE' | string;
}

interface AlertasSectionProps {
  loading?: boolean;
  alertasReais?: {
    total: number;
    criticos: Alerta[];
    atencao: Alerta[];
    urgentes?: Alerta[];
    acompanhamento?: Alerta[];
  } | null;
  alertasFallback?: string[];
}

/**
 * AlertasSection - Seção de alertas com loading state
 * Mostra alertas críticos e de atenção com fallback para alertas do dashboard
 */
export function AlertasSection({
  loading = false,
  alertasReais,
  alertasFallback = [],
}: AlertasSectionProps) {
  // Loading state
  if (loading) {
    return (
      <Card className="ds-card rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-normal flex items-center gap-2 text-[var(--text-primary)]">
            <AlertCircle className="h-5 w-5" />
            Atualizando alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-secondary)]">Carregando alertas da unidade e resumo de diários...</p>
        </CardContent>
      </Card>
    );
  }

  // Sem alertas reais e sem fallback
  if ((!alertasReais || alertasReais.total === 0) && alertasFallback.length === 0) {
    return null;
  }

  // Alertas reais do banco; sinais de acompanhamento nunca entram no bloco urgente.
  if (alertasReais && alertasReais.total > 0) {
    const urgentes = alertasReais.urgentes ?? [];
    const acompanhamento = alertasReais.acompanhamento ?? [
      ...(alertasReais.criticos ?? []),
      ...(alertasReais.atencao ?? []),
    ].filter(a => a.canal === 'ACOMPANHAMENTO');
    const urgenteIds = new Set(urgentes.map(a => a.id));
    const criticos = (alertasReais.criticos ?? []).filter(a => !urgenteIds.has(a.id) && a.canal !== 'ACOMPANHAMENTO');
    const atencao = (alertasReais.atencao ?? []).filter(a => !urgenteIds.has(a.id) && a.canal !== 'ACOMPANHAMENTO');

    return (
      <div className="space-y-2">
        {urgentes.length > 0 && (
          <div className="ds-alert ds-alert-error rounded-2xl p-4">
            <p className="text-sm font-normal text-[var(--error)] mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {urgentes.length} urgente{urgentes.length > 1 ? 's' : ''} operacional{urgentes.length > 1 ? 'is' : ''}
            </p>
            <ul className="space-y-1">
              {urgentes.map(a => (
                <li key={a?.id ?? a.titulo} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)] flex-shrink-0 mt-1.5" />
                  <span>
                    <strong className="font-normal text-[var(--text-primary)]">{a?.titulo}</strong>
                    {a?.descricao && ` — ${a.descricao}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {criticos.length > 0 && (
          <div className="ds-alert ds-alert-error rounded-2xl p-4">
            <p className="text-sm font-normal text-[var(--error)] mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {criticos.length} alerta{criticos.length > 1 ? 's' : ''} crítico{criticos.length > 1 ? 's' : ''}
            </p>
            <ul className="space-y-1">
              {criticos.map(a => (
                <li key={a?.id ?? a.titulo} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)] flex-shrink-0 mt-1.5" />
                  <span>
                    <strong className="font-normal text-[var(--text-primary)]">{a?.titulo}</strong>
                    {a?.descricao && ` — ${a.descricao}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {atencao.length > 0 && (
          <div className="ds-alert ds-alert-warning rounded-2xl p-4">
            <p className="text-sm font-normal text-[var(--warning)] mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {atencao.length} atenção
            </p>
            <ul className="space-y-1">
              {atencao.map(a => (
                <li key={a?.id ?? a.titulo} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] flex-shrink-0 mt-1.5" />
                  {a?.titulo}
                </li>
              ))}
            </ul>
          </div>
        )}

        {acompanhamento.length > 0 && (
          <div className="ds-alert ds-alert-info rounded-2xl p-4">
            <p className="text-sm font-normal text-[var(--text-secondary)] mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {acompanhamento.length} acompanhamento{acompanhamento.length > 1 ? 's' : ''} — revisão humana
            </p>
            <ul className="space-y-1">
              {acompanhamento.map(a => (
                <li key={a?.id ?? a.titulo} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] flex-shrink-0 mt-1.5" />
                  {a?.titulo}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Fallback: alertas do dashboard
  if (alertasFallback?.length > 0) {
    return (
      <div className="ds-alert ds-alert-warning rounded-2xl p-4">
        <p className="text-sm font-normal text-[var(--warning)] mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> Atenção hoje
        </p>
        <ul className="space-y-1">
          {alertasFallback.map((a, i) => (
            <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] flex-shrink-0 mt-1.5" />
              {String(a)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}
