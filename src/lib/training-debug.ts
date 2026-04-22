import { bestTimeString, type CaseCardData } from './case-cards';
import type { CaseReviewEntry, CaseSrsState } from './srs';

const TRAINING_DEBUG_ENABLED = import.meta.env.DEV && import.meta.env.MODE !== 'test';
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

interface SmartQueueLogInput {
  reason: string;
  queue: CaseCardData[];
  now?: number;
}

interface SmartQueueRetryLogInput {
  caseData: CaseCardData;
  retryCount: number;
  maxRepeats: number;
  gap: number;
  queue: CaseCardData[];
}

interface SmartQueueRetrySkipLogInput {
  caseData: CaseCardData | null;
  reason: string;
  retryCount?: number;
  maxRepeats?: number;
}

interface ReviewLogInput {
  caseData: CaseCardData | null;
  review: CaseReviewEntry;
  previousSrsState: CaseSrsState | null;
  nextSrsState: CaseSrsState;
  wasPersonalBest: boolean;
}

interface SchedulerTableRow {
  field: string;
  before: string;
  after: string;
  change: string;
}

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatSignedNumber(value: number, digits = 2) {
  if (!Number.isFinite(value) || value === 0) {
    return '0';
  }
  const rounded = value.toFixed(digits).replace(/\.?0+$/, '');
  return `${value > 0 ? '+' : ''}${rounded}`;
}

function formatRelativeDuration(milliseconds: number) {
  const absolute = Math.abs(milliseconds);
  if (absolute < 45 * SECOND_MS) {
    return formatCount(Math.max(1, Math.round(absolute / SECOND_MS)), 'second');
  }
  if (absolute < 45 * MINUTE_MS) {
    return formatCount(Math.max(1, Math.round(absolute / MINUTE_MS)), 'minute');
  }
  if (absolute < 36 * HOUR_MS) {
    return formatCount(Math.max(1, Math.round(absolute / HOUR_MS)), 'hour');
  }
  return formatCount(Math.max(1, Math.round(absolute / DAY_MS)), 'day');
}

export function formatDueText(dueAt: number | null, now = Date.now()) {
  if (dueAt == null) {
    return 'No due date yet';
  }

  const difference = dueAt - now;
  if (Math.abs(difference) < SECOND_MS) {
    return 'Due now';
  }

  return difference < 0
    ? `Overdue by ${formatRelativeDuration(difference)}`
    : `Due in ${formatRelativeDuration(difference)}`;
}

function describeSmartQueuePlacement(caseData: CaseCardData, hasAnyDueCases: boolean) {
  if (!hasAnyDueCases) {
    return 'Nothing is due right now, so the soonest upcoming review goes first.';
  }

  if (caseData.reviewCount > 0 && caseData.smartReviewDue) {
    return 'Due and already practiced, so it moves to the front.';
  }

  if (caseData.reviewCount === 0 && caseData.smartReviewDue) {
    return 'Due but still new, so it comes after the seen due cases.';
  }

  if (caseData.reviewCount > 0) {
    return 'Not due yet, so it waits behind the due cases.';
  }

  return 'Brand new and not due yet, so it stays at the back for now.';
}

export function buildSmartQueueTableRows(queue: CaseCardData[], now = Date.now()) {
  const hasAnyDueCases = queue.some((caseData) => caseData.smartReviewDue);
  return queue.map((caseData, index) => ({
    position: index + 1,
    case: caseData.name,
    best: bestTimeString(caseData.bestTime),
    due: formatDueText(caseData.smartReviewDueAt, now),
    why: describeSmartQueuePlacement(caseData, hasAnyDueCases),
  }));
}

function describeGrade(grade: CaseReviewEntry['grade']) {
  switch (grade) {
    case 'again':
      return {
        label: 'Again',
        summary: 'This one needs a full revisit, so it will come back soon.',
      };
    case 'hard':
      return {
        label: 'Hard',
        summary: 'It counted as solved, but it looked shaky, so the spacing stays short.',
      };
    case 'easy':
      return {
        label: 'Easy',
        summary: 'That looked comfortable, so the next review is pushed further out.',
      };
    case 'good':
    default:
      return {
        label: 'Good',
        summary: 'Solid solve, so the next review moves out at a normal pace.',
      };
  }
}

function formatStability(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  return `${value.toFixed(value >= 10 ? 1 : 2).replace(/\.?0+$/, '')} days`;
}

function formatDifficulty(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(2).replace(/\.?0+$/, '');
}

function formatInteger(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  return Math.round(value).toString(10);
}

export function buildSchedulerTableRows(
  previousSrsState: CaseSrsState | null,
  nextSrsState: CaseSrsState,
  reviewedAt: number,
): SchedulerTableRow[] {
  const previousDue = previousSrsState?.dueAt ?? null;
  const nextDue = nextSrsState.dueAt ?? null;
  const previousStability = previousSrsState?.stabilityDays ?? null;
  const nextStability = nextSrsState.stabilityDays;
  const previousDifficulty = previousSrsState?.difficulty ?? null;
  const nextDifficulty = nextSrsState.difficulty;
  const previousReps = previousSrsState?.reps ?? null;
  const nextReps = nextSrsState.reps;
  const previousLapses = previousSrsState?.lapses ?? null;
  const nextLapses = nextSrsState.lapses;

  return [
    {
      field: 'Next review',
      before: formatDueText(previousDue, reviewedAt),
      after: formatDueText(nextDue, reviewedAt),
      change: previousDue == null || nextDue == null
        ? '-'
        : `${formatSignedNumber((nextDue - previousDue) / DAY_MS)} days`,
    },
    {
      field: 'Stability',
      before: formatStability(previousStability),
      after: formatStability(nextStability),
      change: previousStability == null ? '-' : `${formatSignedNumber(nextStability - previousStability)} days`,
    },
    {
      field: 'Difficulty',
      before: formatDifficulty(previousDifficulty),
      after: formatDifficulty(nextDifficulty),
      change: previousDifficulty == null ? '-' : formatSignedNumber(nextDifficulty - previousDifficulty),
    },
    {
      field: 'Reps',
      before: formatInteger(previousReps),
      after: formatInteger(nextReps),
      change: previousReps == null ? '-' : formatSignedNumber(nextReps - previousReps, 0),
    },
    {
      field: 'Lapses',
      before: formatInteger(previousLapses),
      after: formatInteger(nextLapses),
      change: previousLapses == null ? '-' : formatSignedNumber(nextLapses - previousLapses, 0),
    },
  ];
}

export function logSmartQueueRebuild({ reason, queue, now = Date.now() }: SmartQueueLogInput) {
  if (!TRAINING_DEBUG_ENABLED) {
    return;
  }

  const dueNowCount = queue.filter((caseData) => caseData.smartReviewDue).length;
  const brandNewCount = queue.filter((caseData) => caseData.reviewCount === 0).length;

  console.groupCollapsed(`[smart queue] Rebuilt: ${reason}`);
  if (queue.length === 0) {
    console.log('The smart queue is empty right now.');
    console.groupEnd();
    return;
  }

  console.log(
    `${queue.length} cases in line. ${dueNowCount} due now, ${brandNewCount} brand new.`,
  );
  console.table(buildSmartQueueTableRows(queue, now));
  console.groupEnd();
}

export function logSmartQueueRetry({
  caseData,
  retryCount,
  maxRepeats,
  gap,
  queue,
}: SmartQueueRetryLogInput) {
  if (!TRAINING_DEBUG_ENABLED) {
    return;
  }

  console.groupCollapsed(`[smart queue] Retry inserted: ${caseData.name}`);
  console.log(
    `${caseData.name} will come back after about ${formatCount(gap, 'case')} because it was missed or shaky.`,
  );
  console.log(`Repeat ${retryCount} of ${maxRepeats} for this pass.`);
  console.table(buildSmartQueueTableRows(queue));
  console.groupEnd();
}

export function logSmartQueueRetrySkipped({
  caseData,
  reason,
  retryCount,
  maxRepeats,
}: SmartQueueRetrySkipLogInput) {
  if (!TRAINING_DEBUG_ENABLED) {
    return;
  }

  const caseName = caseData?.name ?? 'Unknown case';
  const repeatText = retryCount != null && maxRepeats != null
    ? ` (${retryCount}/${maxRepeats} retries already used this pass)`
    : '';
  console.log(`[smart queue] Retry skipped for ${caseName}: ${reason}${repeatText}`);
}

export function logReviewRecorded({
  caseData,
  review,
  previousSrsState,
  nextSrsState,
  wasPersonalBest,
}: ReviewLogInput) {
  if (!TRAINING_DEBUG_ENABLED) {
    return;
  }

  const grade = describeGrade(review.grade);
  const caseName = caseData?.name ?? 'Unknown case';
  const metrics = [
    review.executionMs != null ? `solve ${bestTimeString(review.executionMs)}` : null,
    review.recognitionMs != null ? `recognition ${bestTimeString(review.recognitionMs)}` : null,
    review.totalMs != null ? `total ${bestTimeString(review.totalMs)}` : null,
    review.hadMistake ? 'mistake seen' : null,
    review.aborted ? 'aborted' : null,
    wasPersonalBest && !review.aborted ? 'new personal best' : null,
  ].filter((entry): entry is string => entry != null);

  console.groupCollapsed(`[smart review] ${caseName}: ${grade.label}`);
  console.log(grade.summary);
  console.log(`Mode: ${review.mode}. ${metrics.length > 0 ? metrics.join(' | ') : 'No timing details recorded.'}`);
  console.table(buildSchedulerTableRows(previousSrsState, nextSrsState, review.reviewedAt));
  console.groupEnd();
}
