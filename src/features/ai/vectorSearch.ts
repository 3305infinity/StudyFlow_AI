import type { EmbeddingVector, SemanticChunk, VectorSearchResult } from '@/types/ai';

function dot(a: EmbeddingVector, b: EmbeddingVector): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) sum += a[i]! * b[i]!;
  return sum;
}

function norm(a: EmbeddingVector): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * a[i]!;
  return Math.sqrt(sum);
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  const denom = norm(a) * norm(b);
  if (!Number.isFinite(denom) || denom === 0) return 0;
  return dot(a, b) / denom;
}

export type VectorSearchParams = {
  queryEmbedding: EmbeddingVector;
  chunks: SemanticChunk[];
  topK: number;
  threshold?: number;
};

export function vectorSearchTopK({
  queryEmbedding,
  chunks,
  topK,
  threshold = undefined,
}: VectorSearchParams): VectorSearchResult[] {
  const candidates: VectorSearchResult[] = [];

  for (const chunk of chunks) {
    if (!chunk.embedding) continue;

    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
    if (typeof threshold === 'number' && similarity < threshold) continue;

    candidates.push({
      chunk,
      similarity,
      rank: 0,
    });
  }

  candidates.sort((a, b) => b.similarity - a.similarity);

  const sliced = candidates.slice(0, Math.max(0, topK));
  return sliced.map((r, i) => ({ ...r, rank: i + 1 }));
}

