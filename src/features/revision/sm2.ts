export type SM2State = {
  easeFactor: number; // EF
  intervalDays: number;
  repetitions: number;
  nextReviewDate: number; // epoch ms
  lastReviewedAt?: number;
};

export type SM2Input = {
  current: SM2State;
  grade: 'again' | 'hard' | 'good' | 'easy';
  now?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * SM-2 inspired scheduling.
 * Mapping:
 * - again => quality 0
 * - hard => quality 3
 * - good => quality 4
 * - easy => quality 5
 */
export function sm2Update(params: SM2Input): SM2State {
  const { current, grade } = params;
  const now = params.now ?? Date.now();

  const quality = grade === 'again' ? 0 : grade === 'hard' ? 3 : grade === 'good' ? 4 : 5;

  let easeFactor = current.easeFactor;
  let repetitions = current.repetitions;
  let intervalDays = current.intervalDays;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
  }

  // Update ease factor
  const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  easeFactor = easeFactor + efDelta;
  easeFactor = clamp(easeFactor, 1.3, 2.8);

  const nextReviewDate = now + intervalDays * 24 * 60 * 60 * 1000;

  return {
    easeFactor,
    intervalDays,
    repetitions,
    nextReviewDate,
    lastReviewedAt: now,
  };
}

