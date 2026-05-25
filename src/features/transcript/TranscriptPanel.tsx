import { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, Loader2, SquareArrowRight, SkipBack, SkipForward } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

import type { EnhancedTranscriptChunk } from '@/types/transcript';
import { useTranscriptStore } from './transcript.store';

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function safeScrollParent(container: HTMLElement | null, child: HTMLElement): void {
  // Ensure scrolling happens inside the transcript container, not the whole page.
  if (!container) return;
  const cTop = container.getBoundingClientRect().top;
  const cBottom = container.getBoundingClientRect().bottom;
  const r = child.getBoundingClientRect();
  if (r.top < cTop + 64) child.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else if (r.bottom > cBottom - 64) child.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function TranscriptChunkRow({
  chunk,
  isActive,
  onJump,
}: {
  chunk: EnhancedTranscriptChunk;
  isActive: boolean;
  onJump: (start: number) => void;
}) {
  return (
    <motion.div
      layout
      initial={false}
      className={twMerge(
        clsx(
          'group relative rounded-2xl px-3 py-2',
          'transition-colors duration-200',
          isActive
            ? 'bg-white/7 border border-white/15'
            : 'bg-white/0 border border-transparent hover:bg-white/5'
        )
      )}
      id={`yt-studyflow-transcript-chunk-${chunk.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onJump(chunk.start)}
            className={twMerge(
              clsx(
                'rounded-lg px-2 py-1 text-[11px] font-medium',
                isActive
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'bg-white/5 text-white/70 hover:text-white'
              )
            )}
            title="Jump to timestamp"
          >
            {formatTimestamp(chunk.start)}
          </button>
        </div>

        <div className="min-w-0">
          <div
            className={twMerge(
              clsx(
                'text-sm leading-6',
                isActive ? 'text-white' : 'text-white/85 group-hover:text-white'
              )
            )}
          >
            {chunk.text}
          </div>

          {isActive && (
            <motion.div
              layoutId="yt-studyflow-active-indicator"
              className="pointer-events-none absolute -inset-px rounded-2xl ring-1 ring-white/20"
              initial={false}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function TranscriptPanel({ onJumpToTime }: { onJumpToTime: (seconds: number) => void }) {
  const {
    enhancedChunks,
    filteredChunks,
    loading,
    status,
    error,
    availability,
    activeChunkIndex,
    searchQuery,
    setSearchQuery,
    scrollToActiveChunk,
  } = useTranscriptStore((s) => ({

    enhancedChunks: s.enhancedChunks,
    filteredChunks: s.filteredChunks,
    loading: s.loading,
    status: s.status,
    error: s.error,
    availability: s.availability,
    activeChunkIndex: s.activeChunkIndex,
    searchQuery: s.searchQuery,
    setSearchQuery: s.setSearchQuery,
    scrollToActiveChunk: s.scrollToActiveChunk,
    setActiveTime: s.setActiveTime,
  }));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeChunk = activeChunkIndex >= 0 ? enhancedChunks[activeChunkIndex] : null;

  useEffect(() => {
    // Smooth auto-scroll only when user is already near the active chunk or when there is no search filter.
    // Prevents scroll fight during manual browsing.
    if (!activeChunk) return;
    if (searchQuery.trim()) return; // don't auto-scroll while searching

    const id = `yt-studyflow-transcript-chunk-${activeChunk.id}`;
    const el = document.getElementById(id);
    if (!el) return;
    safeScrollParent(containerRef.current, el);
  }, [activeChunk?.id]);

  const canRender = status !== 'loading';

  const jumpPrev = () => {
    if (activeChunkIndex <= 0) return;
    onJumpToTime(enhancedChunks[activeChunkIndex - 1]?.start ?? 0);
  };
  const jumpNext = () => {
    if (activeChunkIndex < 0 || activeChunkIndex >= enhancedChunks.length - 1) return;
    onJumpToTime(enhancedChunks[activeChunkIndex + 1]?.start ?? 0);
  };

  const headerStats = useMemo(() => {
    const total = enhancedChunks.length;
    const showing = filteredChunks.length;
    if (!total) return 'No transcript';
    if (showing === total && !searchQuery.trim()) return `${total} segments`;
    return `${showing} of ${total} segments`;
  }, [enhancedChunks.length, filteredChunks.length, searchQuery]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <motion.div
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1220]/70 backdrop-blur"
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-white/80" />
                <div className="text-sm font-semibold text-white">Transcript</div>
              </div>
              <div className="mt-0.5 text-xs text-white/60">{headerStats}</div>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={jumpPrev}
                disabled={activeChunkIndex <= 0}
                className={twMerge(
                  clsx(
                    'rounded-xl px-2.5 py-2 text-white/80 border border-white/10',
                    'hover:bg-white/5 transition-colors disabled:opacity-40 disabled:hover:bg-transparent'
                  )
                )}
                title="Previous segment"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={jumpNext}
                disabled={activeChunkIndex < 0 || activeChunkIndex >= enhancedChunks.length - 1}
                className={twMerge(
                  clsx(
                    'rounded-xl px-2.5 py-2 text-white/80 border border-white/10',
                    'hover:bg-white/5 transition-colors disabled:opacity-40 disabled:hover:bg-transparent'
                  )
                )}
                title="Next segment"
              >
                <SkipForward className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollToActiveChunk()}
                disabled={!activeChunk}
                className={twMerge(
                  clsx(
                    'rounded-xl px-2.5 py-2 text-white/80 border border-white/10',
                    'hover:bg-white/5 transition-colors disabled:opacity-40 disabled:hover:bg-transparent'
                  )
                )}
                title="Center active segment"
              >
                <SquareArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transcript…"
                className={twMerge(
                  clsx(
                    'w-full rounded-2xl bg-white/5 border border-white/10',
                    'px-10 py-2 text-sm text-white placeholder:text-white/40',
                    'focus:outline-none focus:ring-2 focus:ring-white/15'
                  )
                )}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <div ref={containerRef} className="flex-1 overflow-auto px-4 py-4">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-20 h-6 rounded-xl bg-white/10 animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 rounded bg-white/10 animate-pulse" />
                      <div className="mt-2 h-4 w-4/5 rounded bg-white/10 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {!loading && availability === 'no-transcript' && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-2 text-white/90">
                  <Loader2 className="h-5 w-5 text-white/70" />
                  <div className="text-sm font-semibold">Transcript not available</div>
                </div>
                <div className="mt-2 text-sm text-white/60 leading-6">
                  This video doesn’t expose captions/transcripts, so StudyFlow can’t build a searchable timeline.
                </div>
              </div>
            </motion.div>
          )}

          {!loading && status === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-5">
                <div className="text-sm font-semibold text-red-200">Transcript error</div>
                <div className="mt-2 text-sm text-red-100/80 leading-6">{error?.message || 'Unknown error'}</div>
              </div>
            </motion.div>
          )}

          {!loading && canRender && enhancedChunks.length > 0 && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="space-y-2">
                {filteredChunks.map((chunk) => {
                  const isActive = enhancedChunks[activeChunkIndex]?.id === chunk.id;
                  return (
                    <TranscriptChunkRow
                      key={chunk.id}
                      chunk={chunk}
                      isActive={isActive}
                      onJump={(t) => onJumpToTime(t)}
                    />
                  );
                })}

                {filteredChunks.length === 0 && (
                  <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm font-semibold text-white/90">No matches</div>
                    <div className="mt-2 text-sm text-white/60 leading-6">
                      Try a different keyword. Search is substring-based in Phase 1.
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
          {searchQuery.trim()
            ? 'Tip: click any timestamp to jump.'
            : 'Tip: press Prev/Next to move between transcript segments.'}
        </div>
      </div>
    </div>
  );
}

