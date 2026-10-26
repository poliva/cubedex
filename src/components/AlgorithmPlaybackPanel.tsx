import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alg } from 'cubing/alg';
import type { TwistyPlayer, ExperimentalLeafIndex } from 'cubing/twisty';
import type { PuzzleId } from '../lib/puzzles';
import { TwistyCube } from './TwistyCube';
import { Icon } from './ui/Icon';

type Timeline = Awaited<ReturnType<TwistyPlayer['experimentalModel']['detailedTimelineInfo']['get']>>;
type PlayingInfo = Awaited<ReturnType<TwistyPlayer['experimentalModel']['playingInfo']['get']>>;

export function AlgorithmPlaybackPanel({ algorithm, puzzle, setupAlg, backView, onClose, pictureControls }: {
  algorithm: string;
  puzzle: PuzzleId;
  setupAlg: string;
  backView: 'none' | 'side-by-side' | 'top-right';
  onClose: () => void;
  pictureControls?: ReactNode;
}) {
  // Expand repetitions and commutators so every displayed token is one turn.
  const sequence = useMemo(() => {
    try { return [...new Alg(algorithm).experimentalLeafMoves()].map(move => move.toString()); }
    catch { return []; }
  }, [algorithm]);
  const [player, setPlayer] = useState<TwistyPlayer | null>(null);
  const [completed, setCompleted] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [speed, setSpeed] = useState(0.65);
  const connectPlayer = useCallback((value: TwistyPlayer) => { setPlayer(value); }, []);

  useEffect(() => {
    if (!player) return;
    let active = true;
    let onTimeline: ((value: Timeline) => void) | undefined;
    const onPlaying = (value: PlayingInfo) => { if (active) setPlaying(value.playing); };
    player.experimentalModel.playingInfo.addFreshListener(onPlaying);
    void player.experimentalModel.indexer.get().then(indexer => {
      if (!active) return;
      const ends = sequence.map((_, i) => {
        const index = i as ExperimentalLeafIndex;
        return indexer.indexToMoveStartTimestamp(index) + indexer.moveDuration(index);
      });
      onTimeline = value => {
        if (!active) return;
        setAtStart(value.atStart);
        setCompleted(value.atEnd ? sequence.length : ends.filter(end => end <= value.timestamp).length);
      };
      player.experimentalModel.detailedTimelineInfo.addFreshListener(onTimeline);
      setReady(true);
    });
    return () => {
      active = false;
      player.pause();
      player.experimentalModel.playingInfo.removeFreshListener(onPlaying);
      if (onTimeline) player.experimentalModel.detailedTimelineInfo.removeFreshListener(onTimeline);
    };
  }, [player, sequence]);

  function step(direction: 1 | -1) {
    // Use the player's own move boundaries, including a partially played turn.
    player?.controller.animationController.play({
      direction, untilBoundary: 'move' as PlayingInfo['untilBoundary'],
      autoSkipToOtherEndIfStartingAtBoundary: false,
    });
  }

  async function seek(index: number) {
    if (!player) return;
    player.pause();
    const indexer = await player.experimentalModel.indexer.get();
    player.timestamp = indexer.indexToMoveStartTimestamp(index as ExperimentalLeafIndex);
  }

  const atEnd = completed === sequence.length;
  return <section className="recovery-panel algorithm-playback" aria-label="Learn algorithm"
    onKeyDown={event => { if (event.code === 'Space') event.stopPropagation(); }}
    onKeyUp={event => { if (event.code === 'Space') event.stopPropagation(); }}>
    <div className="algorithm-playback__heading">
      <strong>Learn algorithm</strong>
      <button type="button" className="recovery-button" onClick={onClose}>Back to practice</button>
    </div>
    <p className="algorithm-playback__hint">Follow the highlighted move. Pause or step through at your own pace.</p>
    <div className="algorithm-playback__picture">
      {pictureControls}
      <TwistyCube alg={sequence.join(' ')} puzzle={puzzle} setupAlg={setupAlg} setupAnchor="end"
        initialTimestamp="start" onPlayerReady={connectPlayer} tempoScale={speed}
        visualization="3D" hintFacelets="none" experimentalStickering="full"
        cameraLatitude={30} cameraLongitude={30} backView={backView}
        enableExternalOrientationLoop={false} className="recovery-player" />
    </div>
    <ol className="guidance-sequence algorithm-playback__sequence" aria-label="Algorithm moves">
      {sequence.map((move, index) => <li key={index}
        className={index < completed ? 'guidance-sequence__done' : index === completed ? 'guidance-sequence__current' : ''}
        aria-current={index === completed ? 'step' : undefined}>
        <button type="button" disabled={!ready} aria-label={`Go to move ${index + 1}: ${move}`}
          onClick={() => void seek(index)}>{move}</button>
      </li>)}
    </ol>
    <p className="guidance-progress" role="status">{completed} of {sequence.length} moves complete{atEnd ? ' · Algorithm complete' : ` · Next: ${sequence[completed]}`}</p>
    <div className="algorithm-playback__controls" role="group" aria-label="Algorithm playback controls">
      <button className="recovery-button" type="button" disabled={!ready || atStart}
        aria-label="Restart algorithm" title="Restart algorithm" onClick={() => player?.jumpToStart()}>
        <Icon d="M3 10a9 9 0 1 1 2 9M3 4v6h6" size={18} />
      </button>
      <button className="recovery-button" type="button" disabled={!ready || atStart}
        aria-label="Previous move" title="Previous move" onClick={() => step(-1)}>
        <Icon d="M5 4v16M19 5l-10 7 10 7V5Z" size={18} />
      </button>
      <button className="recovery-button recovery-button--primary" type="button" disabled={!ready || !sequence.length}
        aria-label={playing ? 'Pause algorithm' : atEnd ? 'Replay algorithm' : 'Play algorithm'}
        onClick={() => { if (playing) player?.pause(); else player?.play(); }}>
        <Icon d={playing ? 'M9 5v14M15 5v14' : 'M8 5l11 7-11 7V5Z'} size={18} />
        {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
      </button>
      <button className="recovery-button" type="button" disabled={!ready || atEnd}
        aria-label="Next move" title="Next move" onClick={() => step(1)}>
        <Icon d="M19 4v16M5 5l10 7-10 7V5Z" size={18} />
      </button>
      <label className="algorithm-playback__speed">Speed
        <select aria-label="Algorithm playback speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}>
          <option value={0.35}>Slow</option>
          <option value={0.65}>Normal</option>
          <option value={1}>Fast</option>
        </select>
      </label>
    </div>
  </section>;
}
