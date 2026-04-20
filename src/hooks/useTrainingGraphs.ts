import { useEffect } from 'react';
import type { CaseCardData } from '../lib/case-cards';
import { createStatsGraph, createTimeGraph } from '../lib/charts';
import { getLastTimes } from '../lib/storage';

export function useTrainingGraphs(
  currentCase: CaseCardData | null,
  displayAlg: string,
  statsAlgId: string,
  refreshToken: number | string = 0,
) {
  useEffect(() => {
    const timeCanvas = document.getElementById('timeGraph') as HTMLCanvasElement | null;
    const statsCanvas = document.getElementById('statsGraph') as HTMLCanvasElement | null;

    const algId = statsAlgId || currentCase?.id || '';

    if (!algId) {
      createTimeGraph(timeCanvas, []);
      createStatsGraph(statsCanvas, []);
      return;
    }

    const lastTimes = getLastTimes(algId);

    createTimeGraph(timeCanvas, lastTimes.slice(-5));
    createStatsGraph(statsCanvas, lastTimes);
  }, [currentCase, displayAlg, refreshToken, statsAlgId]);
}
