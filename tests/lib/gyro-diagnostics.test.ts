import { afterEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { GyroDiagnostics } from '../../src/lib/gyro-diagnostics';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('gyro diagnostic recordings', () => {
  it('retains device-specific sessions and correction data across reloads', () => {
    const log = new GyroDiagnostics(localStorage);
    log.startSession({ deviceName: 'GAN', cubeSize: 3 });
    log.record('correction-applied', { appliedDeg: 3 });
    log.startSession({ deviceName: 'MY22', cubeSize: 2 });
    log.record('manual-reset-comparison', { residualAfterAutoCorrection: { yawDeg: 5 } });
    log.flush();
    const entries = new GyroDiagnostics(localStorage).report().entries;
    expect(entries.find(e => e.event === 'correction-applied')?.data.device).toEqual({ deviceName: 'GAN', cubeSize: 3 });
    expect(entries.find(e => e.event === 'manual-reset-comparison')?.data.device).toEqual({ deviceName: 'MY22', cubeSize: 2 });
    expect(new Set(entries.map(e => e.sessionId)).size).toBe(2);
  });

  it('bounds record count and size and reports discarded history', () => {
    const log = new GyroDiagnostics(localStorage);
    for (let index = 0; index < 700; index++) log.record('test', { index, padding: 'x'.repeat(2000) });
    log.flush();
    const report = log.report();
    expect(report.entries.length).toBeLessThanOrEqual(600);
    expect(report.droppedEntries).toBeGreaterThan(100);
    expect(report.entries.at(-1)?.data.index).toBe(699);
    expect(JSON.stringify(report).length * 2).toBeLessThan(1_500_000);
  });

  it('batches storage writes and clears saved history without dropping device context', () => {
    vi.useFakeTimers();
    const log = new GyroDiagnostics(localStorage);
    log.startSession({ deviceName: 'Cube' });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    for (let i = 0; i < 100; i++) log.record('sample', { i });
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(write).toHaveBeenCalledOnce();
    log.clear();
    const entries = new GyroDiagnostics(localStorage).report().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ event: 'log-cleared', data: { device: { deviceName: 'Cube' } } });
  });

  it('keeps an exportable in-memory recording if local storage is unavailable', () => {
    const storage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } } as unknown as Storage;
    const log = new GyroDiagnostics(storage);
    log.record('manual-reset-comparison', { residualDeg: 7 });
    expect(() => log.flush()).not.toThrow();
    expect(log.report().persistenceError).toBe(true);
    expect(log.report().entries[0].event).toBe('manual-reset-comparison');
    log.clear();
  });

  it('downloads valid JSON with the thresholds and recorded events', async () => {
    vi.useFakeTimers();
    let blob: NodeBlob | null = null;
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(value => { blob = value; return 'blob:gyro'; }), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const log = new GyroDiagnostics(null);
    log.record('correction-applied', { appliedDeg: 2 });
    log.download();
    expect(click).toHaveBeenCalledOnce();
    expect(blob!.type).toBe('application/json');
    const json = await blob!.text();
    expect(JSON.parse(json)).toMatchObject({ schemaVersion: 2, estimatorVersion: 4, thresholds: { steadyMs: 600 } });
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:gyro');
    vi.unstubAllGlobals();
  });

  it('stores overlapping sample windows once and restores their event references after reloading', () => {
    const log = new GyroDiagnostics(localStorage);
    log.startSession({ deviceName: 'GAN' });
    const recentSamples = [{ at: 100, steadyMs: 0 }, { at: 200, steadyMs: 100 }];
    log.record('algorithm-complete', { recentSamples });
    log.record('manual-reset-comparison', { beforeClick: { recentSamples } });
    log.flush();
    const report = new GyroDiagnostics(localStorage).report();
    expect(report.samples).toHaveLength(2);
    expect(report.entries.find(e => e.event === 'algorithm-complete')?.data.recentSampleTimes).toEqual([100, 200]);
    expect(report.entries.find(e => e.event === 'manual-reset-comparison')?.data.beforeClick).toEqual({ recentSampleTimes: [100, 200] });
  });

  it('retains reset and connection anchors when routine telemetry exceeds the recording limit', () => {
    const log = new GyroDiagnostics(localStorage);
    log.startSession({ deviceName: 'Weipo' });
    log.record('reference-established', { at: 0 });
    log.record('manual-reset-comparison', { residualDeg: 15.7 });
    for (let at = 0; at < 1600; at++) log.record('sample', { at, corrected: { x: 0, y: 0, z: 0, w: 1 } });
    log.flush();
    const report = log.report();
    expect(report.droppedEntries).toBeGreaterThan(0);
    expect(report.entries.some(e => e.event === 'connection')).toBe(true);
    expect(report.entries.some(e => e.event === 'reference-established')).toBe(true);
    expect(report.entries.some(e => e.event === 'manual-reset-comparison')).toBe(true);
    expect(report.entries.length).toBeLessThanOrEqual(1000);
  });

  it('discards redundant sample pointers before sensor evidence when the byte budget is reached', () => {
    const log = new GyroDiagnostics(localStorage);
    log.startSession({ deviceName: 'GAN', metadata: 'x'.repeat(300) });
    for (let index = 0; index < 80; index++) log.record('algorithm-ready', { index, algorithm: 'R', padding: 'x'.repeat(2500) });
    const q = { x: .123456789012345, y: .234567890123456, z: .345678901234567, w: .901234567890123 };
    for (let at = 0; at < 900; at++) log.record('sample', { at, corrected: q, uncorrected: q, steadyMs: 600,
      sampleGapMs: 60, angularSpeedDegPerSecond: .123456789012345 });
    log.flush();
    const report = log.report();
    expect(report.droppedEntries).toBeGreaterThan(0);
    expect(report.entries.some(entry => entry.event === 'connection')).toBe(true);
    expect(report.entries.filter(entry => entry.event === 'algorithm-ready')).toHaveLength(80);
    expect(report.samples).toHaveLength(900);
    expect(report.droppedSamples).toBe(0);
    expect(JSON.stringify(report).length * 2).toBeLessThanOrEqual(1_500_000);
    expect(new GyroDiagnostics(localStorage).report().samples).toHaveLength(900);
  });

  it('loads version-one recordings without losing reset measurements', () => {
    localStorage.setItem('cubedex.gyroDiagnostics.v1', JSON.stringify({ schemaVersion: 1, estimatorVersion: 1,
      thresholds: { endpointTimeoutMs: 1200 }, droppedEntries: 106,
      entries: [{ event: 'manual-reset-comparison', recordedAt: new Date().toISOString(), sessionId: 'old-gan',
        data: { residualAfterAutoCorrection: { yawDeg: -22.37 }, beforeClick: { recentSamples: [{ at: 100, steadyMs: 600 }] } } }] }));
    const report = new GyroDiagnostics(localStorage).report();
    expect(report.entries[0].data.residualAfterAutoCorrection).toEqual({ yawDeg: -22.37 });
    expect(report.samples[0]).toMatchObject({ at: 100, sessionId: 'old-gan' });
    expect(report.droppedEntries).toBe(106);
    expect(report.entries[0].estimatorVersion).toBe(1);
    expect(report.thresholdSets['1']).toEqual({ endpointTimeoutMs: 1200 });
    expect(report.thresholdSets['4']).toMatchObject({ endpointTimeoutMs: 3000 });
  });

  it('retains a short reset and guidance context after shared sensor samples have been evicted', () => {
    const log = new GyroDiagnostics(localStorage);
    const recentSamples = Array.from({ length: 20 }, (_, at) => ({ at, corrected: { x: 0, y: 0, z: 0, w: 1 } }));
    log.record('guided-reference', { before: { recentSamples }, headingAdjustmentDeg: -37 });
    log.record('manual-reset-request', { recentSamples });
    for (let at = 100; at < 3500; at++) log.record('sample', { at });
    log.flush();
    const report = new GyroDiagnostics(localStorage).report();
    expect(report.samples.every(sample => sample.at >= 100)).toBe(true);
    for (const event of ['guided-reference', 'manual-reset-request']) {
      expect(report.entries.find(entry => entry.event === event)?.data.contextSamples).toEqual(recentSamples.slice(-12));
    }
    expect(new GyroDiagnostics(localStorage).report().entries.some(entry => entry.event === 'guided-reference')).toBe(true);
  });
});
