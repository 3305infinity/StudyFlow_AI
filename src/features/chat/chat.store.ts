import { create } from 'zustand';
import type { SemanticChunk } from '@/types/ai';

export type ChatRole = 'user' | 'assistant';

export type Citation = {
  id: string;
  startTime: number;
  endTime?: number;
  chunkId?: string;
  excerpt?: string;
  similarityScore?: number;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  isStreaming?: boolean;
  tokensUsed?: number;
  citations?: Citation[];
  relevantChunks?: SemanticChunk[];
};

export type ChatState = {
  videoId?: string;
  conversationId?: string;

  messages: ChatMessage[];
  isLoading: boolean;
  error?: string;

  optimisticMessageId?: string;

  // Streaming-ready: we store chunks as they arrive
  stream: {
    activeMessageId?: string;
    partialContent: string;
  };

  setVideoContext: (videoId: string, conversationId?: string) => void;
  resetConversation: () => void;

  addUserMessage: (input: { content: string }) => string;
  addAssistantMessagePlaceholder: (input: { assistantMessageId?: string }) => string;

  updateStreamingContent: (input: { messageId: string; delta: string }) => void;
  finalizeStreamingMessage: (input: {
    messageId: string;
    finalContent: string;
    citations?: Citation[];
    relevantChunks?: SemanticChunk[];
  }) => void;

  setLoading: (v: boolean) => void;
  setError: (err?: string) => void;
};

function uid(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  videoId: undefined,
  conversationId: undefined,

  messages: [],
  isLoading: false,
  error: undefined,
  optimisticMessageId: undefined,

  stream: {
    activeMessageId: undefined,
    partialContent: '',
  },

  setVideoContext: (videoId: string, conversationId?: string) => {
    set({ videoId, conversationId });
  },

  resetConversation: () => {
    set({
      messages: [],
      isLoading: false,
      error: undefined,
      optimisticMessageId: undefined,
      stream: { activeMessageId: undefined, partialContent: '' },
    });
  },

  addUserMessage: ({ content }) => {
    const id = uid('m');
    const msg: ChatMessage = {
      id,
      role: 'user',
      content,
      createdAt: Date.now(),
    };

    set({ messages: [...get().messages, msg], optimisticMessageId: undefined });
    return id;
  },

  addAssistantMessagePlaceholder: ({ assistantMessageId }) => {
    const id = assistantMessageId ?? uid('a');

    const msg: ChatMessage = {
      id,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      isStreaming: true,
      citations: [],
      relevantChunks: [],
    };

    set({
      messages: [...get().messages, msg],
      isLoading: true,
      stream: { activeMessageId: id, partialContent: '' },
    });

    return id;
  },

  updateStreamingContent: ({ messageId, delta }) => {
    const { stream } = get();
    if (stream.activeMessageId !== messageId) return;

    const partialContent = stream.partialContent + delta;

    set({
      stream: { activeMessageId: messageId, partialContent },
      messages: get().messages.map(m =>
        m.id === messageId ? { ...m, content: partialContent, isStreaming: true } : m
      ),
    });
  },

  finalizeStreamingMessage: ({
    messageId,
    finalContent,
    citations,
    relevantChunks,
  }) => {
    set({
      isLoading: false,
      error: undefined,
      stream: { activeMessageId: undefined, partialContent: '' },
      messages: get().messages.map(m =>
        m.id === messageId
          ? {
              ...m,
              content: finalContent,
              isStreaming: false,
              citations: citations ?? m.citations,
              relevantChunks: relevantChunks ?? m.relevantChunks,
            }
          : m
      ),
    });
  },

  setLoading: (v: boolean) => set({ isLoading: v }),
  setError: (err?: string) => set({ error: err, isLoading: false }),
}));

