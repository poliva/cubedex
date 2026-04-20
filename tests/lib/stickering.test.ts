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
});
