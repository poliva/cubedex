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
  setSelectedCategory: (category: string) => void;
  toggleSubset: (subset: string, checked: boolean) => void;
  toggleAllSubsets: (checked: boolean) => void;
  toggleCaseSelection: (algId: string, checked: boolean) => void;
  setSelectAllCases: (checked: boolean) => void;
  setSelectLearningCases: (checked: boolean) => void;
  cycleCaseLearnedState: (algId: string) => void;
  reloadSavedAlgorithms: () => void;
}

export function useCaseLibrary(): CaseLibraryState {
  const [isReady, setIsReady] = useState(false);
  const [savedAlgorithms, setSavedAlgorithms] = useState<SavedAlgorithms>({});
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubsets, setSelectedSubsets] = useState<string[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [autoApplySelectionMode, setAutoApplySelectionMode] = useState<'all' | 'learning' | null>(null);
  const [selectionChangeMode, setSelectionChangeMode] = useState<'bulk' | 'manual'>('bulk');
  const [selectAllCases, setSelectAllCasesState] = useState(true);
  const [selectLearningCases, setSelectLearningCasesState] = useState(false);
  const [learnedRefreshToken, setLearnedRefreshToken] = useState(0);
  const previousCategoryRef = useRef('');

  const reloadSavedAlgorithms = useCallback(() => {
    const saved = getSavedAlgorithms();
    const initialCategory = Object.keys(saved)[0] ?? '';

    setSavedAlgorithms(saved);
    setSelectedCaseIds([]);
    setAutoApplySelectionMode(null);
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
      setSelectedSubsets([]);
      return;
    }

    setSelectedSubsets((current) => {
      return current.filter((subset) => nextSubsets.includes(subset));
    });
  }, [savedAlgorithms, selectedCategory]);

  const caseCards = useMemo(
    () => getCaseCards(savedAlgorithms, selectedCategory, selectedSubsets),
    [savedAlgorithms, selectedCategory, selectedSubsets, learnedRefreshToken],
  );

  useEffect(() => {
    if (autoApplySelectionMode === 'learning') {
      setSelectedCaseIds(
        caseCards.filter((card) => card.learned === 1).map((card) => card.id),
      );
      setAutoApplySelectionMode(null);
      return;
    }

    if (autoApplySelectionMode === 'all') {
      setSelectedCaseIds(caseCards.map((card) => card.id));
      setAutoApplySelectionMode(null);
      return;
    }

    setSelectedCaseIds((current) => current.filter((algId) => caseCards.some((card) => card.id === algId)));
  }, [autoApplySelectionMode, caseCards]);

  const toggleSubset = useCallback((subset: string, checked: boolean) => {
    setSelectedCaseIds([]);
    setAutoApplySelectionMode(selectLearningCases ? 'learning' : selectAllCases ? 'all' : null);
    setSelectionChangeMode('bulk');
    setSelectedSubsets((current) => {
      if (checked) {
        return current.includes(subset) ? current : [...current, subset];
      }
      return current.filter((entry) => entry !== subset);
    });
  }, [selectAllCases, selectLearningCases]);

  const toggleAllSubsets = useCallback((checked: boolean) => {
    setSelectedCaseIds([]);
    setAutoApplySelectionMode(
      checked && (selectLearningCases || selectAllCases)
        ? (selectLearningCases ? 'learning' : 'all')
        : null,
    );
    setSelectionChangeMode('bulk');
    setSelectedSubsets(checked ? subsets : []);
  }, [selectAllCases, selectLearningCases, subsets]);

  const toggleCaseSelection = useCallback((algId: string, checked: boolean) => {
    setSelectionChangeMode('manual');
    setSelectedCaseIds((current) => {
      if (checked) {
        return current.includes(algId) ? current : [...current, algId];
      }
      return current.filter((entry) => entry !== algId);
    });
  }, []);

  const setSelectAllCases = useCallback((checked: boolean) => {
    setSelectionChangeMode('bulk');
    setSelectAllCasesState(checked);
    if (checked) {
      setSelectLearningCasesState(false);
      setAutoApplySelectionMode('all');
    } else {
      setAutoApplySelectionMode(null);
      setSelectedCaseIds([]);
    }
  }, []);

  const setSelectLearningCases = useCallback((checked: boolean) => {
    setSelectionChangeMode('bulk');
    setSelectLearningCasesState(checked);
    if (checked) {
      setSelectAllCasesState(false);
      setAutoApplySelectionMode('learning');
    } else {
      setAutoApplySelectionMode(null);
      setSelectedCaseIds([]);
    }
  }, []);

  const cycleCaseLearnedState = useCallback((algId: string) => {
    cycleLearnedStatus(algId);
    setLearnedRefreshToken((value) => value + 1);
  }, []);

  const handleSetSelectedCategory = useCallback((category: string) => {
    setSelectedCaseIds([]);
    setAutoApplySelectionMode(null);
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
    setSelectedCategory: handleSetSelectedCategory,
    toggleSubset,
    toggleAllSubsets,
    toggleCaseSelection,
    setSelectAllCases,
    setSelectLearningCases,
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
    selectLearningCases,
    selectedCaseIds,
    selectedCategory,
    selectedSubsets,
    selectionChangeMode,
    setSelectAllCases,
    setSelectLearningCases,
    subsets,
    toggleAllSubsets,
    toggleCaseSelection,
    toggleSubset,
  ]);
}
