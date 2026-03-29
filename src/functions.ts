// -- Functions (re-export hub) -----------------------------------------
// This file only re-exports symbols from their actual modules so that
// existing consumer imports (e.g. `import { X } from './functions'`)
// continue to work without changing every call-site.

// -- Re-exports from extraction modules ---------------------------------

export {
  expandNotation, getInverseMove, isCubeRotation, getSliceFaceComponents,
  getSliceForComponents, getWideFaceComponent, getOppositeMove,
  moveToRotationEquivalent, flattenAlg, getOrientationCompensation,
  splitAlgAtCursor, algToId, countMovesETM,
  notationallyAlgEquivalent, trailingWholeCubeRotationMoveCount,
} from './notationHelper';

export {
  CORNER_FACELETS, EDGE_FACELETS, CENTER_FACELETS as CENTER_FACELETS_LIST,
  CORNER_SLOT_NAMES, EDGE_SLOT_NAMES,
  CATEGORY_IGNORED_FACELETS, CATEGORY_DIMMED_FACELETS, ALL_FACELETS,
  fixOrientation, IGNORE_PIECE_MAP, partialStateEquals,
  rotateFacelets,
  buildStickeringMaskFromFacelets, buildStickeringMaskString,
} from './faceMasking';
export type { StickeringMask } from './faceMasking';

export {
  isCaseSymmetric, isCaseSemiSymmetric,
} from './utils';

export {
  applyRotationToFaceMap, getOrientationChange, buildAlgFaceMap,
  transformMoveByFaceMap, invertFaceMap, composeFaceMaps, isIdentityFaceMap,
  SLICE_ROTATION, updateSliceOrientation, remapMoveForPlayer,
} from './faceMap';

export {
  learnedSVG, learnedStatus, bestTimeNumber, bestTimeString,
  averageOfFiveTimeNumber, averageOf12TimeNumber, averageTimeString,
  getLastTimes, getFailedCount, getSuccessCount, getPracticeCount,
  getLastResults, getFailRateAo12,
} from './pageUtils';

export {
  initializeDefaultAlgorithms, saveAlgorithm, deleteAlgorithm,
  exportAlgorithms,
} from './algorithmStorage';

export {
  createTimeGraph, createStatsGraph, createModalStatsGraph,
} from './graphing';

// -- Re-exports from handler / UI modules -------------------------------

export {
  getStickeringMaskForCategory, applyMaskToPlayer, setStickering,
} from './visualization';

export {
  requestWakeLock, releaseWakeLock,
} from './handlers/handlersDevice';

export {
  loadCategories, loadSubsets, loadAlgorithms, importAlgorithms,
} from './handlers/handlersLoad';
