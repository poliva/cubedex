import { useState } from 'react';

export interface PracticeTogglesState {
  randomizeAUF: boolean;
  randomOrder: boolean;
  prioritizeSlowCases: boolean;
  prioritizeFailedCases: boolean;
  setRandomizeAUF: (value: boolean) => void;
  setRandomOrder: (value: boolean) => void;
  setPrioritizeSlowCases: (value: boolean) => void;
  setPrioritizeFailedCases: (value: boolean) => void;
}

export function usePracticeToggles(): PracticeTogglesState {
  const [randomizeAUF, setRandomizeAUFState] = useState(false);
  const [randomOrder, setRandomOrderState] = useState(false);
  const [prioritizeSlowCases, setPrioritizeSlowCasesState] = useState(false);
  const [prioritizeFailedCases, setPrioritizeFailedCasesState] = useState(false);

  function setRandomizeAUF(value: boolean) {
    setRandomizeAUFState(value);
  }

  function setRandomOrder(value: boolean) {
    setRandomOrderState(value);
    if (value) {
      setPrioritizeSlowCasesState(false);
    }
  }

  function setPrioritizeSlowCases(value: boolean) {
    setPrioritizeSlowCasesState(value);
    if (value) {
      setRandomOrderState(false);
    }
  }

  function setPrioritizeFailedCases(value: boolean) {
    setPrioritizeFailedCasesState(value);
  }

  return {
    randomizeAUF,
    randomOrder,
    prioritizeSlowCases,
    prioritizeFailedCases,
    setRandomizeAUF,
    setRandomOrder,
    setPrioritizeSlowCases,
    setPrioritizeFailedCases,
  };
}
