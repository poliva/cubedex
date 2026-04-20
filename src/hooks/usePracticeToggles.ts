import { useCallback, useMemo, useState } from 'react';

export interface PracticeTogglesState {
  randomizeAUF: boolean;
  randomOrder: boolean;
  timeAttack: boolean;
  prioritizeSlowCases: boolean;
  prioritizeFailedCases: boolean;
  setRandomizeAUF: (value: boolean) => void;
  setRandomOrder: (value: boolean) => void;
  setTimeAttack: (value: boolean) => void;
  setPrioritizeSlowCases: (value: boolean) => void;
  setPrioritizeFailedCases: (value: boolean) => void;
}

export function usePracticeToggles(): PracticeTogglesState {
  const [randomizeAUF, setRandomizeAUFState] = useState(false);
  const [randomOrder, setRandomOrderState] = useState(false);
  const [timeAttack, setTimeAttackState] = useState(false);
  const [prioritizeSlowCases, setPrioritizeSlowCasesState] = useState(false);
  const [prioritizeFailedCases, setPrioritizeFailedCasesState] = useState(false);

  const setRandomizeAUF = useCallback((value: boolean) => {
    setRandomizeAUFState(value);
  }, []);

  const setRandomOrder = useCallback((value: boolean) => {
    setRandomOrderState(value);
    if (value) {
      setPrioritizeSlowCasesState(false);
    }
  }, []);

  const setTimeAttack = useCallback((value: boolean) => {
    setTimeAttackState(value);
  }, []);

  const setPrioritizeSlowCases = useCallback((value: boolean) => {
    setPrioritizeSlowCasesState(value);
    if (value) {
      setRandomOrderState(false);
    }
  }, []);

  const setPrioritizeFailedCases = useCallback((value: boolean) => {
    setPrioritizeFailedCasesState(value);
  }, []);

  return useMemo(() => ({
    randomizeAUF,
    randomOrder,
    timeAttack,
    prioritizeSlowCases,
    prioritizeFailedCases,
    setRandomizeAUF,
    setRandomOrder,
    setTimeAttack,
    setPrioritizeSlowCases,
    setPrioritizeFailedCases,
  }), [
    prioritizeFailedCases,
    prioritizeSlowCases,
    randomOrder,
    randomizeAUF,
    setTimeAttack,
    setPrioritizeFailedCases,
    setPrioritizeSlowCases,
    setRandomOrder,
    setRandomizeAUF,
    timeAttack,
  ]);
}
