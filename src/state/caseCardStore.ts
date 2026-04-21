import { createStore, useStoreSelector, shallowEqual } from './createStore';

export interface CaseCardStoreState {
  practiceCounts: Record<string, number>;
  failedCounts: Record<string, number>;
  bestTimes: Record<string, number | null>;
  ao5Times: Record<string, number | null>;
  selectedCaseIds: string[];
  fullStickering: boolean;
  autoUpdateLearningState: boolean;
}

const initial: CaseCardStoreState = {
  practiceCounts: {},
  failedCounts: {},
  bestTimes: {},
  ao5Times: {},
  selectedCaseIds: [],
  fullStickering: false,
  autoUpdateLearningState: false,
};

export const caseCardStore = createStore<CaseCardStoreState>(initial);

// ----------------- Actions -----------------
// Actions are held in module-scope mutable refs so CaseCard components can
// call stable functions without subscribing to changes in the action identities.

export interface CaseCardActions {
  cycleCaseLearnedState: (id: string) => void;
  toggleCaseSelection: (id: string, checked: boolean) => void;
  onBeforeToggleCase: () => void;
}

const noop = () => {};
let currentActions: CaseCardActions = {
  cycleCaseLearnedState: noop,
  toggleCaseSelection: noop,
  onBeforeToggleCase: noop,
};

export function setCaseCardActions(actions: CaseCardActions): void {
  currentActions = actions;
}

// Stable bound wrappers — these references never change, so CaseCard's
// React.memo is not invalidated.
export const stableActions: CaseCardActions = {
  cycleCaseLearnedState: (id) => currentActions.cycleCaseLearnedState(id),
  toggleCaseSelection: (id, checked) => currentActions.toggleCaseSelection(id, checked),
  onBeforeToggleCase: () => currentActions.onBeforeToggleCase(),
};

// ----------------- Selector hooks -----------------

export interface CaseCardSlice {
  practiceCount: number;
  failedCount: number;
  bestTime: number | null;
  ao5: number | null;
  selected: boolean;
}

export function useCaseCardSlice(id: string): CaseCardSlice {
  return useStoreSelector(
    caseCardStore,
    (s) => ({
      practiceCount: s.practiceCounts[id] ?? 0,
      failedCount: s.failedCounts[id] ?? 0,
      bestTime: s.bestTimes[id] ?? null,
      ao5: s.ao5Times[id] ?? null,
      selected: s.selectedCaseIds.includes(id),
    }),
    shallowEqual,
  );
}

export function useFullStickering(): boolean {
  return useStoreSelector(caseCardStore, (s) => s.fullStickering);
}

export function useAutoUpdateLearningState(): boolean {
  return useStoreSelector(caseCardStore, (s) => s.autoUpdateLearningState);
}
