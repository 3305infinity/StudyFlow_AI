import type { ChunkingOptions, SemanticChunk } from '@/types/ai';
import type { EnhancedTranscriptChunk } from '@/types/transcript';

export type ChunkingInput = {
  videoId: string;
  enhancedChunks: EnhancedTranscriptChunk[];
};

type Paragraph = {
  text: string;
  startTime: number;
  endTime: number;
  transcriptChunkIds: string[];
};

function normalizeSpaces(s: string): string {
  return s.replace(/\u00A0/g, ' ').replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function splitIntoParagraphsFromTranscript(enhancedChunks: EnhancedTranscriptChunk[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  let bufText: string[] = [];
  let bufIds: string[] = [];
  let bufStart: number | null = null;
  let bufEnd: number | null = null;

  const flush = () => {
    const text = normalizeSpaces(bufText.join(' '));
    if (!text) {
      bufText = [];
      bufIds = [];
      bufStart = null;
      bufEnd = null;
      return;
    }

    paragraphs.push({
      text,
      startTime: bufStart ?? 0,
      endTime: bufEnd ?? bufStart ?? 0,
      transcriptChunkIds: Array.from(new Set(bufIds)),
    });

    bufText = [];
    bufIds = [];
    bufStart = null;
    bufEnd = null;
  };

  for (const c of enhancedChunks) {
    if (bufStart == null) bufStart = c.start;
    bufEnd = c.end;
    bufIds.push(c.id);

    const parts = c.text.split(/\n\s*\n/g);
    for (let i = 0; i < parts.length; i++) {
      const partRaw = parts[i];
      const part = typeof partRaw === 'string' ? partRaw : '';

      if (part && part.trim()) bufText.push(part.trim());

      // Flush on detected paragraph boundary.
      if (i < parts.length - 1) {
        flush();
        continue;
      }

      // Also flush if this segment ends with a strong sentence boundary.
      if (/[.!?。！？]\s*$/.test(part.trim())) {
        flush();
      }
    }
  }

  flush();
  return paragraphs;
}

function estimateTokenCount(text: string): number {
  // Deterministic lightweight estimate; avoids heavy tokenizer dependency.
  // 1 token ~ 4 chars for English-like text.
  return Math.max(1, Math.ceil(text.length / 4));
}

function stableChunkId(
  videoId: string,
  startTime: number,
  endTime: number,
  index: number,
  text: string
): string {
  const safeText = normalizeSpaces(text).slice(0, 140);
  const s = startTime.toFixed(3);
  const e = endTime.toFixed(3);
  return `${videoId}:semantic:${s}:${e}:${index}:${safeText}`;
}

export type SemanticChunkingResult = {
  chunks: SemanticChunk[];
};

export function chunkTranscriptSemantically({
  videoId,
  enhancedChunks,
}: ChunkingInput,
options: ChunkingOptions
): SemanticChunkingResult {
  const maxChunkSize = Math.max(256, options.maxChunkSize);
  const minChunkSize = Math.max(32, Math.min(options.minChunkSize, maxChunkSize));
  const overlapSize = Math.max(0, Math.min(options.overlapSize, maxChunkSize - minChunkSize));

  const paragraphs = splitIntoParagraphsFromTranscript(enhancedChunks);
  if (!paragraphs.length) return { chunks: [] };

  const chunks: SemanticChunk[] = [];

  let pIndex = 0;
  let chunkIndex = 0;

  while (pIndex < paragraphs.length) {
    const startP = pIndex;

    const first = paragraphs[startP]!;
    let startTime = first.startTime;
    let endTime = first.endTime;

    const transcriptChunkIds: string[] = [];
    const textParts: string[] = [];
    let tokenCount = 0;

    const targetMax = options.respectParagraphs ? maxChunkSize : Math.floor(maxChunkSize * 1.15);

    while (pIndex < paragraphs.length) {
      const p = paragraphs[pIndex]!;
      const pTokens = estimateTokenCount(p.text);

      if (textParts.length > 0 && tokenCount + pTokens > targetMax) break;

      textParts.push(p.text);
      transcriptChunkIds.push(...p.transcriptChunkIds);
      tokenCount += pTokens;
      endTime = p.endTime;

      pIndex++;
    }

    // Ensure min size; if too small and we have more paragraphs, try to include one more.
    if (textParts.length > 0 && tokenCount < minChunkSize && pIndex < paragraphs.length) {
      const p = paragraphs[pIndex]!;
      textParts.push(p.text);
      transcriptChunkIds.push(...p.transcriptChunkIds);
      tokenCount += estimateTokenCount(p.text);
      endTime = p.endTime;
      pIndex++;
    }

    const text = normalizeSpaces(textParts.join(' '));
    const uniqueIds = Array.from(new Set(transcriptChunkIds));

    const semanticChunk: SemanticChunk = {
      id: stableChunkId(videoId, startTime, endTime, chunkIndex, text),
      text,
      startTime,
      endTime,
      embedding: null,
      transcriptChunkIds: uniqueIds,
    };

    chunks.push(semanticChunk);
    chunkIndex++;

    if (overlapSize <= 0) continue;

    // Move pIndex backward deterministically to create overlap.
    const endPExclusive = pIndex; // first paragraph after the chunk
    let backP = endPExclusive - 1;
    let backTokens = 0;

    while (backP >= startP && backTokens < overlapSize) {
      const backParagraph = paragraphs[backP];
      if (!backParagraph) break;
      backTokens += estimateTokenCount(backParagraph.text);
      backP--;
    }

    const nextStart = Math.max(0, backP + 1);
    // Avoid infinite loops if overlap can't move start.
    if (nextStart === startP) {
      continue;
    }

    pIndex = nextStart;
  }

  return { chunks };
}

