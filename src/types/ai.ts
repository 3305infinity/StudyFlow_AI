/**
 * AI-related type definitions
 */



/**
 * Semantic chunk with embedding
 * Used for RAG pipeline
 */
export interface SemanticChunk {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  embedding: number[] | null;
  transcriptChunkIds: string[];
}


/**
 * Embedding vector
 */
export type EmbeddingVector = number[];

/**
 * Embedding model info
 */
export interface EmbeddingModelInfo {
  model: string;
  dimensions?: number;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  chunk: SemanticChunk;
  similarity: number;
  rank: number;
}


/**
 * AI prompt context
 */
export interface PromptContext {
  relevantChunks: SemanticChunk[];
  userQuery: string;
  conversationHistory?: ChatMessage[];
  videoTitle?: string;
  videoDescription?: string;
}

/**
 * Chat message
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  relevantChunks?: SemanticChunk[];
}

/**
 * AI response
 */
export interface AIResponse {
  content: string;
  relevantChunks: SemanticChunk[];
  tokensUsed?: number;
  model: string;
}

/**
 * Chunking options
 */
export interface ChunkingOptions {
  maxChunkSize: number;
  minChunkSize: number;
  overlapSize: number;
  respectSentences: boolean;
  respectParagraphs: boolean;
}

/**
 * Note generation options
 */
export interface NoteGenerationOptions {
  type: 'concise' | 'detailed' | 'interview' | 'revision';
  includeTimestamps: boolean;
  includeExamples: boolean;
  format: 'markdown' | 'plain';
}

/**
 * Chapter
 */
export interface Chapter {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  summary: string;
  keyPoints: string[];
}

/**
 * Flashcard
 */
export interface Flashcard {
  id: string;
  videoId: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  nextReviewDate: number;
  interval: number; // days
  repetitions: number;
  easeFactor: number;
  createdAt: number;
  lastReviewed?: number;
}

/**
 * Quiz question
 */
export interface QuizQuestion {
  id: string;
  videoId: string;
  question: string;
  options: string[];
  correctAnswer: number; // index
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timestamp?: number;
}

/**
 * AI generation status
 */
export type AIGenerationStatus = 
  | 'idle'
  | 'generating'
  | 'success'
  | 'error';
