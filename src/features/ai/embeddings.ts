import type { EmbeddingVector, SemanticChunk } from '@/types/ai';
import type { GeminiEmbeddingsResponse } from './gemini.service';
import { GeminiService } from './gemini.service';

export type EmbeddingPipelineOptions = {
  model: string;
  batchSize: number;
  maxConcurrency: number;
  retryAttempts: number;
};

type CacheKey = string;

// In-memory cache fallback.
// If Dexie caching exists later, we can replace the interface without changing call sites.
const embeddingCache = new Map<CacheKey, number[]>();

function stableCacheKey(model: string, text: string): CacheKey {
  // Deterministic based on model + normalized text.
  const t = text.replace(/\s+/g, ' ').trim();
  return `${model}:${t}`;
}

function chunkArray<T>(arr: T[], batchSize: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += batchSize) out.push(arr.slice(i, i + batchSize));
  return out;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    while (true) {
      const i = nextIndex;
      if (i >= items.length) break;
      nextIndex++;
      results[i] = await fn(items[i]!, i);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function embedSemanticChunks(
  chunks: SemanticChunk[],
  gemini: GeminiService,
  options: EmbeddingPipelineOptions
): Promise<SemanticChunk[]> {
  // Only embed chunks that don't have embeddings yet.
  const toEmbed = chunks.filter((c) => !c.embedding);
  if (!toEmbed.length) return chunks;

  // Concurrency for text->embedding mapping while keeping Gemini calls batched.
  const batchTexts: { chunkId: string; text: string; cacheKey: CacheKey }[] = toEmbed.map((c) => {
    const cacheKey = stableCacheKey(options.model, c.text);
    return { chunkId: c.id, text: c.text, cacheKey };
  });

  // Fill from cache first.
  const cachedByChunkId = new Map<string, number[]>();
  for (const item of batchTexts) {
    const v = embeddingCache.get(item.cacheKey);
    if (v) cachedByChunkId.set(item.chunkId, v);
  }

  const remaining = batchTexts.filter((i) => !cachedByChunkId.has(i.chunkId));
  const batches = chunkArray(remaining, Math.max(1, options.batchSize));

  // Each batch call produces embeddings in the same order as input.
  const batchResults = await mapWithConcurrency(batches, options.maxConcurrency, async (batch) => {
    const resp: GeminiEmbeddingsResponse = await gemini.embedTexts({
      model: options.model,
      input: batch.map((b) => b.text),
    }, options.retryAttempts);

    return { batch, resp };
  });

  // Apply results + update cache.
  const updatedById = new Map<string, number[]>();
  for (const [chunkId, emb] of cachedByChunkId.entries()) updatedById.set(chunkId, emb);

  for (const br of batchResults) {
    const embeddings = br.resp.embeddings;
    for (let i = 0; i < br.batch.length; i++) {
      const chunkId = br.batch[i]!.chunkId;
      const vec: EmbeddingVector = embeddings[i]!;
      const cacheKey = br.batch[i]!.cacheKey;
      embeddingCache.set(cacheKey, vec);
      updatedById.set(chunkId, vec);
    }
  }

  return chunks.map((c) => {
    const vec = updatedById.get(c.id);
    if (!vec) return c;
    return { ...c, embedding: vec };
  });
}

