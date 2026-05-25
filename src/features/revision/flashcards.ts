import { GeminiService } from '@/features/ai/gemini.service';
import type { SemanticChunk } from '@/types/ai';
import type { FlashcardRow } from '@/lib/db';

export type FlashcardMode = 'beginner' | 'interview' | 'revision';

export type FlashcardGenerationParams = {
  gemini: GeminiService;
  relevantChunks: SemanticChunk[];
  videoTitle?: string;
  mode: FlashcardMode;
  model: string;
  maxCards: number;
};

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function formatContext(chunks: SemanticChunk[], includeTimestamps: boolean) {
  return chunks
    .slice(0, 50)
    .map((c) => {
      if (!includeTimestamps) return c.text.trim();
      return `[${Math.floor(c.startTime)}s-${Math.floor(c.endTime)}s] ${c.text.trim()}`;
    })
    .join('\n\n');
}

export async function generateFlashcards(params: FlashcardGenerationParams): Promise<{ flashcards: Array<{ id: string; videoId: string; front: string; back: string; difficulty: FlashcardRow['difficulty'] }>; raw: string }> {
  const { gemini, relevantChunks, videoTitle, mode, model, maxCards } = params;

  const context = formatContext(relevantChunks, true);

  const system = [
    'You are an AI that generates flashcards for spaced repetition learning.',
    'Return JSON only (no markdown, no code fences).',
    'Cards must be grounded in the provided context.',
  ].join('\n');

  const modeInstruction =
    mode === 'interview'
      ? 'Generate interview-focused cards that test reasoning and key definitions. Mix in “why/how” style prompts.'
      : mode === 'revision'
        ? 'Generate revision cards optimized for quick recall. Prefer short prompts.'
        : 'Generate beginner-friendly cards with clear, simple front prompts and direct back answers.';

  const user = [
    `Video title: ${videoTitle ?? 'Unknown'}`,
    `Task: Generate up to ${maxCards} flashcards.`,
    modeInstruction,
    'Each card must include difficulty (easy|medium|hard).',
    '',
    'Output JSON schema:',
    '{ "flashcards": [ { "id": string, "front": string, "back": string, "difficulty": "easy"|"medium"|"hard" } ] }',
    '',
    'Transcript context:',
    context || '(No transcript context.)',
  ].join('\n');

  const resp = await gemini.generateText({
    model,
    system,
    user,
    config: { temperature: 0.35, maxOutputTokens: 1200 },
  });

  const parsed = safeJsonParse<{ flashcards: Array<{ id: string; front: string; back: string; difficulty: FlashcardRow['difficulty'] }> }>(resp.content.trim());



  const cards = parsed?.flashcards?.length
    ? parsed.flashcards.slice(0, maxCards)
    : relevantChunks.slice(0, Math.max(3, maxCards)).map((c, idx) => ({
        id: `fc_${idx}_${Math.floor(c.startTime)}`,
        front: `What is a key idea from ${Math.floor(c.startTime)}s?`,
        back: c.text.slice(0, 220),
        difficulty: 'medium' as const,
      }));

  return {
    flashcards: cards.map((c) => ({
      id: c.id,
      videoId: '', // filled by store layer
      front: c.front,
      back: c.back,
      difficulty: c.difficulty,
    })) as any,
    raw: resp.content,
  };
}

