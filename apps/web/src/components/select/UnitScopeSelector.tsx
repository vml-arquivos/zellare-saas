import { useUnitScope } from '../../contexts/UnitScopeContext';
import { Building2, LockKeyhole, Network } from 'lucide-react';

interface UnitScopeSelectorProps {
  showNetworkOption?: boolean;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export function UnitScopeSelector({
  showNetworkOption = true,
  placeholder = 'Selecione uma unidade',
  className = '',
  compact = false,
}: UnitScopeSelectorProps) {
  const {
    selectedUnitId,
    accessibleUnits,
    unitsLoading,
    setUnit,
    unitSelectionLocked,
    requiresExplicitUnitSelection,
  } = useUnitScope();

  if (unitsLoading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-[var(--text-tertiary)] ${className}`} aria-live="polite">
        <Building2 className="h-4 w-4 animate-pulse" aria-hidden="true" />
        <span>Carregando unidades...</span>
      </div>
    );
  }

  const effectiveShowNetwork = showNetworkOption && !unitSelectionLocked && !requiresExplicitUnitSelection;
  const selectionRequired = requiresExplicitUnitSelection && !selectedUnitId;

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="unit-scope-selector">
      {!compact && (
        <label htmlFor="global-unit-scope" className="flex items-center gap-1 whitespace-nowrap text-sm font-medium text-[var(--text-secondary)]">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          Unidade:
        </label>
      )}
      <select
        id="global-unit-scope"
        value={selectedUnitId ?? ''}
        onChange={(event) => setUnit(event.target.value || null)}
        aria-required={selectionRequired}
        aria-label={selectionRequired ? 'Selecione uma unidade para iniciar' : 'Unidade ativa'}
        className="min-w-[200px] max-w-[320px] rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={unitSelectionLocked}
      >
        {effectiveShowNetwork && <option value="">Rede (todas as unidades)</option>}
        {!selectedUnitId && !effectiveShowNetwork && <option value="" disabled>{placeholder}</option>}
        {accessibleUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
      </select>
      {unitSelectionLocked && <LockKeyhole className="h-4 w-4 text-[var(--text-tertiary)]" aria-label="Unidade fixa pelo perfil" />}
      {selectedUnitId && !unitSelectionLocked && (
        <button type="button" onClick={() => setUnit(null)} title="Ver rede completa" aria-label="Ver rede completa" className="rounded-lg p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-brand)] hover:text-[var(--text-brand)]">
          <Network className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
