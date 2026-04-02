import { useState } from 'react';
import { expandNotation, exportAlgorithms, importAlgorithmsFromJson, saveAlgorithm } from '../lib/legacy-storage';

export interface LegacyManagementState {
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
  submitSave: (algorithm: string) => boolean;
  exportAll: () => void;
  importFromFile: (file: File) => Promise<boolean>;
}

export function useLegacyManagement(onStorageChanged?: () => void): LegacyManagementState {
  const [categoryInput, setCategoryInput] = useState('');
  const [subsetInput, setSubsetInput] = useState('');
  const [algNameInput, setAlgNameInput] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  function clearMessages() {
    setSaveError('');
    setSaveSuccess('');
  }

  function clearForm() {
    setCategoryInput('');
    setSubsetInput('');
    setAlgNameInput('');
  }

  function submitSave(algorithm: string) {
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

    saveAlgorithm(category, subset, name, normalizedAlgorithm);
    onStorageChanged?.();
    clearForm();
    setSaveError('');
    setSaveSuccess('Algorithm saved successfully');
    window.setTimeout(() => {
      setSaveSuccess('');
    }, 3000);
    return true;
  }

  function exportAll() {
    exportAlgorithms();
  }

  async function importFromFile(file: File) {
    try {
      const text = await file.text();
      importAlgorithmsFromJson(text);
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
  }

  return {
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
  };
}
