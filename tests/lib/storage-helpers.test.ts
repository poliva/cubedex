import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALG_ID,
  STORAGE_KEYS,
  algToId,
  getAttemptHistory,
  getAttemptHistorySummary,
  createGlobalScopeId,
  createScopeId,
  createTimeAttackScopeId,
  expandNotation,
  getAlgorithmId,
  getReviewHistory,
  isTimeAttackScopeId,
  getSolveHistory,
  readOption,
  setLastTimes,
  setAttemptHistory,
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
    expect(createScopeId('OLL / ZBLL', 'Subset A', '')).toBe('case:OLL%20%2F%20ZBLL:Subset%20A:default-alg-id');
    expect(createGlobalScopeId("R U R'")).toBe('global:R-U-Rp');
    expect(createTimeAttackScopeId('OLL / ZBLL', ['case:b', 'case:a', 'case:a'])).toBe(
      'time-attack:OLL%20%2F%20ZBLL:case%3Aa%7Ccase%3Ab',
    );
  });

  it('marks global and time attack scopes as persistent', () => {
    expect(isTimeAttackScopeId('time-attack:PLL')).toBe(true);
    expect(isTimeAttackScopeId('case:PLL:A:pll-a')).toBe(false);
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

    expect(getAttemptHistory(scopeId)).toEqual([
      expect.objectContaining({
        executionMs: 1200,
        recognitionMs: null,
        totalMs: 1200,
        aborted: false,
        grade: null,
      }),
      expect.objectContaining({
        executionMs: 1500,
        recognitionMs: null,
        totalMs: 1500,
        aborted: false,
        grade: null,
      }),
    ]);
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

  it('derives solve and review selectors from canonical attempt history', () => {
    const scopeId = 'case:test:attempt-history';
    setAttemptHistory(scopeId, [
      {
        recordedAt: 1,
        mode: 'timer',
        executionMs: 1000,
        recognitionMs: 200,
        totalMs: 1200,
        hadMistake: false,
        aborted: false,
        timerOnly: true,
        grade: 'good',
      },
      {
        recordedAt: 2,
        mode: 'timer',
        executionMs: 800,
        recognitionMs: 150,
        totalMs: 950,
        hadMistake: true,
        aborted: true,
        timerOnly: true,
        grade: 'again',
      },
    ]);

    expect(getSolveHistory(scopeId)).toEqual([
      { executionMs: 1000, recognitionMs: 200, totalMs: 1200 },
    ]);
    expect(getReviewHistory(scopeId)).toEqual([
      {
        reviewedAt: 1,
        grade: 'good',
        mode: 'timer',
        executionMs: 1000,
        recognitionMs: 200,
        totalMs: 1200,
        hadMistake: false,
        aborted: false,
        timerOnly: true,
      },
      {
        reviewedAt: 2,
        grade: 'again',
        mode: 'timer',
        executionMs: 800,
        recognitionMs: 150,
        totalMs: 950,
        hadMistake: true,
        aborted: true,
        timerOnly: true,
      },
    ]);
    expect(getAttemptHistorySummary(scopeId).executionTimes).toEqual([1000]);
  });
});
