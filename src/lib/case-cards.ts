import {
  createScopeId,
  expandNotation,
  getBestTime,
  getAlgorithmId,
  getLastTimes,
  getLearnedStatus,
  setLearnedStatus,
  type SavedAlgorithm,
  type SavedAlgorithms,
  type SavedSubset,
} from './storage';

export interface CaseCardData {
  id: string;
  name: string;
  algorithm: string;
  subset: string;
  category: string;
  bestTime: number | null;
  ao5: number | null;
  learned: number;
}

export function makeTimeParts(time: number) {
  const minutes = Math.floor(time / 60000);
  const remaining = time - minutes * 60000;
  const seconds = Math.floor(remaining / 1000);
  const milliseconds = Math.floor(remaining - seconds * 1000);

  return { minutes, seconds, milliseconds };
}

export function bestTimeString(time: number | null): string {
  if (!time) {
    return '-';
  }

  const best = makeTimeParts(time);
  return `${best.seconds.toString(10)}.${best.milliseconds.toString(10).padStart(3, '0')}`;
}

export function averageTimeString(time: number | null): string {
  if (!time) {
    return '-';
  }

  const avg = makeTimeParts(time);
  return `${avg.seconds.toString(10)}.${avg.milliseconds.toString(10).padStart(3, '0')}`;
}

export function averageOfFiveTimeNumber(algId: string): number | null {
  const lastTimes = getLastTimes(algId);
  if (lastTimes.length < 5) {
    return null;
  }

  const lastTimesTrimmed = lastTimes.slice(-5).sort((a, b) => a - b).slice(1, 4);
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
): CaseCardData[] {
  if (!category || !savedAlgorithms[category]) {
    return [];
  }

  const result: CaseCardData[] = [];
  const checkedSubsetSet = new Set(checkedSubsets);

  for (const subsetData of savedAlgorithms[category]) {
    if (!checkedSubsetSet.has(subsetData.subset)) {
      continue;
    }

    for (const alg of subsetData.algorithms) {
      const normalizedAlgorithm = expandNotation(alg.algorithm);
      const scopeId = createScopeId(category, subsetData.subset, getAlgorithmId(normalizedAlgorithm));
      result.push({
        id: scopeId,
        name: alg.name,
        algorithm: normalizedAlgorithm,
        subset: subsetData.subset,
        category,
        bestTime: getBestTime(scopeId),
        ao5: averageOfFiveTimeNumber(scopeId),
        learned: getLearnedStatus(scopeId),
      });
    }
  }

  return result;
}

export function getAllAlgorithms(savedAlgorithms: SavedAlgorithms, category: string): SavedAlgorithm[] {
  const subsets = getSubsetsForCategory(savedAlgorithms, category);
  return subsets.flatMap((subset) => subset.algorithms.map((algorithm) => ({ ...algorithm })));
}
