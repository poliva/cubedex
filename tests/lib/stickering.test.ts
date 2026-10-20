import { describe, expect, it } from 'vitest';
import { getStickeringForCategory } from '../../src/lib/stickering';

describe('getStickeringForCategory', () => {
  it('returns full when full stickering is enabled', () => {
    expect(getStickeringForCategory('PLL', true)).toBe('full');
  });

  it('matches known categories even when symbols are present', () => {
    expect(getStickeringForCategory('ZBLL!', false)).toBe('ZBLL');
    expect(getStickeringForCategory('L6E-O', false)).toBe('L6EO');
    expect(getStickeringForCategory('EOcross practice', false)).toBe('EOcross');
  });

  it('matches stickering names from category words', () => {
    expect(getStickeringForCategory('Winter Variation / WVLS', false)).toBe('WVLS');
    expect(getStickeringForCategory('Practice OLL Cases', false)).toBe('OLL');
  });

  it('falls back to full for unknown categories', () => {
    expect(getStickeringForCategory('My Custom Category', false)).toBe('full');
  });

  it('uses OLL stickering for 2×2 unless full stickers are enabled', () => {
    expect(getStickeringForCategory('2x2x2:OLL', false, '2x2x2')).toBe('OLL');
    expect(getStickeringForCategory('2x2x2:OLL', true, '2x2x2')).toBe('full');
  });

  it('keeps full stickers for other 2×2 categories and other puzzles', () => {
    expect(getStickeringForCategory('CLL', false, '2x2x2')).toBe('full');
    expect(getStickeringForCategory('PBL', false, '2x2x2')).toBe('full');
    expect(getStickeringForCategory('OLL Parity', false, '4x4x4')).toBe('full');
    expect(getStickeringForCategory('OLL', false, 'megaminx')).toBe('full');
  });
});
