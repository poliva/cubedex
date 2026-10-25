import { GyroMotionDriftEstimator } from '../../src/lib/gyro-motion-drift';

/** Observe public state transitions in tests without a production recording hook. */
export function trackMotionChanges() {
  const model = new GyroMotionDriftEstimator();
  const changes: Array<{ kind: 'fit' | 'held' | 'home-adjustment' | 'recovery'; data: Record<string, any> }> = [];
  for (const method of ['completeObservation', 'completeHomeObservation'] as const) {
    const complete = model[method].bind(model);
    model[method] = (input: Parameters<typeof model.completeObservation>[0] | Parameters<typeof model.completeHomeObservation>[0]) => {
      const before = model.snapshot();
      complete(input as Parameters<typeof model.completeObservation>[0] & Parameters<typeof model.completeHomeObservation>[0]);
      const state = model.snapshot();
      const changed = (previous: unknown, current: unknown) => current != null && JSON.stringify(previous) !== JSON.stringify(current);
      const data = { ...state, at: input.at, attemptId: input.attemptId };
      if (changed(before.lastFit, state.lastFit)) changes.push({ kind: 'fit', data });
      else if (changed(before.homeGrip.lastAdjustment, state.homeGrip.lastAdjustment)) changes.push({ kind: 'home-adjustment', data });
      if (changed(before.lastRecovery, state.lastRecovery)) changes.push({ kind: 'recovery', data });
      if (changed(before.lastTrendHold, state.lastTrendHold) || before.holdReason !== state.holdReason && state.holdReason === 'recent-trend-changed') {
        changes.push({ kind: 'held', data: { ...data,
          reason: state.lastTrendHold?.at === input.at ? 'recent-pooled-trend-changed' : state.holdReason } });
      }
    };
  }
  return { model, changes };
}
