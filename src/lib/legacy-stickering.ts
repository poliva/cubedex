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

export function getLegacyStickering(category: string, fullStickeringEnabled: boolean): string {
  if (fullStickeringEnabled) {
    return 'full';
  }

  const categoryWithoutSymbols = category.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  for (const item of VALID_STICKERING) {
    if (categoryWithoutSymbols === item.toLowerCase()) {
      return item;
    }
  }

  const categoryWords = category.toLowerCase().split(/[^a-zA-Z0-9]+/);
  for (const item of VALID_STICKERING) {
    for (const word of categoryWords) {
      if (word === item.toLowerCase()) {
        return item;
      }
    }
  }

  return 'full';
}
