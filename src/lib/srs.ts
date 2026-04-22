import { normalizeNullableNumber } from './normalize';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export type ReviewMode = 'timer' | 'smartcube' | 'time-attack';

export interface CaseReviewEntry {
  reviewedAt: number;
  grade: ReviewGrade;
  mode: ReviewMode;
  executionMs: number | null;
  recognitionMs: number | null;
  totalMs: number | null;
  hadMistake: boolean;
  aborted: boolean;
  timerOnly: boolean;
}

export interface CaseSrsState {
  dueAt: number | null;
  stabilityDays: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReviewedAt: number | null;
  lastGrade: ReviewGrade | null;
}

export interface ReviewGradeInput {
  history: CaseReviewEntry[];
  reviewedAt: number;
  mode: ReviewMode;
  executionMs: number | null;
  recognitionMs: number | null;
  totalMs: number | null;
  hadMistake: boolean;
  aborted: boolean;
  timerOnly: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTO_LEARNING_MIN_REVIEWS = 5;
const AUTO_LEARNING_WINDOW = 12;
const AUTO_LEARNING_MIN_SUCCESSES = 11;

const DEFAULT_DIFFICULTY = 5;
const REVIEW_BASELINE_SAMPLE_SIZE = 8;
const MUCH_SLOWER_THRESHOLD = 1.35;
const UPWARD_GROWTH_THROTTLE_MS = 2 * 60 * 1000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function meanRevertDifficulty(value: number) {
  return clamp(DEFAULT_DIFFICULTY + 0.8 * (value - DEFAULT_DIFFICULTY), 1, 10);
}

export function normalizeReviewEntry(entry: Partial<CaseReviewEntry> | null | undefined): CaseReviewEntry | null {
  const reviewedAt = Number(entry?.reviewedAt);
  if (!Number.isFinite(reviewedAt)) {
    return null;
  }

  const grade = entry?.grade;
  if (grade !== 'again' && grade !== 'hard' && grade !== 'good' && grade !== 'easy') {
    return null;
  }

  const mode = entry?.mode === 'smartcube' || entry?.mode === 'time-attack' ? entry.mode : 'timer';

  return {
    reviewedAt,
    grade,
    mode,
    executionMs: normalizeNullableNumber(entry?.executionMs),
    recognitionMs: normalizeNullableNumber(entry?.recognitionMs),
    totalMs: normalizeNullableNumber(entry?.totalMs),
    hadMistake: entry?.hadMistake === true,
    aborted: entry?.aborted === true,
    timerOnly: entry?.timerOnly === true,
  };
}

export function normalizeReviewHistory(entries: unknown): CaseReviewEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => normalizeReviewEntry(entry as Partial<CaseReviewEntry>))
    .filter((entry): entry is CaseReviewEntry => entry != null)
    .sort((left, right) => left.reviewedAt - right.reviewedAt);
}

export function normalizeSrsState(state: Partial<CaseSrsState> | null | undefined): CaseSrsState | null {
  if (!state) {
    return null;
  }

  const stabilityDays = Number(state.stabilityDays);
  const difficulty = Number(state.difficulty);
  const reps = Number(state.reps);
  const lapses = Number(state.lapses);
  const dueAtRaw = state.dueAt;
  const lastReviewedAtRaw = state.lastReviewedAt;

  const dueAt = dueAtRaw == null ? null : Number(dueAtRaw);
  const lastReviewedAt = lastReviewedAtRaw == null ? null : Number(lastReviewedAtRaw);
  const lastGrade = state.lastGrade;

  if (!Number.isFinite(stabilityDays) || !Number.isFinite(difficulty) || !Number.isFinite(reps) || !Number.isFinite(lapses)) {
    return null;
  }

  return {
    dueAt: dueAt != null && Number.isFinite(dueAt) ? dueAt : null,
    stabilityDays: clamp(stabilityDays, 0.25, 36500),
    difficulty: clamp(difficulty, 1, 10),
    reps: Math.max(0, Math.round(reps)),
    lapses: Math.max(0, Math.round(lapses)),
    lastReviewedAt: lastReviewedAt != null && Number.isFinite(lastReviewedAt) ? lastReviewedAt : null,
    lastGrade: lastGrade === 'again' || lastGrade === 'hard' || lastGrade === 'good' || lastGrade === 'easy'
      ? lastGrade
      : null,
  };
}

export function isSuccessfulReview(entry: Pick<CaseReviewEntry, 'grade'>) {
  return entry.grade !== 'again';
}

export function getRecentReviews(history: CaseReviewEntry[], count: number) {
  return history.slice(-count);
}

export function deriveAutoLearnedStatus(history: CaseReviewEntry[]): number {
  if (history.length < AUTO_LEARNING_MIN_REVIEWS) {
    return 0;
  }

  const recent = getRecentReviews(history, AUTO_LEARNING_WINDOW);
  const successCount = recent.filter(isSuccessfulReview).length;
  if (recent.length >= AUTO_LEARNING_WINDOW && successCount >= AUTO_LEARNING_MIN_SUCCESSES) {
    return 2;
  }

  return 1;
}

function getMedianMetric(history: CaseReviewEntry[], key: 'executionMs' | 'recognitionMs') {
  const values = history
    .filter(isSuccessfulReview)
    .map((entry) => entry[key])
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0)
    .slice(-REVIEW_BASELINE_SAMPLE_SIZE)
    .sort((left, right) => left - right);

  if (values.length < 3) {
    return null;
  }

  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) {
    return values[middle];
  }

  return (values[middle - 1] + values[middle]) / 2;
}

function isMuchSlower(currentValue: number | null, baselineValue: number | null) {
  return currentValue != null
    && baselineValue != null
    && currentValue > baselineValue * MUCH_SLOWER_THRESHOLD;
}

export function deriveReviewGrade(input: ReviewGradeInput): ReviewGrade {
  if (input.aborted) {
    return 'again';
  }

  const executionBaseline = getMedianMetric(input.history, 'executionMs');
  const recognitionBaseline = getMedianMetric(input.history, 'recognitionMs');
  const muchSlowerExecution = isMuchSlower(input.executionMs, executionBaseline);
  const muchSlowerRecognition = isMuchSlower(input.recognitionMs, recognitionBaseline);

  if (input.hadMistake || muchSlowerExecution || muchSlowerRecognition) {
    return 'hard';
  }

  const previousSuccessfulWindow = getRecentReviews(input.history, AUTO_LEARNING_WINDOW - 1);
  const canBeEasy = previousSuccessfulWindow.length === AUTO_LEARNING_WINDOW - 1
    && previousSuccessfulWindow.every(isSuccessfulReview)
    && (executionBaseline == null || (input.executionMs != null && input.executionMs <= executionBaseline))
    && (recognitionBaseline == null || (input.recognitionMs != null && input.recognitionMs <= recognitionBaseline));

  if (canBeEasy) {
    return 'easy';
  }

  return 'good';
}

export function createReviewEntry(input: ReviewGradeInput): CaseReviewEntry {
  return {
    reviewedAt: input.reviewedAt,
    grade: deriveReviewGrade(input),
    mode: input.mode,
    executionMs: normalizeNullableNumber(input.executionMs),
    recognitionMs: normalizeNullableNumber(input.recognitionMs),
    totalMs: normalizeNullableNumber(input.totalMs),
    hadMistake: input.hadMistake,
    aborted: input.aborted,
    timerOnly: input.timerOnly,
  };
}

export function computeRetrievability(state: CaseSrsState, reviewedAt: number) {
  if (state.lastReviewedAt == null || reviewedAt <= state.lastReviewedAt) {
    return 1;
  }

  const elapsedDays = Math.max(0, (reviewedAt - state.lastReviewedAt) / DAY_MS);
  return Math.pow(1 + elapsedDays / Math.max(0.01, 9 * state.stabilityDays), -1);
}

function getDueAt(reviewedAt: number, stabilityDays: number) {
  return reviewedAt + Math.round(stabilityDays * DAY_MS);
}

function shouldThrottleUpwardGrowth(state: CaseSrsState, reviewedAt: number) {
  return state.lastReviewedAt != null
    && reviewedAt - state.lastReviewedAt < UPWARD_GROWTH_THROTTLE_MS;
}

function createInitialSrsState(reviewedAt: number, grade: ReviewGrade): CaseSrsState {
  const stabilityDays = grade === 'again'
    ? 0.25
    : grade === 'hard'
      ? 1
      : grade === 'easy'
        ? 4
        : 2;
  const difficulty = grade === 'again'
    ? 6.5
    : grade === 'hard'
      ? 5.8
      : grade === 'easy'
        ? 4.2
        : 5;

  return {
    dueAt: getDueAt(reviewedAt, stabilityDays),
    stabilityDays,
    difficulty,
    reps: 1,
    lapses: grade === 'again' ? 1 : 0,
    lastReviewedAt: reviewedAt,
    lastGrade: grade,
  };
}

export function updateSrsState(currentState: CaseSrsState | null, review: CaseReviewEntry): CaseSrsState {
  const current = normalizeSrsState(currentState);
  if (!current || current.lastReviewedAt == null) {
    return createInitialSrsState(review.reviewedAt, review.grade);
  }

  const retrievability = computeRetrievability(current, review.reviewedAt);
  let difficulty = current.difficulty;
  let stabilityDays = current.stabilityDays;
  let lapses = current.lapses;

  if (review.grade === 'again') {
    difficulty = meanRevertDifficulty(current.difficulty + 1.2);
    stabilityDays = Math.max(0.25, current.stabilityDays * (0.35 + 0.25 * (1 - retrievability)));
    lapses += 1;
  } else {
    const difficultyEffect = 1 + (10 - difficulty) * 0.04;
    const retrievabilityEffect = 1 + (1 - retrievability) * 2.2;
    const gradeFactor = review.grade === 'hard'
      ? 1.18
      : review.grade === 'easy'
        ? 2.8
        : 1.9;
    stabilityDays = Math.max(
      current.stabilityDays,
      current.stabilityDays * Math.max(1.05, gradeFactor * difficultyEffect * retrievabilityEffect),
    );
    difficulty = meanRevertDifficulty(
      current.difficulty
        + (review.grade === 'hard' ? 0.35 : review.grade === 'easy' ? -0.4 : -0.1),
    );
  }

  let dueAt = getDueAt(review.reviewedAt, stabilityDays);
  if (
    review.grade !== 'again'
    && stabilityDays > current.stabilityDays
    && shouldThrottleUpwardGrowth(current, review.reviewedAt)
  ) {
    stabilityDays = current.stabilityDays;
    dueAt = current.dueAt ?? getDueAt(review.reviewedAt, stabilityDays);
  }

  return {
    dueAt,
    stabilityDays: clamp(stabilityDays, 0.25, 36500),
    difficulty: clamp(difficulty, 1, 10),
    reps: current.reps + 1,
    lapses,
    lastReviewedAt: review.reviewedAt,
    lastGrade: review.grade,
  };
}

export function isCaseDue(state: CaseSrsState | null | undefined, now = Date.now()) {
  if (!state || state.dueAt == null) {
    return true;
  }

  return state.dueAt <= now;
}

export function getCaseUrgency(state: CaseSrsState | null | undefined, now = Date.now()) {
  if (!state || state.dueAt == null) {
    return Number.NEGATIVE_INFINITY;
  }

  return state.dueAt <= now ? state.dueAt - now : state.dueAt;
}
