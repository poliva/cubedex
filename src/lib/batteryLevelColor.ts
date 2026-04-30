/** Text color for smartcube battery percentage (CSS color value). */
export function batteryLevelTextColor(level: number): string {
  if (level <= 10) return 'var(--danger)';
  if (level <= 30) return '#f97316';
  return 'var(--ok)';
}
