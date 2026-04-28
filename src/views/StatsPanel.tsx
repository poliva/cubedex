import { memo } from 'react';
import type { TrainingStats } from '../hooks/useTrainingState';
import { EmptyState } from '../components/ui/EmptyState';

function StatsPanelComponent({
  visible,
  showAlgName,
  algName,
  stats,
  onOpenCaseLibrary,
}: {
  visible: boolean;
  showAlgName: boolean;
  algName: string;
  stats: TrainingStats;
  onOpenCaseLibrary?: () => void;
}) {
  if (!visible) {
    return <div id="alg-stats" className="hidden stats-panel" />;
  }

  if (!stats.hasHistory) {
    return (
      <div
        id="alg-stats"
        className="stats-panel stats-panel--empty"
        style={{
          padding: '16px 18px',
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          boxShadow: '0 4px 16px oklch(0% 0 0 / 0.1)',
        }}
      >
        <EmptyState
          title="No solves yet"
          description="Pick a case in the library, then time your solutions here."
          action={onOpenCaseLibrary
            ? { label: 'Open case library', onClick: onOpenCaseLibrary }
            : undefined}
          data-testid="stats-empty-state"
        />
      </div>
    );
  }

  return (
    <div id="alg-stats" className="stats-panel" style={{
      padding: '16px 18px',
      borderRadius: 16,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      boxShadow: '0 8px 24px oklch(0% 0 0 / 0.16)',
    }}
    >
      <div id="stats-container" className="stats-graph-container">
        <div className="stats-graph-shell">
          <canvas id="statsGraph" className="stats-graph-canvas" />
        </div>
      </div>
      <div id="metrics-container" className="metrics-container">
        <div id="alg-name-display2" className="metrics-title" style={{ marginBottom: 10 }}>
          {showAlgName ? algName : ''}
        </div>
        <div id="stats-grid" className="metrics-grid">
          <div id="average-time-box" className="metric-box metric-box--time">
            <div className="metric-box-title">Average Time</div>
            <div className="metric-time-row">
              <span className="metric-time-label">Exec</span>
              <span className="metric-time-value">{stats.avgExec}</span>
            </div>
            <div className="metric-time-row metric-time-row--secondary">
              <span className="metric-time-label">Recog</span>
              <span className="metric-time-value">{stats.avgRecog}</span>
            </div>
          </div>
          <div id="average-tps-box" className="metric-box">Average TPS<br />{stats.averageTps}</div>
        </div>
      </div>
    </div>
  );
}

export const StatsPanel = memo(StatsPanelComponent);
