import { useChatStore, type Citation } from './chat.store';

import type {
  AIResponse,

  VectorSearchResult,
  SemanticChunk,
} from '@/types/ai';
import { GeminiService } from '../ai/gemini.service';
import { vectorSearchTopK } from '../ai/vectorSearch';
import { buildEducationalPrompt, type PromptBuilderOptions } from '../ai/promptBuilder';
import type { Transcript } from '@/types/transcript';

export type ChatSendOptions = {
  question: string;
  mode?: 'concise' | 'deep' | 'interview' | 'beginner';
  maxChunks?: number;
  similarityThreshold?: number;
};
export type ChatCitation = Citation;

export type ChatServiceDeps = {
  videoId: string;
  transcript: Transcript;
  semanticChunks: SemanticChunk[];
};

export type RetrievalContext = {
  query: string;
  embedding: number[];
  retrieved: VectorSearchResult[];
  contextChunks: SemanticChunk[];
};

function uniqueCitationsFromChunks(
  results: VectorSearchResult[],
  maxCitations: number
): ChatCitation[] {
  const citations: ChatCitation[] = [];
  for (const r of results) {
    citations.push({
      id: `c:${r.chunk.id}`,
      startTime: r.chunk.startTime,
      endTime: r.chunk.endTime,
      chunkId: r.chunk.id,
      excerpt: r.chunk.text,
      similarityScore: r.similarity,
    });
    if (citations.length >= maxCitations) break;
  }
  return citations;
}

export async function sendChatMessage(
  deps: ChatServiceDeps,
  input: ChatSendOptions
): Promise<AIResponse> {
  const { semanticChunks } = deps;


  const question = input.question.trim();
  if (!question) {
    throw new Error('Question is empty');
  }

  const mode = input.mode ?? 'concise';

  const maxChunks = input.maxChunks ?? 8;
  const similarityThreshold = input.similarityThreshold ?? 0.25;

  const store = useChatStore;

  const userMessageId = store.getState().addUserMessage({ content: question });
  void userMessageId;

  const assistantMessageId = store.getState().addAssistantMessagePlaceholder({
    assistantMessageId: undefined,
  });

  try {
    // 1) embed query
    const geminiClient = new GeminiService();
    const embeddingResp = await geminiClient.embedTexts({
      model: 'models/embedding-001',
      input: [question],
    });
    const embedding = embeddingResp.embeddings[0]!;


    // 2) vector search over already-embedded semantic chunks
    const searchResults = vectorSearchTopK({
      queryEmbedding: embedding,
      chunks: semanticChunks,
      topK: maxChunks,
      threshold: similarityThreshold,
    });


    // 3) Build prompt with retrieved context
    const relevantChunks = searchResults.map(r => r.chunk);

    const promptOptions: PromptBuilderOptions = {
      mode: mode === 'deep' ? 'student' : mode === 'interview' ? 'interview' : mode === 'beginner' ? 'student' : 'default',
      includeTimestamps: true,
      maxContextChars: 6000,
      antiHallucination: true,
    };

    const built = buildEducationalPrompt({
      userQuery: question,
      relevantChunks,
      videoTitle: undefined,
      promptOptions,
    });

    // 4) Gemini completion request
    const gemini = new GeminiService();
    const result = await gemini.generateText({
      model: 'models/gemini-1.5-pro',
      system: built.system,
      user: built.user,
      config: {
        temperature: 0.2,
        maxOutputTokens: 700,
      },
    });



    const citations = uniqueCitationsFromChunks(searchResults, 6);

    store
      .getState()
      .finalizeStreamingMessage({
        messageId: assistantMessageId,
        finalContent: result.content,
        citations,
        relevantChunks: relevantChunks,
      });

    return {
      content: result.content,
      relevantChunks,
      tokensUsed: result.tokensUsed,
      model: result.model,
    };
  } catch (e: any) {
    store.getState().setError(e?.message ?? String(e));
    throw e;
  }
}

