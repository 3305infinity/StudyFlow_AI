import type { GeminiTextRequest, GeminiTextResponse } from './gemini.service';

export type GeminiGenerateConfig = {
  temperature?: number;
  maxOutputTokens?: number;
};

export type GeminiCompletionRequest = {
  model: string;
  system?: string;
  user: string;
  config?: GeminiGenerateConfig;
};

export type GeminiCompletionResponse = GeminiTextResponse;

export function normalizeGeminiText(content: unknown): string {
  if (typeof content === 'string') return content;
  return '';
}

function extractTextFromGeminiPayload(data: any): string | null {
  // Common response shapes we try to support.
  const cand1 = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('');
  if (typeof cand1 === 'string' && cand1.trim()) return cand1;

  const cand2 = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof cand2 === 'string' && cand2.trim()) return cand2;

  // Fallback if API returns plain text somewhere
  const txt = data?.text;
  if (typeof txt === 'string' && txt.trim()) return txt;

  return null;
}

export function parseGeminiCompletionResponse(data: any, req: GeminiTextRequest): GeminiCompletionResponse {
  const content = extractTextFromGeminiPayload(data);
  if (!content) {
    throw new Error('Gemini completion response parse failed (no text content).');
  }

  const usage = data?.usageMetadata;
  const tokensUsed = usage?.totalTokenCount ?? usage?.promptTokenCount ?? undefined;

  return {
    content,
    tokensUsed: typeof tokensUsed === 'number' ? tokensUsed : undefined,
    model: req.model,
  };
}

