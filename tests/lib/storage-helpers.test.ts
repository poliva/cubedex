import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALG_ID,
  STORAGE_KEYS,
  algToId,
  createAlgStorageKey,
  createGlobalScopeId,
  createScopeId,
  createTimeAttackScopeId,
  expandNotation,
  getAlgorithmId,
  isPersistentStatsScopeId,
  isTimeAttackScopeId,
  getSolveHistory,
  readJsonStorage,
  readOption,
  setLastTimes,
  setSolveHistory,
  writeOption,
} from '../../src/lib/storage';

describe('storage helpers', () => {
  it('normalizes notation and spacing', () => {
    expect(expandNotation("RUR´U2XYZ[FOO]")).toBe("R U R' U2 x y z (F)");
  });

  it('builds stable algorithm ids and falls back for blank algorithms', () => {
    expect(algToId("R U R'")).toBe('R-U-Rp');
    expect(getAlgorithmId(" R U R' ")).toBe('R-U-Rp');
    expect(getAlgorithmId('')).toBe(DEFAULT_ALG_ID);
  });

  it('creates storage keys and encoded scope ids', () => {
    expect(createAlgStorageKey('Best', 'pll-a')).toBe('Best-pll-a');
    expect(createScopeId('OLL / ZBLL', 'Subset A', '')).toBe('case:OLL%20%2F%20ZBLL:Subset%20A:default-alg-id');
    expect(createGlobalScopeId("R U R'")).toBe('global:R-U-Rp');
    expect(createTimeAttackScopeId('OLL / ZBLL', ['case:b', 'case:a', 'case:a'])).toBe(
      'time-attack:OLL%20%2F%20ZBLL:case%3Aa%7Ccase%3Ab',
    );
  });

  it('marks global and time attack scopes as persistent', () => {
    expect(isTimeAttackScopeId('time-attack:PLL')).toBe(true);
    expect(isTimeAttackScopeId('case:PLL:A:pll-a')).toBe(false);
    expect(isPersistentStatsScopeId('global:R-U-Rp')).toBe(true);
    expect(isPersistentStatsScopeId('time-attack:PLL')).toBe(true);
    expect(isPersistentStatsScopeId('case:PLL:A:pll-a')).toBe(false);
  });

  it('reads JSON from localStorage and returns the fallback for missing or invalid values', () => {
    localStorage.setItem('valid-json', JSON.stringify({ value: 42 }));
    localStorage.setItem('invalid-json', '{');

    expect(readJsonStorage('valid-json', { value: 0 })).toEqual({ value: 42 });
    expect(readJsonStorage('missing-json', { value: 7 })).toEqual({ value: 7 });
    expect(readJsonStorage('invalid-json', { value: 9 })).toEqual({ value: 9 });
  });

  it('reads and writes option values through storage keys', () => {
    writeOption('theme', 'dark');
    writeOption('controlPanel', 'bottom-row');

    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    expect(readOption('theme')).toBe('dark');
    expect(readOption('controlPanel')).toBe('bottom-row');
  });

  it('backfills legacy lastTimes into solve history with null recognition', () => {
    const scopeId = 'case:test:legacy';
    setLastTimes(scopeId, [1200, 1500]);

    expect(getSolveHistory(scopeId)).toEqual([
      { executionMs: 1200, recognitionMs: null, totalMs: 1200 },
      { executionMs: 1500, recognitionMs: null, totalMs: 1500 },
    ]);
  });

  it('preserves recognition and total values in solve history records', () => {
    const scopeId = 'case:test:recognition';
    setSolveHistory(scopeId, [
      { executionMs: 2100, recognitionMs: 400, totalMs: 2500 },
      { executionMs: 1900, recognitionMs: null, totalMs: 1900 },
    ]);

    expect(getSolveHistory(scopeId)).toEqual([
      { executionMs: 2100, recognitionMs: 400, totalMs: 2500 },
      { executionMs: 1900, recognitionMs: null, totalMs: 1900 },
    ]);
  });
});
