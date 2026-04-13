import { createStore, shallowEqual, useStoreSelector } from './createStore';
import type { TrainingDisplayMove } from '../hooks/useTrainingState';

export interface TrainingViewStoreState {
  displayMoves: TrainingDisplayMove[];
  fixText: string;
  fixVisible: boolean;
  helpTone: 'hidden' | 'red';
}

const initial: TrainingViewStoreState = {
  displayMoves: [],
  fixText: '',
  fixVisible: false,
  helpTone: 'hidden',
};

export const trainingViewStore = createStore<TrainingViewStoreState>(initial);

export interface MoveListSlice {
  displayMoves: TrainingDisplayMove[];
  fixText: string;
  fixVisible: boolean;
  helpTone: 'hidden' | 'red';
}

export function useMoveListSlice(): MoveListSlice {
  return useStoreSelector(
    trainingViewStore,
    (s) => ({
      displayMoves: s.displayMoves,
      fixText: s.fixText,
      fixVisible: s.fixVisible,
      helpTone: s.helpTone,
    }),
    shallowEqual,
  );
}

