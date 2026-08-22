import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAccessibleUnits } from '../api/lookup';
import type { AccessibleUnit } from '../types/lookup';
import { useAuth } from '../app/AuthProvider';
import { normalizeRoles } from '../app/RoleProtectedRoute';

export type ScopeMode = 'network' | 'unit';

export interface UnitContextSummary {
  unit: { id: string; name: string; code: string; city: string | null; state: string | null };
  counts: { classrooms: number; children: number; teachers: number; staff: number };
  recent: { plansPending: number; diariesThisWeek: number; rdicPublished: number };
}

interface UnitScopeContextType {
  selectedUnitId: string | null;
  scopeMode: ScopeMode;
  accessibleUnits: AccessibleUnit[];
  selectedUnit: AccessibleUnit | null;
  unitSummary: UnitContextSummary | null;
  summaryLoading: boolean;
  unitsLoading: boolean;
  /** Perfis de unidade/professor não podem trocar de unidade. */
  unitSelectionLocked: boolean;
  /** Coordenação central precisa iniciar por uma escolha explícita de unidade. */
  requiresExplicitUnitSelection: boolean;
  setUnit: (unitId: string | null) => void;
  setNetworkMode: () => void;
  refreshSummary: () => Promise<void>;
}

const UnitScopeContext = createContext<UnitScopeContextType | undefined>(undefined);
const LS_KEY = 'zelare:selectedUnitId';

function getUserUnitId(user: ReturnType<typeof useAuth>['user']): string | null {
  return user?.unitId ?? user?.unit?.id ?? null;
}

export function UnitScopeProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const roleLevels = useMemo(() => normalizeRoles(user), [user]);
  const userUnitId = getUserUnitId(user);
  const unitSelectionLocked = roleLevels.some((level) => level === 'UNIDADE' || level === 'PROFESSOR' || level === 'PROFESSOR_AUXILIAR');
  const isCentral = roleLevels.includes('STAFF_CENTRAL');
  const requiresExplicitUnitSelection = isCentral && !unitSelectionLocked;

  const [accessibleUnits, setAccessibleUnits] = useState<AccessibleUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitSummary, setUnitSummary] = useState<UnitContextSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedUnitId, setSelectedUnitIdState] = useState<string | null>(() => {
    if (unitSelectionLocked) return userUnitId;
    return searchParams.get('unitId');
  });

  useEffect(() => {
    if (unitSelectionLocked) {
      setSelectedUnitIdState(userUnitId);
      if (userUnitId) sessionStorage.setItem(LS_KEY, userUnitId);
      return;
    }
    if (authLoading) return;
    const fromUrl = searchParams.get('unitId');
    setSelectedUnitIdState(fromUrl);
    if (fromUrl) sessionStorage.setItem(LS_KEY, fromUrl);
    else sessionStorage.removeItem(LS_KEY);
  }, [authLoading, searchParams, unitSelectionLocked, userUnitId]);

  useEffect(() => {
    let cancelled = false;
    setUnitsLoading(true);
    getAccessibleUnits()
      .then((units) => {
        if (cancelled) return;
        setAccessibleUnits(units);
        const effectiveUnitId = unitSelectionLocked ? userUnitId : selectedUnitId;
        if (effectiveUnitId && !units.some((unit) => unit.id === effectiveUnitId)) {
          setSelectedUnitIdState(null);
          sessionStorage.removeItem(LS_KEY);
          if (searchParams.get('unitId')) {
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              next.delete('unitId');
              return next;
            }, { replace: true });
          }
        }
      })
      .catch(() => {
        if (!cancelled) setAccessibleUnits([]);
      })
      .finally(() => {
        if (!cancelled) setUnitsLoading(false);
      });
    return () => { cancelled = true; };
  // The selected unit is intentionally read from the current render while validating.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, unitSelectionLocked, userUnitId]);

  const loadSummary = useCallback(async (unitId: string) => {
    setSummaryLoading(true);
    try {
      const { default: http } = await import('../api/http');
      const response = await http.get('/coordenacao/unit-context/summary', { params: { unitId } });
      setUnitSummary(response.data as UnitContextSummary);
    } catch {
      setUnitSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUnitId) void loadSummary(selectedUnitId);
    else setUnitSummary(null);
  }, [selectedUnitId, loadSummary]);

  useEffect(() => {
    if (unitSelectionLocked && userUnitId && searchParams.get('unitId') !== userUnitId) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('unitId', userUnitId);
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, unitSelectionLocked, userUnitId]);

  const setUnit = useCallback((unitId: string | null) => {
    if (unitSelectionLocked) {
      if (!userUnitId || unitId !== userUnitId) return;
      unitId = userUnitId;
    }
    setSelectedUnitIdState(unitId);
    if (unitId) {
      sessionStorage.setItem(LS_KEY, unitId);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('unitId', unitId as string);
        return next;
      }, { replace: true });
    } else {
      sessionStorage.removeItem(LS_KEY);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('unitId');
        return next;
      }, { replace: true });
    }
  }, [setSearchParams, unitSelectionLocked, userUnitId]);

  const setNetworkMode = useCallback(() => {
    if (!unitSelectionLocked) setUnit(null);
  }, [setUnit, unitSelectionLocked]);

  const refreshSummary = useCallback(async () => {
    if (selectedUnitId) await loadSummary(selectedUnitId);
  }, [selectedUnitId, loadSummary]);

  const selectedUnit = useMemo(
    () => accessibleUnits.find((unit) => unit.id === selectedUnitId) ?? null,
    [accessibleUnits, selectedUnitId],
  );

  const value: UnitScopeContextType = {
    selectedUnitId,
    scopeMode: selectedUnitId ? 'unit' : 'network',
    accessibleUnits,
    selectedUnit,
    unitSummary,
    summaryLoading,
    unitsLoading,
    unitSelectionLocked,
    requiresExplicitUnitSelection,
    setUnit,
    setNetworkMode,
    refreshSummary,
  };

  return <UnitScopeContext.Provider value={value}>{children}</UnitScopeContext.Provider>;
}

// O arquivo também expõe o hook para manter a API de contexto estável entre páginas.
// eslint-disable-next-line react-refresh/only-export-components
export function useUnitScope(): UnitScopeContextType {
  const context = useContext(UnitScopeContext);
  if (!context) throw new Error('useUnitScope must be used within UnitScopeProvider');
  return context;
}
