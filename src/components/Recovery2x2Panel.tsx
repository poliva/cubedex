import { useEffect, useRef, useState } from 'react';
import type { KPattern } from 'cubing/kpuzzle';
import type { SmartcubeConnectionState } from '../hooks/useSmartcubeConnection';
import { fixOrientation, get2x2RecoveryMoves, patternToPlayerAlg } from '../lib/scramble';
import { TwistyCube } from './TwistyCube';

type Recovery = {
  phase: 'loading' | 'align' | 'computing' | 'guiding' | 'error';
  reference: KPattern | null;
  steps: Array<{ before: KPattern; after: KPattern; move: string }>;
  index: number;
  notice: string;
};
const initial: Recovery = { phase: 'loading', reference: null, steps: [], index: 0, notice: '' };
const equivalent = (a: KPattern, b: KPattern) => fixOrientation(a).isIdentical(fixOrientation(b));

export function Recovery2x2Panel({ smartcube, target, onRecovered, onCancel }: {
  smartcube: SmartcubeConnectionState;
  target: KPattern;
  onRecovered: (pattern: KPattern) => boolean;
  onCancel: () => void;
}) {
  const [state, setState] = useState<Recovery>(initial);
  const [replay, setReplay] = useState(0);
  const generation = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const moveKey = useRef(smartcube.lastProcessedMove?.key);

  async function refresh() {
    const version = ++generation.current;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setState(initial);
    try {
      const reference = await smartcube.refreshPattern(abort.signal);
      if (generation.current !== version) return;
      if (onRecovered(reference)) return;
      setState({ ...initial, phase: 'align', reference, notice: '' });
    } catch (error) {
      if (generation.current !== version) return;
      setState({ ...initial, phase: 'error', notice: error instanceof Error ? error.message : 'Could not read the cube. Please retry.' });
    }
  }

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; abortRef.current?.abort(); };
  // The panel is scoped to one attempt; its owner unmounts it on lifecycle changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = smartcube.currentPattern;
    const moved = moveKey.current !== smartcube.lastProcessedMove?.key;
    moveKey.current = smartcube.lastProcessedMove?.key;
    if (!current || !state.reference || state.phase === 'loading' || state.phase === 'error') return;
    if (onRecovered(current)) return;
    if (!moved && current.isIdentical(state.reference)) return;
    if (state.phase === 'guiding') {
      const next = state.steps.findIndex((step, i) => i >= state.index && equivalent(current, step.after));
      if (next >= 0) {
        if (next + 1 < state.steps.length) {
          setState(previous => ({ ...previous, index: next + 1, reference: previous.steps[next + 1].before }));
        }
        return;
      }
      // A repeated unchanged snapshot does not mean the user turned a layer.
      if (!moved && equivalent(current, state.steps[state.index].before)) return;
    } else if (!moved && equivalent(current, state.reference)) return;
    generation.current += 1;
    setState({ ...initial, phase: 'align', reference: current,
      notice: 'The cube changed. Match the updated picture before continuing.' });
  }, [smartcube.currentPattern, smartcube.lastProcessedMove?.key, state, onRecovered]);

  useEffect(() => {
    if (!smartcube.stateSyncError || state.phase === 'loading' || state.phase === 'error') return;
    generation.current += 1;
    setState(previous => ({ ...previous, phase: 'error', notice: smartcube.stateSyncError! }));
  }, [smartcube.stateSyncError, state.phase]);

  async function confirm() {
    if (!state.reference) return;
    const reference = state.reference;
    const version = ++generation.current;
    setState(previous => ({ ...previous, phase: 'computing' }));
    try {
      const moves = await get2x2RecoveryMoves(reference, target);
      if (version !== generation.current) return;
      if (!moves.length) { onRecovered(reference); return; }
      let before = reference;
      // Quarter-turn steps also accept firmware that delivers a half turn as two packets.
      const quarters = moves.flatMap(move => move.endsWith('2') ? [move[0], move[0]] : [move]);
      const steps = quarters.map(move => {
        const after = before.applyMove(move);
        const step = { before, after, move };
        before = after;
        return step;
      });
      setState({ ...initial, phase: 'guiding', reference, steps, index: 0 });
    } catch (error) {
      if (version !== generation.current) return;
      setState(previous => ({ ...previous, phase: 'error', notice: error instanceof Error ? error.message : 'Could not calculate recovery.' }));
    }
  }

  const guiding = state.phase === 'guiding';
  const turn = guiding ? state.steps[state.index].move : '';
  const setup = state.reference ? patternToPlayerAlg(state.reference) : '';
  return <section className="recovery-panel" aria-label="2×2 visual recovery">
    <div aria-live="polite" className="recovery-instructions">
      <strong>{guiding ? `Follow this turn: ${turn}` : 'Match your cube'}</strong>
      <p>{guiding
        ? 'Keep this grip. Copy the moving layer, then wait for the next turn.'
        : 'Rotate the whole cube to match this picture. Don’t turn any layers.'}</p>
      {state.notice && <p role={state.phase === 'error' ? 'alert' : 'status'}>{state.notice}</p>}
    </div>
    {state.reference && state.phase !== 'error' ? <div className="recovery-picture" aria-label={guiding ? `Animated correction ${turn}` : 'Current scrambled cube, top front and right visible'}>
      <TwistyCube key={`${setup}:${state.index}:${guiding}:${replay}`}
        puzzle="2x2x2" setupAlg={setup} alg={turn} autoplay={guiding} tempoScale={0.65}
        visualization="3D" hintFacelets="none" controlPanel="none" experimentalStickering="full"
        cameraLatitude={30} cameraLongitude={30} dragInput="none" backView="none"
        gyroscopeEnabled={false} enableExternalOrientationLoop={false} className="recovery-player" />
    </div> : null}
    {(state.phase === 'loading' || state.phase === 'computing') && <p role="status">{state.phase === 'loading' ? 'Reading current stickers… Keep the layers still.' : 'Finding correction turns…'}</p>}
    <div className="recovery-actions">
      {state.phase === 'align' && <button className="recovery-button recovery-button--primary" type="button" disabled={smartcube.stateSyncing} onClick={() => void confirm()}>My cube matches</button>}
      {guiding && <button className="recovery-button recovery-button--primary" type="button" onClick={() => setReplay(value => value + 1)}>Show turn again</button>}
      {state.phase !== 'loading' && <button className="recovery-button" type="button" onClick={() => void refresh()}>{state.phase === 'error' ? 'Retry reading cube' : 'Picture doesn’t match? Refresh'}</button>}
      <button className="recovery-button" type="button" onClick={onCancel}>Back to undo help</button>
    </div>
  </section>;
}
