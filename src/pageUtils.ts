// ── Page Utilities ─────────────────────────────────────────────────────
// Pure helper functions for formatting times, reading localStorage stats,
// and generating bookmark SVG markup. No state (S) or DOM ($) dependencies.

import { makeTimeFromTimestamp } from 'smartcube-web-bluetooth';

/** Returns SVG bookmark icon markup for a learned status (0=unknown, 1=learning, 2=learned). */
export function learnedSVG(status: number): string {
  // References <symbol> elements defined in index.html SVG sprite
  if (status === 1) {
    return `<svg class="h-8 w-8" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-bookmark-learning"/></svg>`;
  } else if (status === 2) {
    return `<svg class="h-8 w-8" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-bookmark-learned"/></svg>`;
  } else {
    return `<svg class="h-8 w-8" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-bookmark-unknown"/></svg>`;
  }
}

/** Gets the learned status (0/1/2) for an algorithm from localStorage. */
export function learnedStatus(algId: string): number {
  const learnedStatus = localStorage.getItem('Learned-' + algId);
  if (!learnedStatus) return 0;
  return Number(learnedStatus);
}

/** Gets the best solve time (ms) for an algorithm from localStorage, or null. */
export function bestTimeNumber(algId: string, prefix: string = ''): number | null {
  const bestTime = localStorage.getItem('Best-' + prefix + algId);
  if (!bestTime) return null;
  return Number(bestTime)
}

/** Formats a time in ms to a readable "s.mmm" string, or "-" if null. */
export function bestTimeString(time: number | null): string {
  if (!time) return '-';
  const best = makeTimeFromTimestamp(time)
  return `${best.seconds.toString(10)}.${best.milliseconds.toString(10).padStart(3, '0')}`;
}

/** Calculates trimmed average of the last 5 times (drops best and worst). */
export function averageOfFiveTimeNumber(algId: string, prefix: string = ''): number | null {
  const lastTimes = getLastTimes(algId, prefix);
  if (lastTimes.length < 5) return null;
  // remove best and worst time from last 5 times and calculate the mean of the remaining 3 times
  const lastTimesTrimmed = lastTimes.slice(-5).sort((a, b) => a - b).slice(1, 4);
  return lastTimesTrimmed.reduce((sum, time) => sum + time, 0) / 3;
}

/** Calculates trimmed average of the last 12 times (drops best and worst). */
export function averageOf12TimeNumber(algId: string, prefix: string = ''): number | null {
  const lastTimes = getLastTimes(algId, prefix);
  if (lastTimes.length < 12) return null;
  // remove best and worst from last 12 times, average the remaining 10
  const lastTimesTrimmed = lastTimes.slice(-12).sort((a, b) => a - b).slice(1, 11);
  return lastTimesTrimmed.reduce((sum, time) => sum + time, 0) / 10;
}

/** Formats an average time (ms) to a readable "s.mmm s" string, or "-" if null/zero. */
export function averageTimeString(time: number | null): string {
  if (!time) return '-';
  const avg = makeTimeFromTimestamp(time);
  return `${avg.seconds.toString(10)}.${avg.milliseconds.toString(10).padStart(3, '0')}`;
}

/** Retrieves the array of last recorded times (ms) for an algorithm from localStorage. */
export function getLastTimes(algId: string, prefix: string = ''): number[] {
  const lastTimesStorage = localStorage.getItem('LastTimes-' + prefix + algId);
  return lastTimesStorage ? lastTimesStorage.split(',').map(num => Number(num.trim())) : [];
}

/** Returns the stored failed count for a case, clamped to >= 0. */
export function getFailedCount(algId: string): number {
  return Math.max(0, parseInt(localStorage.getItem('FailedCount-' + algId) || '0'));
}

/** Returns the stored success count for a case.
 *  Falls back to (LastTimes count - FailedCount) for data stored before SuccessCount existed. */
export function getSuccessCount(algId: string): number {
  const stored = localStorage.getItem('SuccessCount-' + algId);
  if (stored !== null) return Math.max(0, parseInt(stored));
  // Migration: derive from old data
  const execTimesStr = localStorage.getItem('LastTimes-' + algId);
  const cdTimesStr = localStorage.getItem('LastTimes-CD-' + algId);
  const lastTimesCount = (execTimesStr ? execTimesStr.split(',').filter(t => t.trim()).length : 0)
    + (cdTimesStr ? cdTimesStr.split(',').filter(t => t.trim()).length : 0);
  return Math.max(0, lastTimesCount - getFailedCount(algId));
}

/** Returns total practice count: success + failed. */
export function getPracticeCount(algId: string): number {
  return getSuccessCount(algId) + getFailedCount(algId);
}

/** Returns the last N solve results (S=success, F=fail) for a case. */
export function getLastResults(algId: string): string[] {
  const stored = localStorage.getItem('LastResults-' + algId);
  if (!stored) return [];
  return stored.split(',').filter(r => r === 'S' || r === 'F');
}

/** Returns the fail rate over the last 12 results (ao12-style).
 *  Falls back to overall fail rate if fewer than 1 result stored. */
export function getFailRateAo12(algId: string): number {
  const results = getLastResults(algId);
  if (results.length === 0) {
    // Fallback: overall fail rate
    const practiceCount = getPracticeCount(algId);
    if (practiceCount === 0) return 0;
    return getFailedCount(algId) / practiceCount;
  }
  const last12 = results.slice(-12);
  const fails = last12.filter(r => r === 'F').length;
  return fails / last12.length;
}
