import {
  getAttemptHistorySummary,
  createScopeId,
  expandNotation,
  getBestTime,
  getAlgorithmId,
  getLearnedStatus,
  getSrsState,
  setLearnedStatus,
  type SavedAlgorithm,
  type SavedAlgorithms,
  type SavedSubset,
} from './storage';
import { deriveAutoLearnedStatus, getCaseUrgency, isCaseDue } from './srs';

export interface CaseCardData {
  id: string;
  name: string;
  algorithm: string;
  subset: string;
  category: string;
  bestTime: number | null;
  ao5: number | null;
  learned: number;
  manualLearned: number;
  reviewCount: number;
  smartReviewDueAt: number | null;
  smartReviewDue: boolean;
  smartReviewUrgency: number;
}

export function makeTimeParts(time: number) {
  const minutes = Math.floor(time / 60000);
  const remaining = time - minutes * 60000;
  const seconds = Math.floor(remaining / 1000);
  const milliseconds = Math.floor(remaining - seconds * 1000);

  return { minutes, seconds, milliseconds };
}

function formatTimeWithOptionalMinutes(time: number) {
  const parts = makeTimeParts(time);
  const minutesPart = parts.minutes > 0 ? `${parts.minutes}:` : '';
  const seconds = parts.minutes > 0
    ? parts.seconds.toString(10).padStart(2, '0')
    : parts.seconds.toString(10);
  return `${minutesPart}${seconds}.${parts.milliseconds.toString(10).padStart(3, '0')}`;
}

export function historyTimeString(time: number | null): string {
  if (!time) {
    return '-';
  }

  const parts = makeTimeParts(time);
  const minutesPart = parts.minutes > 0 ? `${parts.minutes}:` : '';
  return `${minutesPart}${parts.seconds.toString(10).padStart(2, '0')}.${parts.milliseconds.toString(10).padStart(3, '0')}`;
}

export function bestTimeString(time: number | null): string {
  if (!time) {
    return '-';
  }

  return formatTimeWithOptionalMinutes(time);
}

export function averageTimeString(time: number | null): string {
  if (!time) {
    return '-';
  }

  return formatTimeWithOptionalMinutes(time);
}

export function averageOfFiveTimeNumber(algId: string): number | null {
  const { executionTimes } = getAttemptHistorySummary(algId);
  if (executionTimes.length < 5) {
    return null;
  }

  const lastTimesTrimmed = executionTimes.slice(-5).sort((a, b) => a - b).slice(1, 4);
  return lastTimesTrimmed.reduce((sum, time) => sum + time, 0) / 3;
}

export function learnedLabel(status: number) {
  if (status === 1) {
    return 'Learning';
  }
  if (status === 2) {
    return 'Learned';
  }
  return 'Not learned';
}

export function learnedTitle(status: number) {
  if (status === 1) {
    return 'Learning';
  }
  if (status === 2) {
    return 'Learned';
  }
  return 'Not learned';
}

export function cycleLearnedStatus(algId: string) {
  const nextStatus = (getLearnedStatus(algId) + 1) % 3;
  setLearnedStatus(algId, nextStatus);
  return nextStatus;
}

export function getSubsetsForCategory(savedAlgorithms: SavedAlgorithms, category: string): SavedSubset[] {
  return savedAlgorithms[category] ?? [];
}

export function getCaseCards(
  savedAlgorithms: SavedAlgorithms,
  category: string,
  checkedSubsets: string[],
  options: {
    autoUpdateLearningState?: boolean;
    now?: number;
  } = {},
): CaseCardData[] {
  if (!category || !savedAlgorithms[category]) {
    return [];
  }

  const result: CaseCardData[] = [];
  const checkedSubsetSet = new Set(checkedSubsets);
  const now = options.now ?? Date.now();

  for (const subsetData of savedAlgorithms[category]) {
    if (!checkedSubsetSet.has(subsetData.subset)) {
      continue;
    }

    for (const alg of subsetData.algorithms) {
      const normalizedAlgorithm = expandNotation(alg.algorithm);
      const scopeId = createScopeId(category, subsetData.subset, getAlgorithmId(normalizedAlgorithm));
      const manualLearned = getLearnedStatus(scopeId);
      const { reviewHistory, executionTimes } = getAttemptHistorySummary(scopeId);
      const srsState = getSrsState(scopeId);
      const ao5 = executionTimes.length < 5
        ? null
        : executionTimes.slice(-5).sort((left, right) => left - right).slice(1, 4)
          .reduce((sum, time) => sum + time, 0) / 3;
      result.push({
        id: scopeId,
        name: alg.name,
        algorithm: normalizedAlgorithm,
        subset: subsetData.subset,
        category,
        bestTime: getBestTime(scopeId),
        ao5,
        learned: options.autoUpdateLearningState ? deriveAutoLearnedStatus(reviewHistory) : manualLearned,
        manualLearned,
        reviewCount: reviewHistory.length,
        smartReviewDueAt: srsState?.dueAt ?? null,
        smartReviewDue: isCaseDue(srsState, now),
        smartReviewUrgency: getCaseUrgency(srsState, now),
      });
    }
  }

  return result;
}

export function getAllAlgorithms(savedAlgorithms: SavedAlgorithms, category: string): SavedAlgorithm[] {
  const subsets = getSubsetsForCategory(savedAlgorithms, category);
  return subsets.flatMap((subset) => subset.algorithms.map((algorithm) => ({ ...algorithm })));
}
