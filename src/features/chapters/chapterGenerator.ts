import { type PromptBuilderOptions } from '@/features/ai/promptBuilder';
import { GeminiService } from '@/features/ai/gemini.service';
import type { Chapter, SemanticChunk } from '@/types/ai';

export type ChapterGenerationMode = 'default' | 'beginner' | 'interview';

export type ChapterGeneratorOptions = {
  videoTitle?: string;
  mode: ChapterGenerationMode;
  includeTimestamps: boolean;
  maxChapters?: number;
  model?: string;
  promptOptions?: Partial<PromptBuilderOptions>;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function chunkToWindowText(chunks: SemanticChunk[], includeTimestamps: boolean) {
  return chunks
    .map((c) => {
      if (!includeTimestamps) return c.text.trim();
      const start = Math.max(0, c.startTime);
      const end = Math.max(start, c.endTime);
      const fmt = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        return `${m}:${String(sec).padStart(2, '0')}`;
      };
      return `[${fmt(start)} - ${fmt(end)}]\n${c.text.trim()}`;
    })
    .join('\n\n');
}

export async function generateChapters(params: {
  gemini: GeminiService;
  promptOptionsBase: PromptBuilderOptions;
  relevantChunks: SemanticChunk[];
  mode: ChapterGenerationMode;
  maxChapters: number;
  model: string;
  videoTitle?: string;
  includeTimestamps: boolean;
}): Promise<{ chapters: Chapter[]; raw: string }> {
  const { gemini, relevantChunks, mode, maxChapters, model, videoTitle, includeTimestamps } = params;

  // We intentionally ask for a structured JSON output.
  const modeInstruction =
    mode === 'interview'
      ? 'You are generating chapters for an interview-style study. Make sections align with concept questions.'
      : mode === 'beginner'
        ? 'You are generating chapters for beginners. Prefer intuitive section boundaries.'
        : 'Generate semantic chapters that reflect the lecture structure.';

  // Build a compact context string.
  // We use the first N chunks to seed segmentation; the model will infer boundaries.
  const seedChunks = relevantChunks;
  const context = chunkToWindowText(seedChunks, includeTimestamps);

  const system = [
    'You are an AI that generates semantic video chapters for a learning system.',
    'Output MUST be valid JSON only (no markdown, no code fences).',
    modeInstruction,
    'Each chapter must include startTime and endTime in seconds.',
    'Chapter ranges must be monotonically increasing and cover the provided time span reasonably.',
  ].join('\n');

  const user = [
    `Video title: ${videoTitle ?? 'Unknown'}`,
    `Task: Create up to ${maxChapters} semantic chapters with labels suitable for studying.`,
    'Return JSON with schema:',
    '{ "chapters": [ { "id": string, "title": string, "startTime": number, "endTime": number, "summary": string, "keyPoints": string[] } ] }',
    'Constraints:',
    `- includeTimestamps=${includeTimestamps}`,
    '- keyPoints length 3-6',
    '- startTime and endTime in seconds',
    '- summary 1-2 sentences',
    '',
    'Transcript context (timestamp-aware):',
    context || '(No transcript context provided.)',
  ].join('\n');

  const resp = await gemini.generateText({
    model,
    system,
    user,
    config: { temperature: 0.3, maxOutputTokens: 900 },
  });

  const parsed = safeJsonParse<{ chapters: Chapter[] }>(resp.content.trim());

  if (!parsed?.chapters?.length) {
    // Fallback: create very rough chapters from chunk windows.
    const fallbackMax = clamp(maxChapters, 1, 20);
    const windows = Math.max(1, Math.floor(relevantChunks.length / fallbackMax));
    const chapters: Chapter[] = [];
    for (let i = 0; i < fallbackMax; i++) {
      const startIdx = i * windows;
      const endIdx = Math.min(relevantChunks.length, (i + 1) * windows);
      const group = relevantChunks.slice(startIdx, endIdx);
      if (!group.length) continue;
      const startTime = group[0]!.startTime;
      const endTime = group[group.length - 1]!.endTime;
      chapters.push({
        id: `ch_${i}_${Math.floor(startTime)}`,
        title: `Section ${i + 1}`,
        startTime,
        endTime,
        summary: ((group[0]?.text ?? '') as string).slice(0, 140).trim(),

        keyPoints: group
          .slice(0, 3)
          .map((c) => c.text.split(/[\n\.]/)[0]?.trim())
          .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
          .slice(0, 5),
      });
    }
    return { chapters, raw: resp.content };
  }

  // Normalize and enforce maxChapters.
  const chapters = (parsed.chapters ?? []).slice(0, maxChapters).map((c, idx) => {
    const keyPoints = Array.isArray(c.keyPoints)
      ? c.keyPoints.map((k) => (k == null ? '' : String(k))).filter((k): k is string => k.trim().length > 0)
      : [];

    return {
      ...c,
      id: c.id || `ch_${idx}`,
      title: (c.title || '').trim() || `Chapter ${idx + 1}`,
      summary: (c.summary || '').trim(),
      keyPoints,
      startTime: Number(c.startTime ?? 0),
      endTime: Number(c.endTime ?? 0),
    };
  });

  // Sort and fix monotonicity lightly.
  chapters.sort((a, b) => a.startTime - b.startTime);

  for (let i = 0; i < chapters.length; i++) {
    const prev = chapters[i - 1];
    const cur = chapters[i];
    if (!cur) continue;

    if (prev && cur.startTime < prev.endTime) {
      cur.startTime = prev.endTime;
    }
    if (cur.endTime < cur.startTime) {
      cur.endTime = cur.startTime;
    }

  }

  return { chapters, raw: resp.content };
}

