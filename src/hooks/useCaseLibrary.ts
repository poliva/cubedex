import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import defaultAlgs from '../data/defaultAlgs.json';
import {
  cycleLearnedStatus,
  getCaseCards,
  getSubsetsForCategory,
  type CaseCardData,
} from '../lib/case-cards';
import {
  getSavedAlgorithms,
  initializeDefaultAlgorithms,
  type SavedAlgorithms,
} from '../lib/storage';

export interface CaseLibraryState {
  isReady: boolean;
  savedAlgorithms: SavedAlgorithms;
  categories: string[];
  selectedCategory: string;
  subsets: string[];
  selectedSubsets: string[];
  caseCards: CaseCardData[];
  selectedCaseIds: string[];
  selectionChangeMode: 'bulk' | 'manual';
  selectAllCases: boolean;
  selectLearningCases: boolean;
  selectLearnedCases: boolean;
  setSelectedCategory: (category: string) => void;
  toggleSubset: (subset: string, checked: boolean) => void;
  toggleAllSubsets: (checked: boolean) => void;
  toggleCaseSelection: (algId: string, checked: boolean) => void;
  selectVisibleCases: () => void;
  clearSelectedCases: () => void;
  setSelectAllCases: (checked: boolean) => void;
  setSelectLearningCases: (checked: boolean) => void;
  setSelectLearnedCases: (checked: boolean) => void;
  cycleCaseLearnedState: (algId: string) => void;
  reloadSavedAlgorithms: () => void;
}

export interface CaseLibraryOptions {
  autoUpdateLearningState?: boolean;
  smartReviewScheduling?: boolean;
  reviewRefreshToken?: number;
}

export function useCaseLibrary(options: CaseLibraryOptions = {}): CaseLibraryState {
  const [isReady, setIsReady] = useState(false);
  const [savedAlgorithms, setSavedAlgorithms] = useState<SavedAlgorithms>({});
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubsets, setSelectedSubsets] = useState<string[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [selectionChangeMode, setSelectionChangeMode] = useState<'bulk' | 'manual'>('bulk');
  const [selectAllCases, setSelectAllCasesState] = useState(true);
  const [selectLearningCases, setSelectLearningCasesState] = useState(false);
  const [selectLearnedCases, setSelectLearnedCasesState] = useState(false);
  const [learnedRefreshToken, setLearnedRefreshToken] = useState(0);
  const previousCategoryRef = useRef('');
  const caseCardsRef = useRef<CaseCardData[]>([]);

  const reloadSavedAlgorithms = useCallback(() => {
    const saved = getSavedAlgorithms();
    const initialCategory = Object.keys(saved)[0] ?? '';

    setSavedAlgorithms(saved);
    setSelectedCaseIds([]);
    setSelectionChangeMode('bulk');
    setSelectedCategory((current) => (current && saved[current] ? current : initialCategory));
    setSelectedSubsets((current) => {
      const activeCategory = (selectedCategory && saved[selectedCategory]) ? selectedCategory : initialCategory;
      const available = getSubsetsForCategory(saved, activeCategory).map((entry) => entry.subset);
      const retained = current.filter((subset) => available.includes(subset));
      return retained;
    });
  }, [selectedCategory]);

  useEffect(() => {
    let active = true;

    void initializeDefaultAlgorithms(defaultAlgs as SavedAlgorithms).then((result) => {
      if (!active) {
        return;
      }

      if (result.alertMessage) {
        window.alert(result.alertMessage);
      }

      reloadSavedAlgorithms();
      setIsReady(true);
    }).catch((error) => {
      console.error(error);
      if (active) {
        window.alert('Failed to initialize persistent storage.');
        setIsReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => Object.keys(savedAlgorithms), [savedAlgorithms]);

  const subsets = useMemo(
    () => getSubsetsForCategory(savedAlgorithms, selectedCategory).map((entry) => entry.subset),
    [savedAlgorithms, selectedCategory],
  );

  useEffect(() => {
    if (!selectedCategory) {
      setSelectedSubsets([]);
      previousCategoryRef.current = '';
      return;
    }

    const nextSubsets = getSubsetsForCategory(savedAlgorithms, selectedCategory).map((entry) => entry.subset);
    if (previousCategoryRef.current !== selectedCategory) {
      previousCategoryRef.current = selectedCategory;
      setSelectedSubsets(nextSubsets);
      return;
    }

    setSelectedSubsets((current) => {
      return current.filter((subset) => nextSubsets.includes(subset));
    });
  }, [savedAlgorithms, selectedCategory]);

  const caseCards = useMemo(
    () => getCaseCards(savedAlgorithms, selectedCategory, selectedSubsets, {
      autoUpdateLearningState: options.autoUpdateLearningState,
    }),
    [
      options.autoUpdateLearningState,
      options.reviewRefreshToken,
      savedAlgorithms,
      selectedCategory,
      selectedSubsets,
      learnedRefreshToken,
    ],
  );

  useEffect(() => {
    caseCardsRef.current = caseCards;
    const filteredCards = (selectLearningCases || selectLearnedCases)
      ? caseCards.filter((card) => (
        (selectLearningCases && card.learned === 1)
        || (selectLearnedCases && card.learned === 2)
      ))
      : caseCards;

    if (selectAllCases) {
      setSelectedCaseIds(
        caseCards.map((card) => card.id),
      );
      return;
    }

    if (selectLearningCases || selectLearnedCases) {
      setSelectedCaseIds(filteredCards.map((card) => card.id));
      return;
    }

    setSelectedCaseIds((current) => current.filter((algId) => caseCards.some((card) => card.id === algId)));
  }, [
    caseCards,
    selectAllCases,
    selectLearnedCases,
    selectLearningCases,
  ]);

  const toggleSubset = useCallback((subset: string, checked: boolean) => {
    setSelectedCaseIds([]);
    setSelectionChangeMode('bulk');
    setSelectedSubsets((current) => {
      if (checked) {
        return current.includes(subset) ? current : [...current, subset];
      }
      return current.filter((entry) => entry !== subset);
    });
  }, []);

  const toggleAllSubsets = useCallback((checked: boolean) => {
    setSelectedCaseIds([]);
    setSelectionChangeMode('bulk');
    setSelectedSubsets(checked ? subsets : []);
  }, [subsets]);

  const toggleCaseSelection = useCallback((algId: string, checked: boolean) => {
    setSelectionChangeMode('manual');
    setSelectedCaseIds((current) => {
      if (checked) {
        return current.includes(algId) ? current : [...current, algId];
      }
      return current.filter((entry) => entry !== algId);
    });
  }, []);

  const selectVisibleCases = useCallback(() => {
    const filteredCards = (selectLearningCases || selectLearnedCases)
      ? caseCards.filter((card) => (
        (selectLearningCases && card.learned === 1)
        || (selectLearnedCases && card.learned === 2)
      ))
      : caseCards;

    setSelectionChangeMode('bulk');
    setSelectedCaseIds(filteredCards.map((card) => card.id));
  }, [caseCards, selectLearnedCases, selectLearningCases]);

  const clearSelectedCases = useCallback(() => {
    setSelectionChangeMode('bulk');
    setSelectAllCasesState(false);
    setSelectLearningCasesState(false);
    setSelectLearnedCasesState(false);
    setSelectedCaseIds([]);
  }, []);

  const setSelectAllCases = useCallback((checked: boolean) => {
    setSelectionChangeMode('bulk');
    setSelectAllCasesState(checked);
    if (checked) {
      setSelectLearningCasesState(false);
      setSelectLearnedCasesState(false);
    } else {
      setSelectedCaseIds([]);
    }
  }, []);

  const setSelectLearningCases = useCallback((checked: boolean) => {
    setSelectionChangeMode('bulk');
    setSelectLearningCasesState(checked);
    if (checked) {
      setSelectAllCasesState(false);
    } else {
      // Toggling Learning off: drop only learning cases from the current selection.
      setSelectedCaseIds((current) => current.filter((id) => {
        const card = caseCardsRef.current.find((c) => c.id === id);
        return !card || card.learned !== 1;
      }));
    }
  }, []);

  const setSelectLearnedCases = useCallback((checked: boolean) => {
    setSelectionChangeMode('bulk');
    setSelectLearnedCasesState(checked);
    if (checked) {
      setSelectAllCasesState(false);
    } else {
      // Toggling Learned off: drop only learned cases from the current selection.
      setSelectedCaseIds((current) => current.filter((id) => {
        const card = caseCardsRef.current.find((c) => c.id === id);
        return !card || card.learned !== 2;
      }));
    }
  }, []);

  const cycleCaseLearnedState = useCallback((algId: string) => {
    cycleLearnedStatus(algId);
    setLearnedRefreshToken((value) => value + 1);
  }, []);

  const handleSetSelectedCategory = useCallback((category: string) => {
    setSelectedCaseIds([]);
    setSelectionChangeMode('bulk');
    setSelectedCategory(category);
  }, []);

  return useMemo(() => ({
    isReady,
    savedAlgorithms,
    categories,
    selectedCategory,
    subsets,
    selectedSubsets,
    caseCards,
    selectedCaseIds,
    selectionChangeMode,
    selectAllCases,
    selectLearningCases,
    selectLearnedCases,
    setSelectedCategory: handleSetSelectedCategory,
    toggleSubset,
    toggleAllSubsets,
    toggleCaseSelection,
    selectVisibleCases,
    clearSelectedCases,
    setSelectAllCases,
    setSelectLearningCases,
    setSelectLearnedCases,
    cycleCaseLearnedState,
    reloadSavedAlgorithms,
  }), [
    caseCards,
    categories,
    cycleCaseLearnedState,
    handleSetSelectedCategory,
    isReady,
    reloadSavedAlgorithms,
    savedAlgorithms,
    selectAllCases,
    clearSelectedCases,
    selectLearnedCases,
    selectLearningCases,
    selectVisibleCases,
    selectedCaseIds,
    selectedCategory,
    selectedSubsets,
    selectionChangeMode,
    setSelectAllCases,
    setSelectLearnedCases,
    setSelectLearningCases,
    subsets,
    toggleAllSubsets,
    toggleCaseSelection,
    toggleSubset,
  ]);
}
