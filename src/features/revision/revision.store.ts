import { getDb, DbIds } from '@/lib/db';
import type { Flashcard, QuizQuestion } from '@/types/ai';
import type { RevisionGrade } from '@/lib/db';



function makeEntityId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function mapFlashcardRowToType(r: any): Flashcard {
  return {
    id: r.flashcardId,
    videoId: r.videoId,
    front: r.front,
    back: r.back,
    difficulty: r.difficulty,
    nextReviewDate: r.nextReviewDate,
    interval: r.intervalDays,
    repetitions: r.repetitions,
    easeFactor: r.easeFactor,
    createdAt: r.createdAt,
    lastReviewed: r.lastReviewedAt,
  };
}



export async function listDueFlashcards(videoId: string, now = Date.now(), limit = 20): Promise<Flashcard[]> {
  const db = getDb();
  // Dexie: query by due date then filter.
  const rows = await db.flashcards
    .where('videoId')
    .equals(videoId)
    .and(function (this: any) {
      return this.nextReviewDate <= now;
    })
    .sortBy('nextReviewDate');

  return rows
    .slice(0, limit)
    .map((r: any) => mapFlashcardRowToType(r));
}

export async function listFlashcards(videoId: string): Promise<Flashcard[]> {
  const db = getDb();
  const rows = await db.flashcards.where('videoId').equals(videoId).toArray();
  return rows.map((r: any) => mapFlashcardRowToType(r));
}

export async function upsertFlashcards(videoId: string, flashcards: Array<Omit<Flashcard, 'videoId' | 'nextReviewDate' | 'interval' | 'repetitions' | 'easeFactor' | 'createdAt' | 'lastReviewed'>> & { id: string; front: string; back: string; difficulty: Flashcard['difficulty'] }[]): Promise<void> {
  const db = getDb();
  const now = Date.now();

  const rows = flashcards.map((fc) => {
    const id = DbIds.flashcard(videoId, fc.id);
    return {
      id,
      videoId,
      flashcardId: fc.id,
      front: fc.front,
      back: fc.back,
      difficulty: fc.difficulty,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,

      // default scheduling for new cards
      nextReviewDate: now,
      intervalDays: 0,
      repetitions: 0,
      easeFactor: 2.2,

      // required by schema
      source: {},
    };
  });

  await db.flashcards.bulkPut(rows);
}

export async function gradeFlashcard(params: {
  videoId: string;
  flashcardId: string;
  grade: RevisionGrade;
}): Promise<{ updated: Flashcard }> {
  const { videoId, flashcardId, grade } = params;
  const db = getDb();
  const rowId = DbIds.flashcard(videoId, flashcardId);
  const row = await db.flashcards.get(rowId);
  if (!row) {
    throw new Error('Flashcard not found');
  }

  const { sm2Update } = await import('./sm2');
  const updated = sm2Update({
    current: {
      easeFactor: row.easeFactor,
      intervalDays: row.intervalDays,
      repetitions: row.repetitions,
      nextReviewDate: row.nextReviewDate,
      lastReviewedAt: row.lastReviewedAt,
    },
    grade,
  });

  const now = Date.now();

  await db.flashcards.put({
    ...row,
    updatedAt: now,
    nextReviewDate: updated.nextReviewDate,
    intervalDays: updated.intervalDays,
    repetitions: updated.repetitions,
    easeFactor: updated.easeFactor,
    lastReviewedAt: updated.lastReviewedAt,
  });

  const responseId = makeEntityId('resp');
  await db.flashcardResponses.put({
    id: DbIds.flashcardResponse(videoId, responseId),
    videoId,
    responseId,
    flashcardId,
    gradedAt: now,
    grade,
    resulting: {
      nextReviewDate: updated.nextReviewDate,
      intervalDays: updated.intervalDays,
      repetitions: updated.repetitions,
      easeFactor: updated.easeFactor,
    },
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  });

  const updatedCard = mapFlashcardRowToType({
    ...row,
    nextReviewDate: updated.nextReviewDate,
    intervalDays: updated.intervalDays,
    repetitions: updated.repetitions,
    easeFactor: updated.easeFactor,
    lastReviewedAt: updated.lastReviewedAt,
  });

  return { updated: updatedCard };
}

export async function upsertQuiz(params: {
  videoId: string;
  quizId: string;
  mode: 'beginner' | 'interview' | 'revision';
  title: string;
  questions: QuizQuestion[];
}): Promise<void> {
  const { videoId, quizId, mode, title, questions } = params;
  const db = getDb();
  const now = Date.now();

  const row = {
    id: DbIds.quiz(videoId, quizId),
    videoId,
    quizId,
    mode,
    title,
    questions: questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctAnswerIndex: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      timestamp: q.timestamp,
    })),
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  await db.quizzes.put(row as any);
}

export async function markRevisionProgress(params: {
  videoId: string;
  artifactType: 'flashcards' | 'quizzes';
  artifactId: string;
  correct: number;
  total: number;
}): Promise<void> {
  const { videoId, artifactType, artifactId, correct, total } = params;
  const db = getDb();
  const now = Date.now();

  const rowId = DbIds.revisionProgress(videoId, artifactType, artifactId);
  const existing = await db.revisionProgress.get(rowId);

  const next = {
    id: rowId,
    videoId,
    artifactType,
    artifactId,
    updatedAt: now,
    createdAt: existing?.createdAt ?? now,
    schemaVersion: 1,

    totalReviews: (existing?.totalReviews ?? 0) + total,
    correctCount: (existing?.correctCount ?? 0) + correct,
    lastReviewedAt: now,
    streak: existing?.streak ?? 0,
  };

  await db.revisionProgress.put(next as any);
}

