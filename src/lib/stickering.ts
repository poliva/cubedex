import { categoryName, PUZZLES, type PuzzleId } from './puzzles';

const CUBE_STICKERINGS = [
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
  'FirstBlock',
  'SecondBlock',
  'EODF',
  'G1',
] as const;

// Algorithm stickerings advertised by the installed cubing.js puzzle loaders.
// Keep puzzle-specific masks out of other puzzles: unsupported masks can dim
// the entire puzzle instead of falling back to full stickers.
const STICKERINGS: Partial<Record<PuzzleId, readonly string[]>> = {
  '2x2x2': [...CUBE_STICKERINGS, 'OBL', 'PBL'],
  '3x3x3': CUBE_STICKERINGS,
  '4x4x4': [...CUBE_STICKERINGS, 'L2C', 'opposite-centers'],
  '5x5x5': [...CUBE_STICKERINGS, 'L2C'],
  '6x6x6': [...CUBE_STICKERINGS, 'L2C'],
  '7x7x7': CUBE_STICKERINGS,
  megaminx: [
    'OLL', 'PLL', 'LL', 'EOLL', 'COLL', 'OCLL', 'CPLL', 'CLL',
    'EPLL', 'ELL', 'ZBLL', 'LS', 'LSOLL', 'LSOCLL', 'ELS', 'CLS',
    'ZBLS', 'VLS', 'WVLS',
  ],
  fto: [
    'experimental-fto-fc', 'experimental-fto-f2t', 'experimental-fto-sc',
    'experimental-fto-l2c', 'experimental-fto-lbt', 'experimental-fto-l3t',
  ],
};

const MEGAMINX_ALIASES: Record<string, string> = {
  EO: 'EOLL',
  CO: 'OCLL',
  EP: 'EPLL',
  CP: 'CPLL',
  'Edge Orientation': 'EOLL',
  'Corner Orientation': 'OCLL',
  'Edge Permutation': 'EPLL',
  'Corner Permutation': 'CPLL',
};

const LAST_LAYER_STICKERINGS = new Set([
  'OLL', 'PLL', 'LL', 'EOLL', 'COLL', 'OCLL', 'CPLL', 'CLL',
  'EPLL', 'ELL', 'ZBLL', 'CMLL',
]);

function normalizeCategory(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function getStickeringForCategory(category: string, fullStickeringEnabled: boolean, puzzle: PuzzleId = '3x3x3', caseName?: string): string {
  if (fullStickeringEnabled) {
    return 'full';
  }

  const stickerings = STICKERINGS[puzzle] ?? [];
  const candidates = stickerings.map(item => [item, item]);
  if (puzzle === 'megaminx') {
    candidates.push(...Object.entries(MEGAMINX_ALIASES));
  }
  if (stickerings.includes('L2C')) {
    candidates.push(['Last Two Centers', 'L2C']);
  }
  if (puzzle === 'fto') {
    candidates.push(...stickerings.map(item => [item.replace('experimental-fto-', ''), item]));
  }

  let name = categoryName(category);
  // Big-cube parity libraries can mix OLL and PLL in one set.
  if (PUZZLES[puzzle].cube && normalizeCategory(name) === 'parity' && caseName) {
    name = caseName;
  }
  const categoryWithoutSymbols = normalizeCategory(name);
  for (const [label, stickering] of candidates) {
    if (categoryWithoutSymbols === normalizeCategory(label)) {
      return stickering;
    }
  }

  const categoryWords = name.toLowerCase().split(/[^a-zA-Z0-9]+/);
  for (const [label, stickering] of candidates) {
    if (categoryWords.includes(label.toLowerCase())) {
      return stickering;
    }
  }

  return 'full';
}

export function getCasePreviewVisualization(category: string, puzzle: PuzzleId = '3x3x3', caseName?: string): string {
  const stickering = getStickeringForCategory(category, false, puzzle, caseName);
  const lastLayer = LAST_LAYER_STICKERINGS.has(stickering)
    || (puzzle === '3x3x3' && categoryName(category).toLowerCase().includes('ll'));
  if (PUZZLES[puzzle].lastLayerPreview && lastLayer) {
    return 'experimental-2D-LL';
  }
  return '3D';
}
