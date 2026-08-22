export type PublicUnitsLoadState =
  | { kind: 'loading' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'empty'; message: string }
  | { kind: 'ready' };

export function getPublicUnitsLoadState({
  isLoading,
  error,
  units,
}: {
  isLoading: boolean;
  error: unknown;
  units: readonly unknown[] | undefined;
}): PublicUnitsLoadState {
  if (isLoading) return { kind: 'loading' };
  if (error) {
    return {
      kind: 'unavailable',
      message: 'As unidades estão indisponíveis no momento.',
    };
  }
  if (!units || units.length === 0) {
    return {
      kind: 'empty',
      message: 'Nenhuma unidade cadastrada para exibição.',
    };
  }
  return { kind: 'ready' };
}
