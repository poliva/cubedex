import { useCallback, useMemo, useState } from 'react';
import {
  expandNotation,
  exportAlgorithms,
  exportBackup,
  importAlgorithmsFromJson,
  importBackupFromJson,
  saveAlgorithm,
} from '../lib/storage';

export interface AlgorithmImportExportState {
  categoryInput: string;
  subsetInput: string;
  algNameInput: string;
  saveError: string;
  saveSuccess: string;
  clearForm: () => void;
  setCategoryInput: (value: string) => void;
  setSubsetInput: (value: string) => void;
  setAlgNameInput: (value: string) => void;
  clearMessages: () => void;
  submitSave: (algorithm: string) => Promise<boolean>;
  exportAll: () => Promise<void>;
  importFromFile: (file: File) => Promise<boolean>;
  exportBackup: () => Promise<void>;
  importBackupFromFile: (file: File) => Promise<boolean>;
}

export function useAlgorithmImportExport(onStorageChanged?: () => void): AlgorithmImportExportState {
  const [categoryInput, setCategoryInput] = useState('');
  const [subsetInput, setSubsetInput] = useState('');
  const [algNameInput, setAlgNameInput] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const clearMessages = useCallback(() => {
    setSaveError('');
    setSaveSuccess('');
  }, []);

  const clearForm = useCallback(() => {
    setCategoryInput('');
    setSubsetInput('');
    setAlgNameInput('');
  }, []);

  const clearAlgNameOnly = useCallback(() => {
    setAlgNameInput('');
  }, []);

  const submitSave = useCallback(async (algorithm: string) => {
    const category = categoryInput.trim();
    const subset = subsetInput.trim();
    const name = algNameInput.trim();
    const normalizedAlgorithm = expandNotation(algorithm.trim());

    if (!category || !subset || !name || !normalizedAlgorithm) {
      setSaveSuccess('');
      setSaveError('Please fill in all fields');
      window.setTimeout(() => {
        setSaveError('');
      }, 3000);
      return false;
    }

    await saveAlgorithm(category, subset, name, normalizedAlgorithm);
    onStorageChanged?.();
    clearAlgNameOnly();
    setSaveError('');
    setSaveSuccess('Algorithm saved successfully');
    window.setTimeout(() => {
      setSaveSuccess('');
    }, 3000);
    return true;
  }, [algNameInput, categoryInput, clearAlgNameOnly, onStorageChanged, subsetInput]);

  const exportAll = useCallback(async () => {
    await exportAlgorithms();
  }, []);

  const importFromFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      await importAlgorithmsFromJson(text);
      onStorageChanged?.();
      setSaveError('');
      setSaveSuccess('');
      window.alert('Algorithms imported successfully.');
      return true;
    } catch {
      setSaveSuccess('');
      setSaveError('');
      window.alert('Failed to import algorithms. Please ensure the file is in the correct format.');
      return false;
    }
  }, [onStorageChanged]);

  const exportBackupFile = useCallback(async () => {
    await exportBackup();
  }, []);

  const importBackupFromFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      await importBackupFromJson(text);
      onStorageChanged?.();
      setSaveError('');
      setSaveSuccess('');
      window.alert('Backup imported successfully.');
      return true;
    } catch {
      setSaveSuccess('');
      setSaveError('');
      window.alert('Failed to import backup. Please ensure the file is in the correct format.');
      return false;
    }
  }, [onStorageChanged]);

  return useMemo(() => ({
    categoryInput,
    subsetInput,
    algNameInput,
    saveError,
    saveSuccess,
    clearForm,
    setCategoryInput,
    setSubsetInput,
    setAlgNameInput,
    clearMessages,
    submitSave,
    exportAll,
    importFromFile,
    exportBackup: exportBackupFile,
    importBackupFromFile,
  }), [
    algNameInput,
    categoryInput,
    clearForm,
    clearMessages,
    exportAll,
    exportBackupFile,
    importFromFile,
    importBackupFromFile,
    saveError,
    saveSuccess,
    submitSave,
    subsetInput,
  ]);
}
