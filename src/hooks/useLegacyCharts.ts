import { useEffect } from 'react';
import type { CaseCardData } from '../lib/legacy-algorithms';
import { createStatsGraph, createTimeGraph } from '../lib/legacy-charts';
import { averageOfFiveTimeNumber } from '../lib/legacy-algorithms';
import { algToId, getLastTimes } from '../lib/legacy-storage';

export function useLegacyCharts(currentCase: CaseCardData | null, displayAlg: string, statsAlgId: string, refreshToken: number | string = 0) {
  useEffect(() => {
    const timeCanvas = document.getElementById('timeGraph') as HTMLCanvasElement | null;
    const statsCanvas = document.getElementById('statsGraph') as HTMLCanvasElement | null;

    const algId = statsAlgId || (currentCase ? algToId(currentCase.algorithm) || 'default-alg-id' : '');

    if (!algId) {
      createTimeGraph(timeCanvas, []);
      createStatsGraph(statsCanvas, []);
      return;
    }

    const lastTimes = getLastTimes(algId);

    createTimeGraph(timeCanvas, lastTimes.slice(-5));
    createStatsGraph(statsCanvas, lastTimes);

    void averageOfFiveTimeNumber(algId);
  }, [currentCase, displayAlg, refreshToken, statsAlgId]);
}
