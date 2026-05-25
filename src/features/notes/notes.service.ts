import { GeminiService } from '@/features/ai/gemini.service';
import type { PromptBuilderOptions } from '@/features/ai/promptBuilder';
import type { SemanticChunk } from '@/types/ai';
import type { Note } from '@/types/notes';

export type NotesGenerationMode = 'concise' | 'detailed' | 'interview' | 'revision';

export type NotesGenerationOptions = {
  mode: NotesGenerationMode;
  includeTimestamps: boolean;
  includeExamples: boolean;
  videoTitle?: string;
  notesCount?: number;
  model: string;
  promptOptionsBase: PromptBuilderOptions;
};



function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function formatTranscriptAnchors(chunks: SemanticChunk[], includeTimestamps: boolean) {
  // Keep context compact: we let Gemini decide structure but we keep anchor metadata.
  return chunks
    .slice(0, 40)
    .map((c) => {
      if (!includeTimestamps) return c.text.trim();
      return `[${Math.floor(c.startTime)}s-${Math.floor(c.endTime)}s] ${c.text.trim()}`;
    })
    .join('\n\n');
}

export async function generateNotes(params: {
  gemini: GeminiService;
  relevantChunks: SemanticChunk[];
  mode: NotesGenerationMode;
  includeTimestamps: boolean;
  includeExamples: boolean;
  videoTitle?: string;
  model: string;
  promptOptionsBase: PromptBuilderOptions;
}): Promise<{ note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'isPinned'>; raw: string }> {
  const {
    gemini,
    relevantChunks,
    mode,
    includeTimestamps,
    includeExamples,
    videoTitle,
    model,
  } = params;


  const context = formatTranscriptAnchors(relevantChunks, includeTimestamps);

  const system = [
    'You are an AI note-taking engine for a learning system.',
    'Return JSON only (no markdown, no code fences).',
    'You must use the provided transcript context; do not invent facts.',
  ].join('\n');

  const modeInstruction =
    mode === 'concise'
      ? 'Write concise bullet notes. Each section should be short and information-dense.'
      : mode === 'detailed'
        ? 'Write detailed structured notes. Include key ideas, explanations, and small clarifications.'
        : mode === 'interview'
          ? 'Write interview-style notes. Focus on question/answer framing and Socratic points.'
          : 'Write revision notes: summarize for quick recall and test the student.';

  const includeExamplesInstruction = includeExamples
    ? 'Include 1-3 examples grounded in the transcript.'
    : 'Do not add examples beyond what the transcript supports.';

  const user = [
    `Video title: ${videoTitle ?? 'Unknown'}`,
    `Task: Generate ${mode} notes suitable for studying.`,
    modeInstruction,
    includeExamplesInstruction,
    `includeTimestamps=${includeTimestamps}`,
    '',
    'Output JSON schema:',
    '{ "title": string, "content": string, "tags": string[] }',
    '',
    'Transcript context:',
    context || '(No transcript context.)',
  ].join('\n');

  const resp = await gemini.generateText({
    model,
    system,
    user,
    config: { temperature: mode === 'detailed' ? 0.4 : 0.3, maxOutputTokens: 1200 },
  });

  const parsed = safeJsonParse<{ title: string; content: string; tags: string[] }>(resp.content.trim());

  const fallbackTitle = mode === 'revision' ? 'Revision Notes' : 'Study Notes';
  const fallbackContent = relevantChunks.slice(0, 12).map((c) => (includeTimestamps ? `- (${Math.floor(c.startTime)}s) ${c.text}` : `- ${c.text}`)).join('\n');

  const title = parsed?.title?.trim?.() || fallbackTitle;
  const content = parsed?.content?.trim?.() || fallbackContent;


  return {
    note: {
      videoId: '', // filled by store layer
      type: mode,
      title,
      content,
      format: 'markdown',
      timestampAnchors: includeTimestamps
        ? relevantChunks
            .slice(0, 20)
            .map((c) => ({ startTime: c.startTime, endTime: c.endTime }))
        : undefined,
    } as any,
    raw: resp.content,
  };
}

