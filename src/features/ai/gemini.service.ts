import type { EmbeddingModelInfo } from '@/types/ai';

export type GeminiEmbeddingsRequest = {
  model: string;
  input: string[];
};

export type GeminiEmbeddingsResponse = {
  model: string;
  embeddings: number[][];
  dimensions?: number;
};

function getEnv(key: string): string | undefined {
  // Extension build-time env injection (Vite) typically uses import.meta.env.
  // We keep it environment-safe.
  const v = (import.meta as any)?.env?.[key];
  if (typeof v === 'string' && v.trim()) return v;
  return undefined;
}

function backoffMs(attempt: number): number {
  // capped exponential backoff with jitter
  const base = 250;
  const cap = 4000;
  const exp = Math.min(cap, base * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 150);
  return exp + jitter;
}

export type GeminiTextRequest = {
  model: string;
  prompt: {
    system?: string;
    user: string;
  };
  config?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
};

export type GeminiTextResponse = {
  content: string;
  tokensUsed?: number;
  model: string;
};

import { parseGeminiCompletionResponse } from './gemini.completion';

export type GeminiGenerateConfig = {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
};

export type GeminiGenerateTextRequest = {
  model: string;
  system?: string;
  user: string;
  config?: GeminiGenerateConfig;
};

export class GeminiService {
  private apiKey: string;
  private baseUrl: string;


  constructor(opts: {
    apiKey?: string;
    baseUrl?: string;
    defaultEmbeddingModel?: EmbeddingModelInfo;
  } = {}) {

    const apiKey = opts.apiKey ?? getEnv('VITE_GEMINI_API_KEY');
    if (!apiKey) {
      // Keep construction valid; failures will surface on request.
      this.apiKey = '';
    } else {
      this.apiKey = apiKey;
    }

    this.baseUrl = opts.baseUrl ?? 'https://generativelanguage.googleapis.com';
    // defaultEmbeddingModel intentionally not stored (kept for future use)
    // const defaultModel = opts.defaultEmbeddingModel ?? { model: 'models/embedding-001' };
  }


  private async requestWithRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, backoffMs(attempt)));
      }
    }
    throw lastErr;
  }

  async generateText(req: GeminiGenerateTextRequest, maxAttempts = 4): Promise<GeminiTextResponse> {

    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error('Gemini API key missing (expected VITE_GEMINI_API_KEY or configured GeminiService.apiKey).');
    }

    const url = `${this.baseUrl}/v1beta/models/${encodeURIComponent(req.model.replace('models/', ''))}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body: any = {
      contents: [
        {
          role: 'user',
          parts: [
            ...(req.system ? [{ text: req.system }] : []),
            { text: req.user },
          ],
        },
      ],
    };

    if (req.config) {
      body.generationConfig = {
        ...(typeof req.config.temperature === 'number' ? { temperature: req.config.temperature } : {}),
        ...(typeof req.config.maxOutputTokens === 'number' ? { maxOutputTokens: req.config.maxOutputTokens } : {}),
        ...(typeof req.config.topP === 'number' ? { topP: req.config.topP } : {}),
        ...(typeof req.config.topK === 'number' ? { topK: req.config.topK } : {}),
      };
    }

    const resp = await this.requestWithRetry(async () => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const text = await r.text().catch(() => '');
        const err = new Error(`Gemini generateText failed: ${r.status} ${r.statusText}${text ? ` - ${text}` : ''}`);
        (err as any).status = r.status;
        throw err;
      }

      return r;
    }, maxAttempts);

    const data = (await resp.json()) as any;
    const parseReq = {
      model: req.model,
      prompt: { system: req.system, user: req.user },
      config: req.config
        ? {
            temperature: req.config.temperature,
            maxOutputTokens: req.config.maxOutputTokens,
          }
        : undefined,
    };

    return parseGeminiCompletionResponse(data, parseReq);

  }

  async embedTexts(req: GeminiEmbeddingsRequest, maxAttempts = 4): Promise<GeminiEmbeddingsResponse> {


    const apiKey = this.apiKey;






    if (!apiKey) {
      throw new Error('Gemini API key missing (expected VITE_GEMINI_API_KEY or configured GeminiService.apiKey).');
    }

    const url = `${this.baseUrl}/v1beta/models/${encodeURIComponent(req.model.replace('models/', ''))}:embedContent?key=${encodeURIComponent(apiKey)}`;

    // Gemini embedding API expects content parts.
    // We map input strings into parts.
    const body = {
      model: req.model,
      requests: req.input.map((t) => ({
        model: req.model,
        content: { role: 'user', parts: [{ text: t }] },
      })),
    };

    const resp = await this.requestWithRetry(async () => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const text = await r.text().catch(() => '');
        const err = new Error(`Gemini embeddings request failed: ${r.status} ${r.statusText}${text ? ` - ${text}` : ''}`);
        (err as any).status = r.status;
        throw err;
      }

      return r;
    }, maxAttempts);

    const data = (await resp.json()) as any;

    // Supported shapes for embedding endpoints vary; we handle common patterns.
    // Expected: data.embeddings or data.embeddings[i].values
    const embeddings: number[][] = [];

    const rawEmbeddings = data?.embeddings ?? data?.embedding;
    if (Array.isArray(rawEmbeddings)) {
      for (const e of rawEmbeddings) {
        const values = e?.values ?? e?.embedding?.values ?? e?.embedding?.value;
        if (Array.isArray(values)) embeddings.push(values.map((x: any) => Number(x)));
      }
    }

    // Alternative: requestsResponses
    const rr = data?.responses;
    if (!embeddings.length && Array.isArray(rr)) {
      for (const item of rr) {
        const values = item?.embedding?.values ?? item?.embedding?.value;
        if (Array.isArray(values)) embeddings.push(values.map((x: any) => Number(x)));
      }
    }

    if (!embeddings.length) {
      throw new Error('Gemini embeddings response parse failed (no embeddings found).');
    }

    const dimensions = typeof rawEmbeddings?.[0]?.values?.length === 'number' ? rawEmbeddings[0].values.length : undefined;

    return { model: req.model, embeddings, dimensions };
  }
}

