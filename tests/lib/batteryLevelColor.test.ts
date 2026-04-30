import { describe, expect, it } from 'vitest';
import { batteryLevelTextColor } from '../../src/lib/batteryLevelColor';

describe('batteryLevelTextColor', () => {
  it('uses red at 10% or below', () => {
    expect(batteryLevelTextColor(0)).toBe('var(--danger)');
    expect(batteryLevelTextColor(10)).toBe('var(--danger)');
  });

  it('uses orange between 11% and 30%', () => {
    expect(batteryLevelTextColor(11)).toBe('#f97316');
    expect(batteryLevelTextColor(29)).toBe('#f97316');
    expect(batteryLevelTextColor(30)).toBe('#f97316');
  });

  it('uses green above 30%', () => {
    expect(batteryLevelTextColor(31)).toBe('var(--ok)');
    expect(batteryLevelTextColor(100)).toBe('var(--ok)');
  });
});
