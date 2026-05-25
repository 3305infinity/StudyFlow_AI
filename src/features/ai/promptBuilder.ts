import type { SemanticChunk } from '@/types/ai';


export type InterviewMode = {
  enabled: boolean;
};

export type PromptBuilderOptions = {
  mode: 'interview' | 'student' | 'default';
  includeTimestamps: boolean;
  maxContextChars: number;
  antiHallucination: boolean;
};

function clampText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
}

function formatChunkForContext(chunk: SemanticChunk, includeTimestamps: boolean): string {
  if (!includeTimestamps) return chunk.text.trim();
  const start = Math.max(0, chunk.startTime);
  const end = Math.max(start, chunk.endTime);
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return `[${fmt(start)} - ${fmt(end)}] ${chunk.text.trim()}`;
}

export type BuiltPrompt = {
  system: string;
  user: string;
  // Later we can extend this to carry structured fields for tool calling.
  contextChunks: SemanticChunk[];
};

export function buildEducationalPrompt(params: {
  userQuery: string;
  relevantChunks: SemanticChunk[];
  videoTitle?: string;
  promptOptions: PromptBuilderOptions;
}): BuiltPrompt {
  const { userQuery, relevantChunks, videoTitle, promptOptions } = params;

  const contextChunks = relevantChunks.filter((c) => c.text.trim().length > 0);

  // Compose compact context with deterministic truncation.
  let context = '';
  for (const c of contextChunks) {
    const next = formatChunkForContext(c, promptOptions.includeTimestamps);
    if (!next.trim()) continue;

    const candidate = context ? `${context}\n\n${next}` : next;
    if (candidate.length > promptOptions.maxContextChars) break;
    context = candidate;
  }

  context = clampText(context, promptOptions.maxContextChars);

  const antiHallucination = promptOptions.antiHallucination
    ? 'You MUST use ONLY the retrieved context provided. If the answer is not contained in the context, say: "I can’t find that in the retrieved transcript context."'
    : '';

  const modeInstruction =
    promptOptions.mode === 'interview'
      ? 'Interview mode: ask 1-2 Socratic questions first, then provide a concise explanation based on the context.'
      : promptOptions.mode === 'student'
        ? 'Student mode: explain step-by-step with minimal fluff; end with 2 quick self-check questions.'
        : 'Explain clearly and accurately using the provided context.';

  const titleLine = videoTitle ? `Video title: ${videoTitle}\n` : '';

  const system = [
    'You are an AI learning assistant embedded in a YouTube study platform.',
    'Your job is to help a student deeply understand the lecture using retrieved transcript context.',
    antiHallucination,
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    titleLine + 'Task: Provide the best possible answer to the student query.',
    modeInstruction,
    'Student query:',
    userQuery.trim(),
    '',
    'Retrieved transcript context (timestamp-aware):',
    context || '(No relevant context available.)',
    '',
    'Response requirements:',
    '- Be concise but instructional.',
    '- Use timestamps when referencing specifics (e.g., mention where in the video the idea appears).',
    '- Do not invent facts outside the context.',
  ].filter(Boolean).join('\n');

  return { system, user, contextChunks };
}

