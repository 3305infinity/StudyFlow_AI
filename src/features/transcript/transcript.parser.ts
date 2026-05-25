import type { EnhancedTranscriptChunk, TranscriptChunk } from '@/types/transcript';

type RawTranscriptCue = {
  start?: number;
  duration?: number;
  text?: string;
};

function normalizeText(input: string): string {
  return input
    .replace(/\u00A0/g, ' ')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function makeStableChunkId(videoId: string, start: number, index: number, text: string): string {
  // Deterministic id so future derived chunking/embeddings are stable.
  // Text is included (normalized) to make ids robust to small timing variations.
  const safeText = normalizeText(text).slice(0, 120);
  return `${videoId}:${start.toFixed(3)}:${index}:${safeText}`;
}

function dedupeByKey(chunks: TranscriptChunk[], keyFn: (c: TranscriptChunk) => string): TranscriptChunk[] {
  const seen = new Set<string>();
  const out: TranscriptChunk[] = [];
  for (const c of chunks) {
    const key = keyFn(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function ensureValidNumbers(n: unknown): number | null {
  if (typeof n !== 'number') return null;
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseYouTubeTranscript(
  videoId: string,
  raw: Array<RawTranscriptCue> | undefined | null
): {
  chunks: TranscriptChunk[];
  enhancedChunks: EnhancedTranscriptChunk[];
  totalDuration: number;
} {
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return { chunks: [], enhancedChunks: [], totalDuration: 0 };
  }

  // 1) Normalize + filter invalid cues
  const normalized: TranscriptChunk[] = [];
  for (const cue of raw) {
    const start = ensureValidNumbers(cue.start);
    const duration = ensureValidNumbers(cue.duration);
    const text = typeof cue.text === 'string' ? normalizeText(cue.text) : '';

    if (start === null || duration === null) continue;
    if (duration <= 0) continue;
    if (!text) continue;

    normalized.push({ text, start, duration });
  }

  if (normalized.length === 0) {
    return { chunks: [], enhancedChunks: [], totalDuration: 0 };
  }

  // 2) Sort by start time
  normalized.sort((a, b) => a.start - b.start || a.duration - b.duration);

  // 3) Deduplicate defensively.
  // YouTube can occasionally produce near-duplicate cues during dynamic parsing.
  // Use rounded start + normalized text for stability.
  const deduped = dedupeByKey(normalized, c => {
    const startKey = Math.round(c.start * 100) / 100; // 10ms precision
    const textKey = normalizeText(c.text);
    return `${startKey}:${textKey}`;
  });

  // 4) Whitespace cleanup already done in normalizeText().
  // Additional join-safe behavior: if two consecutive cues have identical text,
  // keep only the first (already handled by dedupe, but be extra safe).
  const compact: TranscriptChunk[] = [];
  for (const c of deduped) {
    const prev = compact.length ? compact[compact.length - 1] : undefined;
    if (prev && prev.text === c.text && Math.abs(prev.start - c.start) < 0.05) {
      continue;
    }
    compact.push(c);
  }




  // 5) Enhance with ids/end/index
  const enhancedChunks: EnhancedTranscriptChunk[] = compact.map((c, index) => {
    const end = c.start + c.duration;
    return {
      ...c,
      end,
      index,
      id: makeStableChunkId(videoId, c.start, index, c.text),
    };
  });

  // totalDuration from last cue end
  const totalDuration = enhancedChunks.length
    ? Math.max(...enhancedChunks.map(c => c.end))
    : 0;

  return { chunks: compact, enhancedChunks, totalDuration };
}

export function findActiveChunkIndex(chunks: EnhancedTranscriptChunk[], time: number): number {
  if (!chunks.length) return -1;
  if (!Number.isFinite(time) || time < 0) return -1;

  // Chunks are sorted by start; use binary search over end/start ranges.
  let lo = 0;
  let hi = chunks.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const c = chunks[mid];
    if (!c) {
      break;
    }

    if (time < c.start) {

      hi = mid - 1;
      continue;
    }

    if (time >= c.end) {
      lo = mid + 1;
      continue;
    }

    return mid;
  }

  // If exact range not found, fallback to nearest before.
  const idx = Math.max(0, Math.min(chunks.length - 1, lo - 1));
  const nearest = chunks[idx];
  if (!nearest) return -1;
  if (time >= nearest.start && time < nearest.end) return idx;
  return -1;
}

