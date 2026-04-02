import { useEffect } from 'react';
import { averageTimeString, bestTimeString, type CaseCardData } from '../lib/legacy-algorithms';
import { createStatsGraph, createTimeGraph, countMovesETM } from '../lib/legacy-charts';
import { averageOfFiveTimeNumber } from '../lib/legacy-algorithms';
import { algToId, getBestTime, getLastTimes } from '../lib/legacy-storage';

export function useLegacyCharts(currentCase: CaseCardData | null, displayAlg: string, statsAlgId: string, refreshToken: number | string = 0) {
  useEffect(() => {
    const timeCanvas = document.getElementById('timeGraph') as HTMLCanvasElement | null;
    const statsCanvas = document.getElementById('statsGraph') as HTMLCanvasElement | null;
    const averageTimeBox = document.getElementById('average-time-box');
    const averageTpsBox = document.getElementById('average-tps-box');
    const singlePbBox = document.getElementById('single-pb-box');

    const algId = statsAlgId || (currentCase ? algToId(currentCase.algorithm) || 'default-alg-id' : '');

    if (!algId) {
      createTimeGraph(timeCanvas, []);
      createStatsGraph(statsCanvas, []);
      if (averageTimeBox) averageTimeBox.innerHTML = 'Average Time<br />-';
      if (averageTpsBox) averageTpsBox.innerHTML = 'Average TPS<br />-';
      if (singlePbBox) singlePbBox.innerHTML = 'Single PB<br />-';
      return;
    }

    const lastTimes = getLastTimes(algId);
    const best = getBestTime(algId);
    const average = lastTimes.length > 0 ? lastTimes.reduce((sum, time) => sum + time, 0) / lastTimes.length : null;
    const moveCount = displayAlg ? countMovesETM(displayAlg) : 0;
    const averageTPS = average ? (moveCount / (average / 1000)).toFixed(2) : '-';
    const singlePb = best ? `${bestTimeString(best)}${lastTimes.at(-1) === best ? ' 🎉' : ''}` : '-';

    createTimeGraph(timeCanvas, lastTimes.slice(-5));
    createStatsGraph(statsCanvas, lastTimes);

    if (averageTimeBox) averageTimeBox.innerHTML = `Average Time<br />${averageTimeString(average)}`;
    if (averageTpsBox) averageTpsBox.innerHTML = `Average TPS<br />${averageTPS}`;
    if (singlePbBox) singlePbBox.innerHTML = `Single PB<br />${singlePb}`;

    void averageOfFiveTimeNumber(algId);
  }, [currentCase, displayAlg, refreshToken, statsAlgId]);
}
