import { GeminiService } from '@/features/ai/gemini.service';
import type { SemanticChunk, QuizQuestion } from '@/types/ai';

export type QuizMode = 'beginner' | 'interview' | 'revision';

export type QuizGenerationParams = {
  gemini: GeminiService;
  relevantChunks: SemanticChunk[];
  videoTitle?: string;
  mode: QuizMode;
  model: string;
  maxQuestions: number;
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
    .slice(0, 55)
    .map((c) => {
      if (!includeTimestamps) return c.text.trim();
      return `[${Math.floor(c.startTime)}s-${Math.floor(c.endTime)}s] ${c.text.trim()}`;
    })
    .join('\n\n');
}

export async function generateQuiz(params: QuizGenerationParams): Promise<{ questions: QuizQuestion[]; raw: string }> {
  const { gemini, relevantChunks, videoTitle, mode, model, maxQuestions } = params;
  const context = formatContext(relevantChunks, true);

  const system = [
    'You are an AI quiz generator for learning using transcript context.',
    'Return JSON only (no markdown, no code fences).',
    'All questions must be answerable from the provided transcript context.',
    'Prefer conceptual understanding over rote memorization.',
  ].join('\n');

  const modeInstruction =
    mode === 'interview'
      ? 'Interview mode: create questions that mimic a verbal interview. Encourage reasoning.'
      : mode === 'revision'
        ? 'Revision mode: create quick recall questions and common pitfalls.'
        : 'Beginner mode: create clear multiple-choice questions with straightforward correct answers.';

  const user = [
    `Video title: ${videoTitle ?? 'Unknown'}`,
    `Task: Generate up to ${maxQuestions} multiple-choice questions from the transcript.`,
    modeInstruction,
    'Each question must have 4 options.',
    'Provide correctAnswerIndex as 0-3.',
    '',
    'Output JSON schema:',
    '{ "questions": [ { "id": string, "question": string, "options": string[], "correctAnswerIndex": number, "explanation": string, "difficulty": "easy"|"medium"|"hard", "timestamp": number? } ] }',
    '',
    'Transcript context:',
    context || '(No transcript context.)',
  ].join('\n');

  const resp = await gemini.generateText({
    model,
    system,
    user,
    config: { temperature: mode === 'beginner' ? 0.25 : 0.35, maxOutputTokens: 1600 },
  });

  const parsed = safeJsonParse<{ questions: Array<any> }>(resp.content.trim());
  const questionsFromModel = parsed?.questions;

  const questions: QuizQuestion[] =
typeof questionsFromModel?.length === 'number' && questionsFromModel.length
    ? questionsFromModel
        .slice(0, maxQuestions)
        .map((q: any, idx: number) => ({
          id: q?.id ? String(q.id) : `q_${idx}`,
          videoId: '', // filled by store layer
          question: String(q?.question ?? ''),
          options: Array.isArray(q?.options) ? q.options.map((o: any) => String(o)).slice(0, 4) : [],
          correctAnswer: Number(q?.correctAnswerIndex ?? 0),
          explanation: String(q?.explanation ?? ''),
          difficulty:
            q?.difficulty === 'easy' || q?.difficulty === 'medium' || q?.difficulty === 'hard'
              ? q.difficulty
              : 'easy',
          timestamp: typeof q?.timestamp === 'number' ? q.timestamp : undefined,
        }))
        .filter((q) => q.question.trim().length > 0 && q.options.length === 4)
    : relevantChunks.slice(0, Math.max(3, maxQuestions)).map((c, idx) => ({
        id: `q_${idx}`,
        videoId: '',
        question: `Which idea from ${Math.floor(c.startTime)}s is most emphasized?`,
        options: [
          'A definition of the main concept',
          'An unrelated topic',
          'A counterexample not present',
          'A random fact',
        ],
        correctAnswer: 0,
        explanation: 'From transcript context.',
        difficulty: 'medium',
        timestamp: c.startTime,
      }));

  return { questions, raw: resp.content };
}

