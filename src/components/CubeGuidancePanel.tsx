import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { KPattern } from 'cubing/kpuzzle';
import type { SmartcubeConnectionState } from '../hooks/useSmartcubeConnection';
import { useGuidanceOrientation } from '../hooks/useGuidanceOrientation';
import { patternCubeSize } from '../lib/cube-utils';
import { guidanceFrameRotation, guidanceGripRotation, WRONG_GRIP_ANGLE } from '../lib/cube-orientation';
import { alignForGuidance, fixOrientation, getGuidanceMoves, patternToGuidanceAlg } from '../lib/scramble';
import { TwistyCube } from './TwistyCube';
import { GripRotationWarning } from './GripRotationWarning';

type Recovery = {
  phase: 'loading' | 'align' | 'computing' | 'guiding' | 'ready' | 'error';
  reference: KPattern | null;
  steps: Array<{ before: KPattern; after: KPattern; move: string }>;
  index: number;
  notice: string;
};
const initial: Recovery = { phase: 'loading', reference: null, steps: [], index: 0, notice: '' };
const equivalent = (a: KPattern, b: KPattern) => fixOrientation(a).isIdentical(fixOrientation(b));

export function CubeGuidancePanel({ smartcube, target, onRecovered, onCancel, mode = 'recovery', expertScrambler = false, onGripCheck, pictureControls }: {
  smartcube: SmartcubeConnectionState;
  target: KPattern;
  onRecovered: (pattern: KPattern) => boolean;
  onCancel: () => void;
  mode?: 'recovery' | 'setup';
  expertScrambler?: boolean;
  onGripCheck?: (check: ((pattern: KPattern) => boolean) | null) => void;
  pictureControls?: ReactNode;
}) {
  const [state, setState] = useState<Recovery>(initial);
  const [expertOverride, setExpertOverride] = useState<boolean | null>(null);
  const expert = expertOverride ?? expertScrambler;
  const size = patternCubeSize(target);
  const [replay, setReplay] = useState(0);
  const generation = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const readReference = useRef<KPattern | null>(null);
  const sensor = smartcube.currentPattern ?? readReference.current;
  // A fast layer turn can arrive before the step picture updates. Compare the
  // new stickers in the same grip so that progress never resets the warning.
  const orientationPicture = useMemo(() => sensor && state.reference && (state.phase === 'align' || state.phase === 'guiding' || state.phase === 'ready')
    ? alignForGuidance(sensor, state.reference) : null, [sensor, state.reference, state.phase]);
  const orientation = useGuidanceOrientation(smartcube, sensor, orientationPicture);
  const rotateFirst = Boolean(orientation?.misaligned);

  function gripMatches(pattern: KPattern) {
    const gyro = smartcube.cubeQuaternionRef.current;
    if (!smartcube.gyroSupported || !gyro) return true;
    const frame = guidanceFrameRotation(pattern, alignForGuidance(pattern, target));
    const rotation = frame && guidanceGripRotation(gyro, frame);
    return !rotation || rotation.angle < WRONG_GRIP_ANGLE;
  }

  useEffect(() => {
    // Recovery also receives packets through the training hook. Both paths
    // must wait for the grip, including a final turn delivered before this UI.
    onGripCheck?.(gripMatches);
    return () => onGripCheck?.(null);
  }, [onGripCheck, target, smartcube.gyroSupported, smartcube.cubeQuaternionRef]);

  async function refresh() {
    const version = ++generation.current;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setState(initial);
    try {
      const reference = await smartcube.refreshPattern(abort.signal);
      if (generation.current !== version) return;
      readReference.current = reference;
      const aligned = alignForGuidance(reference, target);
      if (mode === 'recovery' && equivalent(reference, target)) {
        if (gripMatches(reference) && onRecovered(reference)) return;
        setState({ ...initial, phase: 'ready', reference: aligned });
        return;
      }
      if (expert) await plan(aligned, '', false);
      else setState({ ...initial, phase: 'align', reference: aligned, notice: '' });
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
    if (!current || !state.reference || state.phase === 'loading' || state.phase === 'error') return;
    // A setup already on the target needs explicit grip confirmation. Once
    // turns begin, both guidance styles finish from sticker state automatically.
    if ((mode === 'recovery' || state.phase === 'guiding' || state.phase === 'ready') && equivalent(current, target)) {
      if (gripMatches(current) && onRecovered(current)) return;
      if (state.phase !== 'ready') setState(previous => ({ ...previous, phase: 'ready',
        reference: alignForGuidance(current, target), index: previous.steps.length }));
      return;
    }
    if (equivalent(current, state.reference)) return;
    if (state.phase === 'guiding') {
      const next = state.steps.findIndex((step, i) => i >= state.index && equivalent(current, step.after));
      if (next >= 0) {
        if (next + 1 < state.steps.length) {
          setState(previous => ({ ...previous, index: next + 1, reference: previous.steps[next + 1].before }));
        }
        return;
      }
      // An expert's half turn can begin clockwise or counterclockwise.
      const step = state.steps[state.index];
      if (expert && step.move === state.steps[state.index + 1]?.move) {
        const inverse = step.move.endsWith("'") ? step.move[0] : `${step.move}'`;
        const halfway = step.before.applyMove(inverse);
        if (equivalent(current, halfway)) {
          const steps = state.steps.map((entry, i) => i === state.index
            ? { ...entry, move: inverse, after: halfway }
            : i === state.index + 1 ? { ...entry, move: inverse, before: halfway } : entry);
          setState(previous => ({ ...previous, steps, index: previous.index + 1, reference: halfway }));
          return;
        }
      }
    }
    generation.current += 1;
    const reference = alignForGuidance(current, target);
    const notice = 'The cube changed. Match the updated picture before continuing.';
    if (expert) void plan(reference, notice);
    else setState({ ...initial, phase: 'align', reference, notice });
  }, [smartcube.currentPattern, smartcube.lastProcessedMove?.key, state, onRecovered, target, mode, expert, orientation?.rotation.angle]);

  useEffect(() => {
    if (!smartcube.stateSyncError || state.phase === 'loading' || state.phase === 'error') return;
    generation.current += 1;
    setState(previous => ({ ...previous, phase: 'error', notice: smartcube.stateSyncError! }));
  }, [smartcube.stateSyncError, state.phase]);

  async function plan(reference: KPattern, notice = '', allowFinish = true) {
    const version = ++generation.current;
    setState({ ...initial, phase: 'computing', reference, notice });
    try {
      const moves = await getGuidanceMoves(reference, target);
      if (version !== generation.current) return;
      if (!moves.length) {
        if (allowFinish) {
          if (gripMatches(reference) && onRecovered(reference)) return;
          setState({ ...initial, phase: 'ready', reference });
          return;
        }
        setState({ ...initial, phase: 'align', reference, notice: 'The stickers are ready. Match this grip to start the algorithm.' });
        return;
      }
      let before = reference;
      // Quarter-turn steps also accept firmware that delivers a half turn as two packets.
      const quarters = moves.flatMap(move => move.endsWith('2') ? [move[0], move[0]] : [move]);
      const steps = quarters.map(move => {
        const after = before.applyMove(move);
        const step = { before, after, move };
        before = after;
        return step;
      });
      setState({ ...initial, phase: 'guiding', reference, steps, index: 0, notice });
    } catch (error) {
      if (version !== generation.current) return;
      setState(previous => ({ ...previous, phase: 'error', notice: error instanceof Error ? error.message : 'Could not calculate recovery.' }));
    }
  }

  function switchGuidance() {
    const reference = smartcube.currentPattern ? alignForGuidance(smartcube.currentPattern, target) : state.reference;
    if (!reference) return;
    generation.current += 1;
    setExpertOverride(!expert);
    if (!expert) void plan(reference, '', false);
    else setState({ ...initial, phase: 'align', reference });
  }

  const guiding = state.phase === 'guiding';
  const turn = guiding ? state.steps[state.index].move : '';
  const setup = useMemo(() => state.reference ? patternToGuidanceAlg(state.reference) : '', [state.reference]);
  const sequence: Array<{ move: string; start: number; end: number }> = [];
  for (let i = 0; i < state.steps.length; i++) {
    const move = state.steps[i].move;
    const double = state.steps[i + 1]?.move === move;
    sequence.push({ move: double ? `${move[0]}2` : move, start: i, end: i + (double ? 2 : 1) });
    if (double) i++;
  }
  const puzzleName = `${size}×${size}`;
  return <section className="recovery-panel" aria-label={mode === 'setup' ? `${puzzleName} guided setup` : `${puzzleName} visual recovery`}>
    <div aria-live="polite" className="recovery-instructions">
      <strong>{state.phase === 'ready' ? 'Stickers ready — match the pictured grip' : rotateFirst ? 'Match the pictured grip' : expert && guiding ? `Full ${mode === 'setup' ? 'setup' : 'recovery'} sequence` : guiding ? `Follow this turn: ${turn}` : 'Match your cube'}</strong>
      <p>{state.phase === 'ready' ? 'The layers are ready. Rotate the whole cube to match this picture. Training resumes automatically.'
        : rotateFirst ? 'Rotate the whole cube to match the picture before making the next layer turn.' : expert && guiding
        ? 'Match the pictured grip, then turn at your own pace. Progress and completion are automatic. Keep this grip for the algorithm.'
        : guiding
        ? mode === 'setup'
          ? 'Keep this grip. Copy the moving layer, then wait for the next turn. When the setup is ready, start the algorithm without rotating the cube.'
          : 'Keep this grip. Copy the moving layer, then wait for the next turn. When recovered, continue the algorithm without rotating the cube.'
        : mode === 'setup'
          ? 'Rotate the whole cube to match this picture. Don’t turn any layers. Keep this grip through the setup and into the algorithm.'
          : 'Rotate the whole cube to match this picture. Don’t turn any layers. This grip will let you continue the algorithm after recovery.'}</p>
      {state.notice && <p role={state.phase === 'error' ? 'alert' : 'status'}>{state.notice}</p>}
    </div>
    {rotateFirst && orientation && <GripRotationWarning rotation={orientation.rotation} setupAlg={setup}
      size={size} onResetGyro={smartcube.resetGyro} />}
    {expert && (guiding || state.phase === 'ready') && state.steps.length > 0 && <>
      <ol className={`guidance-sequence${rotateFirst ? ' guidance-sequence--paused' : ''}`} aria-label={mode === 'setup' ? 'Setup algorithm' : 'Recovery algorithm'}>
        {sequence.map(({ move, start, end }) => <li key={start}
          className={end <= state.index ? 'guidance-sequence__done' : start <= state.index ? 'guidance-sequence__current' : ''}
          aria-current={start <= state.index && state.index < end ? 'step' : undefined}>{move}</li>)}
      </ol>
      <p className="guidance-progress" role="status">{sequence.filter(step => step.end <= state.index).length} of {sequence.length} moves complete</p>
    </>}
    {state.reference && state.phase !== 'error' ? <div className={`recovery-picture${rotateFirst ? ' recovery-picture--regrip' : ''}`} aria-label={guiding && !expert && !rotateFirst ? `Animated correction ${turn}` : 'Current scrambled cube, top front and right visible'}>
      {pictureControls}
      <TwistyCube key={`${setup}:${state.index}:${guiding}:${replay}:${rotateFirst}`}
        puzzle={size === 2 ? '2x2x2' : '3x3x3'} setupAlg={setup} alg={expert || rotateFirst ? '' : turn} autoplay={guiding && !expert && !rotateFirst} tempoScale={0.65}
        visualization="3D" hintFacelets="none" experimentalStickering="full"
        cameraLatitude={30} cameraLongitude={30} dragInput="none" backView="none"
        gyroscopeEnabled={false} enableExternalOrientationLoop={false} className="recovery-player" />
    </div> : null}
    {(state.phase === 'loading' || state.phase === 'computing') && <p role="status">{state.phase === 'loading' ? 'Reading current stickers… Keep the layers still.' : 'Finding correction turns…'}</p>}
    <div className="recovery-actions">
      {state.phase === 'align' && <button className="recovery-button recovery-button--primary" type="button" disabled={smartcube.stateSyncing || rotateFirst || Boolean(sensor && !gripMatches(sensor))} onClick={() => state.reference && void plan(state.reference)}>{expert ? 'Start algorithm' : 'My cube matches'}</button>}
      {guiding && !expert && <button className="recovery-button recovery-button--primary" type="button" disabled={rotateFirst} onClick={() => setReplay(value => value + 1)}>Show turn again</button>}
      {state.reference && state.phase !== 'loading' && state.phase !== 'error' && <button className="recovery-button" type="button" onClick={switchGuidance}>{expert ? 'Guide one turn at a time' : 'Show full sequence'}</button>}
      {state.phase === 'error' && <button className="recovery-button" type="button" onClick={() => void refresh()}>Retry reading cube</button>}
      <button className="recovery-button" type="button" onClick={onCancel}>{mode === 'setup' ? 'Cancel setup' : 'Back to undo help'}</button>
    </div>
  </section>;
}
