import { useEffect, useState } from 'react';

import type { Flashcard } from '@/types/ai';
import { listDueFlashcards, gradeFlashcard } from './revision.store';

type Props = {
  videoId: string | null;
};

type GradeKey = 'again' | 'hard' | 'good' | 'easy';

const gradeLabels: Record<GradeKey, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

function Spinner() {
  return <div className="text-sm text-white/60">Loading…</div>;
}

export default function RevisionPanel({ videoId }: Props) {
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!videoId) {
        setCards([]);
        setIndex(0);
        setRevealed(false);
        return;
      }
      setLoading(true);
      setGrading(false);
      setRevealed(false);
      try {
        const due = await listDueFlashcards(videoId);
        if (cancelled) return;
        setCards(due);
        setIndex(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const current = cards[index];
  const progressPct = cards.length ? Math.round(((index + (revealed ? 1 : 0)) / cards.length) * 100) : 0;

  const empty = !loading && (!videoId || cards.length === 0);

  const onGrade = async (grade: GradeKey) => {
    if (!videoId || !current) return;
    setGrading(true);
    try {
      await gradeFlashcard({ videoId, flashcardId: current.id, grade: grade as any });
      setRevealed(false);
      setIndex((i) => i + 1);
    } finally {
      setGrading(false);
    }
  };

  const canReveal = !!current && !revealed;
  const canGrade = !!current && revealed && !grading;

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-70">Revision</div>
            <div className="text-sm text-white/80">{videoId ? 'Spaced repetition review' : 'Select a video'}</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-70">Progress</div>
            <div className="text-sm font-semibold">{progressPct}%</div>
          </div>
        </div>
        <div className="mt-2 h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <Spinner />
        ) : empty ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            {videoId ? 'No due flashcards right now.' : 'Select a video to start revision.'}
          </div>
        ) : !current ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Done for now.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs opacity-70">
              Card {index + 1} / {cards.length}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="p-4">
                {!revealed ? (
                  <div className="text-sm leading-relaxed text-white/90">
                    <div className="text-xs uppercase tracking-wider opacity-70 mb-2">Front</div>
                    {current.front}
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed text-white/90">
                    <div className="text-xs uppercase tracking-wider opacity-70 mb-2">Back</div>
                    {current.back}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-white/10 flex gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/90 text-sm transition disabled:opacity-50"
                  disabled={!canReveal || grading}
                  onClick={() => setRevealed(true)}
                >
                  Reveal
                </button>

                <div className="flex-1" />

                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm transition disabled:opacity-50"
                  disabled={!canGrade}
                  onClick={() => onGrade('again')}
                >
                  {gradeLabels.again}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-sm transition disabled:opacity-50"
                  disabled={!canGrade}
                  onClick={() => onGrade('hard')}
                >
                  {gradeLabels.hard}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-sm transition disabled:opacity-50"
                  disabled={!canGrade}
                  onClick={() => onGrade('good')}
                >
                  {gradeLabels.good}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-sm transition disabled:opacity-50"
                  disabled={!canGrade}
                  onClick={() => onGrade('easy')}
                >
                  {gradeLabels.easy}
                </button>
              </div>
            </div>

            <div className="text-xs opacity-60">
              Keyboard: use buttons (Phase 3 foundation). SM-2 fields updated after grading.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

