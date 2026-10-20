import type { PuzzleId } from './puzzles';

const VALID_STICKERING = [
  'EOcross',
  'LSOCLL',
  'EOline',
  'LSOLL',
  'Daisy',
  'Cross',
  'ZBLS',
  'ZBLL',
  'WVLS',
  'OCLL',
  'L6EO',
  'L10P',
  'EPLL',
  'EOLL',
  'CPLL',
  'COLL',
  'CMLL',
  'VLS',
  'PLL',
  'OLL',
  'L6E',
  'F2L',
  'ELS',
  'ELL',
  'CLS',
  'CLL',
  'LS',
  'LL',
  'EO',
] as const;

export function getStickeringForCategory(category: string, fullStickeringEnabled: boolean, puzzle: PuzzleId = '3x3x3'): string {
  if (fullStickeringEnabled || (puzzle !== '3x3x3' && puzzle !== '2x2x2')) {
    return 'full';
  }

  const stickerings = puzzle === '2x2x2' ? ['OLL'] : VALID_STICKERING;
  const categoryWithoutSymbols = category.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  for (const item of stickerings) {
    if (categoryWithoutSymbols === item.toLowerCase()) {
      return item;
    }
  }

  const categoryWords = category.toLowerCase().split(/[^a-zA-Z0-9]+/);
  for (const item of stickerings) {
    for (const word of categoryWords) {
      if (word === item.toLowerCase()) {
        return item;
      }
    }
  }

  return 'full';
}
