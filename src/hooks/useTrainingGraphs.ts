import { useEffect } from 'react';
import type { CaseCardData } from '../lib/case-cards';
import {
  createStatsGraph,
  createTimeGraph,
  recreateStatsGraph,
  recreateTimeGraph,
  resizeStatsGraph,
  resizeTimeGraph,
} from '../lib/charts';
import { getAttemptHistorySummary } from '../lib/storage';

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

    const { executionTimes, solveHistory } = getAttemptHistorySummary(algId);
    const recentExecutionTimes = executionTimes.slice(-5);

    createTimeGraph(timeCanvas, recentExecutionTimes);
    createStatsGraph(statsCanvas, solveHistory);

    let frame = 0;
    const scheduleResize = (recreate: boolean) => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        if (recreate) {
          recreateTimeGraph(timeCanvas, recentExecutionTimes);
          recreateStatsGraph(statsCanvas, solveHistory);
          return;
        }
        resizeTimeGraph(timeCanvas);
        resizeStatsGraph(statsCanvas);
      });
    };

    const handleObservedResize = () => scheduleResize(false);
    const handleWindowResize = () => scheduleResize(true);

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(handleObservedResize);

    const observedElements = [
      timeCanvas?.parentElement,
      statsCanvas?.parentElement,
    ].filter((element): element is HTMLElement => Boolean(element));

    observedElements.forEach((element) => resizeObserver?.observe(element));
    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [currentCase, displayAlg, refreshToken, statsAlgId]);
}
