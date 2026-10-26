import { puzzles } from 'cubing/puzzles';

/** One registry drives selection, rendering and practice capabilities. */
export const PUZZLES = {
  '2x2x2': { name: '2×2', available: true, cube: true, smartcube: true, randomAUF: true, lastLayerPreview: false },
  '3x3x3': { name: '3×3', available: true, cube: true, smartcube: true, randomAUF: true, lastLayerPreview: true },
  '4x4x4': { name: '4×4', available: true, cube: true, smartcube: false, randomAUF: false, lastLayerPreview: false },
  '5x5x5': { name: '5×5', available: true, cube: true, smartcube: false, randomAUF: false, lastLayerPreview: false },
  '6x6x6': { name: '6×6', available: true, cube: true, smartcube: false, randomAUF: false, lastLayerPreview: false },
  '7x7x7': { name: '7×7', available: true, cube: true, smartcube: false, randomAUF: false, lastLayerPreview: false },
  pyraminx: { name: 'Pyraminx', available: true, cube: false, smartcube: false, randomAUF: false, lastLayerPreview: false },
  megaminx: { name: 'Megaminx', available: true, cube: false, smartcube: false, randomAUF: false, lastLayerPreview: false },
  skewb: { name: 'Skewb', available: true, cube: false, smartcube: false, randomAUF: false, lastLayerPreview: false },
  fto: { name: 'FTO', available: true, cube: false, smartcube: false, randomAUF: false, lastLayerPreview: false },
  // Retain the namespace for old libraries/backups, but do not offer it for practice.
  square1: { name: 'Square-1', available: false, cube: false, smartcube: false, randomAUF: false, lastLayerPreview: false },
} as const;

export type PuzzleId = keyof typeof PUZZLES;
export const DEFAULT_PUZZLE: PuzzleId = '3x3x3';
const knownPuzzleIds = Object.keys(PUZZLES) as PuzzleId[];
export const puzzleIds = knownPuzzleIds.filter((id) => PUZZLES[id].available);
export function isPuzzleId(value: string): value is PuzzleId {
  return Object.hasOwn(PUZZLES, value) && PUZZLES[value as PuzzleId].available;
}

/** Legacy, unprefixed category IDs remain 3×3 so stored statistics retain their IDs. */
export function categoryPuzzle(category: string): PuzzleId {
  const prefix = category.split(':', 1)[0];
  return category.includes(':') && Object.hasOwn(PUZZLES, prefix) ? prefix as PuzzleId : DEFAULT_PUZZLE;
}
export function categoryName(category: string): string {
  return category.includes(':') && Object.hasOwn(PUZZLES, category.split(':', 1)[0])
    ? category.slice(category.indexOf(':') + 1) : category;
}
export function categoryId(puzzle: PuzzleId, name: string): string {
  return puzzle === DEFAULT_PUZZLE ? name : `${puzzle}:${name}`;
}
export function puzzleLoader(puzzle: PuzzleId) {
  return puzzles[puzzle];
}
