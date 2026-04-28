import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { readOption, writeOption } from '../lib/storage';

export interface AppSettingsState {
  darkMode: boolean;
  showAlgName: boolean;
  countdownMode: boolean;
  alwaysScrambleTo: boolean;
  autoUpdateLearningState: boolean;
  visualization: string;
  backview: string;
  hintFacelets: string;
  fullStickering: boolean;
  whiteOnBottom: boolean;
  gyroscope: boolean;
  controlPanel: string;
  flashingIndicatorEnabled: boolean;
  cubeSizePx: number;
  showTimesInsteadOfGraph: boolean;
  setDarkMode: (value: boolean) => void;
  setShowAlgName: (value: boolean) => void;
  setCountdownMode: (value: boolean) => void;
  setAlwaysScrambleTo: (value: boolean) => void;
  setAutoUpdateLearningState: (value: boolean) => void;
  setVisualization: (value: string) => void;
  setBackview: (value: string) => void;
  setHintFacelets: (value: string) => void;
  setFullStickering: (value: boolean) => void;
  setWhiteOnBottom: (value: boolean) => void;
  setGyroscope: (value: boolean) => void;
  setControlPanel: (value: string) => void;
  setFlashingIndicatorEnabled: (value: boolean) => void;
  setCubeSizePx: (value: number) => void;
  setShowTimesInsteadOfGraph: Dispatch<SetStateAction<boolean>>;
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(n)));
}

function detectInitialDarkMode() {
  if (readOption('theme') === 'dark') {
    return true;
  }
  if (readOption('theme') === 'light') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useAppSettings(): AppSettingsState {
  const [darkMode, setDarkModeState] = useState(detectInitialDarkMode);
  const [showAlgName, setShowAlgNameState] = useState(readOption('showAlgName') !== 'false');
  const [countdownMode, setCountdownModeState] = useState(readOption('countdownMode') === 'true');
  const [alwaysScrambleTo, setAlwaysScrambleToState] = useState(readOption('alwaysScrambleTo') === 'true');
  const [autoUpdateLearningState, setAutoUpdateLearningStateState] = useState(
    readOption('autoUpdateLearningState') !== 'false',
  );
  const [visualization, setVisualizationState] = useState(readOption('visualization') || 'PG3D');
  const [backview, setBackviewState] = useState(readOption('backview') || 'none');
  const [hintFacelets, setHintFaceletsState] = useState(readOption('hintFacelets') || 'none');
  const [fullStickering, setFullStickeringState] = useState(readOption('fullStickering') === 'true');
  const [whiteOnBottom, setWhiteOnBottomState] = useState(readOption('whiteOnBottom') === 'true');
  const [gyroscope, setGyroscopeState] = useState(readOption('gyroscope') !== 'disabled');
  const [controlPanel, setControlPanelState] = useState(readOption('controlPanel') || 'none');
  const [flashingIndicatorEnabled, setFlashingIndicatorEnabledState] = useState(
    readOption('flashingIndicatorEnabled') !== 'false',
  );
  const [cubeSizePx, setCubeSizePxState] = useState(
    clampInt(readOption('cubeSizePx'), 240, 600, 400),
  );
  const [showTimesInsteadOfGraph, setShowTimesInsteadOfGraph] = useState(
    readOption('showTimesInsteadOfGraph') === 'true',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    writeOption('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    writeOption('showAlgName', String(showAlgName));
  }, [showAlgName]);

  useEffect(() => {
    writeOption('countdownMode', String(countdownMode));
  }, [countdownMode]);

  useEffect(() => {
    writeOption('alwaysScrambleTo', String(alwaysScrambleTo));
  }, [alwaysScrambleTo]);

  useEffect(() => {
    writeOption('autoUpdateLearningState', String(autoUpdateLearningState));
  }, [autoUpdateLearningState]);

  useEffect(() => {
    writeOption('visualization', visualization);
  }, [visualization]);

  useEffect(() => {
    writeOption('backview', backview);
  }, [backview]);

  useEffect(() => {
    writeOption('hintFacelets', hintFacelets);
  }, [hintFacelets]);

  useEffect(() => {
    writeOption('fullStickering', String(fullStickering));
    writeOption('whiteOnBottom', String(whiteOnBottom && fullStickering));
    if (!fullStickering && whiteOnBottom) {
      setWhiteOnBottomState(false);
    }
  }, [fullStickering, whiteOnBottom]);

  useEffect(() => {
    writeOption('gyroscope', gyroscope ? 'enabled' : 'disabled');
  }, [gyroscope]);

  useEffect(() => {
    writeOption('controlPanel', controlPanel);
  }, [controlPanel]);

  useEffect(() => {
    writeOption('flashingIndicatorEnabled', String(flashingIndicatorEnabled));
  }, [flashingIndicatorEnabled]);

  useEffect(() => {
    writeOption('cubeSizePx', String(cubeSizePx));
  }, [cubeSizePx]);

  useEffect(() => {
    writeOption('showTimesInsteadOfGraph', String(showTimesInsteadOfGraph));
  }, [showTimesInsteadOfGraph]);

  const setCubeSizePx = useCallback((value: number) => {
    setCubeSizePxState(clampInt(value, 240, 600, 400));
  }, []);

  return useMemo(() => ({
    darkMode,
    showAlgName,
    countdownMode,
    alwaysScrambleTo,
    autoUpdateLearningState,
    visualization,
    backview,
    hintFacelets,
    fullStickering,
    whiteOnBottom,
    gyroscope,
    controlPanel,
    flashingIndicatorEnabled,
    cubeSizePx,
    showTimesInsteadOfGraph,
    setDarkMode: setDarkModeState,
    setShowAlgName: setShowAlgNameState,
    setCountdownMode: setCountdownModeState,
    setAlwaysScrambleTo: setAlwaysScrambleToState,
    setAutoUpdateLearningState: setAutoUpdateLearningStateState,
    setVisualization: setVisualizationState,
    setBackview: setBackviewState,
    setHintFacelets: setHintFaceletsState,
    setFullStickering: setFullStickeringState,
    setWhiteOnBottom: setWhiteOnBottomState,
    setGyroscope: setGyroscopeState,
    setControlPanel: setControlPanelState,
    setFlashingIndicatorEnabled: setFlashingIndicatorEnabledState,
    setCubeSizePx,
    setShowTimesInsteadOfGraph,
  }), [
    alwaysScrambleTo,
    autoUpdateLearningState,
    backview,
    countdownMode,
    controlPanel,
    cubeSizePx,
    darkMode,
    flashingIndicatorEnabled,
    fullStickering,
    gyroscope,
    hintFacelets,
    setCubeSizePx,
    showAlgName,
    showTimesInsteadOfGraph,
    visualization,
    whiteOnBottom,
  ]);
}
