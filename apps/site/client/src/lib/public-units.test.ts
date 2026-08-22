import { describe, expect, it } from 'vitest';
import { getPublicUnitsLoadState } from './public-units';

describe('public units load state', () => {
  it('returns loading while the API request is pending', () => {
    expect(getPublicUnitsLoadState({ isLoading: true, error: null, units: undefined })).toEqual({
      kind: 'loading',
    });
  });

  it('returns real unavailability when the API fails', () => {
    expect(
      getPublicUnitsLoadState({ isLoading: false, error: new Error('network'), units: undefined }),
    ).toEqual({
      kind: 'unavailable',
      message: 'As unidades estão indisponíveis no momento.',
    });
  });

  it('returns empty only when the API succeeds without active units', () => {
    expect(getPublicUnitsLoadState({ isLoading: false, error: null, units: [] })).toEqual({
      kind: 'empty',
      message: 'Nenhuma unidade cadastrada para exibição.',
    });
  });

  it('returns ready for units supplied by the API', () => {
    expect(getPublicUnitsLoadState({ isLoading: false, error: null, units: [{ id: 1 }] })).toEqual({
      kind: 'ready',
    });
  });
});
