import { memo } from 'react';
import type { TrainingStats } from '../hooks/useTrainingState';

function StatsPanelComponent({
  visible,
  showAlgName,
  algName,
  stats,
}: {
  visible: boolean;
  showAlgName: boolean;
  algName: string;
  stats: TrainingStats;
}) {
  return (
    <div id="alg-stats" className={`${stats.hasHistory && visible ? 'stats-panel' : 'hidden stats-panel'}`}
      style={stats.hasHistory && visible ? {
        padding: '16px 18px',
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        boxShadow: '0 8px 24px oklch(0% 0 0 / 0.16)',
      } : undefined}>
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

