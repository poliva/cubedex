import { useCallback, useMemo, useState } from 'react';

export interface PracticeTogglesState {
  randomizeAUF: boolean;
  randomOrder: boolean;
  timeAttack: boolean;
  prioritizeSlowCases: boolean;
  prioritizeFailedCases: boolean;
  smartReviewScheduling: boolean;
  setRandomizeAUF: (value: boolean) => void;
  setRandomOrder: (value: boolean) => void;
  setTimeAttack: (value: boolean) => void;
  setPrioritizeSlowCases: (value: boolean) => void;
  setPrioritizeFailedCases: (value: boolean) => void;
  setSmartReviewScheduling: (value: boolean) => void;
}

export function usePracticeToggles(): PracticeTogglesState {
  const [randomizeAUF, setRandomizeAUFState] = useState(false);
  const [randomOrder, setRandomOrderState] = useState(false);
  const [timeAttack, setTimeAttackState] = useState(false);
  const [prioritizeSlowCases, setPrioritizeSlowCasesState] = useState(false);
  const [prioritizeFailedCases, setPrioritizeFailedCasesState] = useState(false);
  const [smartReviewScheduling, setSmartReviewSchedulingState] = useState(false);

  const setRandomizeAUF = useCallback((value: boolean) => {
    setRandomizeAUFState(value);
  }, []);

  const setRandomOrder = useCallback((value: boolean) => {
    setRandomOrderState(value);
    if (value) {
      setPrioritizeSlowCasesState(false);
      setSmartReviewSchedulingState(false);
    }
  }, []);

  const setTimeAttack = useCallback((value: boolean) => {
    setTimeAttackState(value);
    if (value) {
      setSmartReviewSchedulingState(false);
    }
  }, []);

  const setPrioritizeSlowCases = useCallback((value: boolean) => {
    setPrioritizeSlowCasesState(value);
    if (value) {
      setRandomOrderState(false);
      setSmartReviewSchedulingState(false);
    }
  }, []);

  const setPrioritizeFailedCases = useCallback((value: boolean) => {
    setPrioritizeFailedCasesState(value);
  }, []);

  const setSmartReviewScheduling = useCallback((value: boolean) => {
    setSmartReviewSchedulingState(value);
    if (value) {
      setRandomOrderState(false);
      setPrioritizeSlowCasesState(false);
      setTimeAttackState(false);
    }
  }, []);

  return useMemo(() => ({
    randomizeAUF,
    randomOrder,
    timeAttack,
    prioritizeSlowCases,
    prioritizeFailedCases,
    smartReviewScheduling,
    setRandomizeAUF,
    setRandomOrder,
    setTimeAttack,
    setPrioritizeSlowCases,
    setPrioritizeFailedCases,
    setSmartReviewScheduling,
  }), [
    prioritizeFailedCases,
    prioritizeSlowCases,
    randomOrder,
    randomizeAUF,
    setPrioritizeFailedCases,
    setPrioritizeSlowCases,
    setRandomOrder,
    setRandomizeAUF,
    setSmartReviewScheduling,
    setTimeAttack,
    smartReviewScheduling,
    timeAttack,
  ]);
}
