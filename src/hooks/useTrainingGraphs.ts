import { useEffect } from 'react';
import type { CaseCardData } from '../lib/case-cards';
import { createStatsGraph, createTimeGraph, resizeStatsGraph, resizeTimeGraph } from '../lib/charts';
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

    createTimeGraph(timeCanvas, executionTimes.slice(-5));
    createStatsGraph(statsCanvas, solveHistory);

    let frame = 0;
    const resizeGraphs = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        resizeTimeGraph(timeCanvas);
        resizeStatsGraph(statsCanvas);
      });
    };

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(resizeGraphs);

    const observedElements = [
      timeCanvas?.parentElement,
      statsCanvas?.parentElement,
    ].filter((element): element is HTMLElement => Boolean(element));

    observedElements.forEach((element) => resizeObserver?.observe(element));
    window.addEventListener('resize', resizeGraphs);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeGraphs);
    };
  }, [currentCase, displayAlg, refreshToken, statsAlgId]);
}
