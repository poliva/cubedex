import { describe, expect, it } from 'vitest';
import { buildStatsGraphSeries } from '../../src/lib/charts';

describe('buildStatsGraphSeries', () => {
  it('keeps Ao5/Ao12 execution-only while exposing recognition separately', () => {
    const series = buildStatsGraphSeries([
      { executionMs: 1000, recognitionMs: null, totalMs: 1000 },
      { executionMs: 2000, recognitionMs: 500, totalMs: 2500 },
      { executionMs: 3000, recognitionMs: 700, totalMs: 3700 },
      { executionMs: 4000, recognitionMs: null, totalMs: 4000 },
      { executionMs: 5000, recognitionMs: 900, totalMs: 5900 },
    ]);

    expect(series.labels).toEqual(['1', '2', '3', '4', '5']);
    expect(series.executionTimesInSeconds).toEqual([1, 2, 3, 4, 5]);
    expect(series.recognitionTimesInSeconds).toEqual([null, 0.5, 0.7, null, 0.9]);
    expect(series.ao5).toEqual([null, null, null, null, 3]);
    expect(series.ao12).toEqual([null, null, null, null, null]);
  });
});
