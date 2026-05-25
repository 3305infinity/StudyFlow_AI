/**
 * Notes type definitions
 */

/**
 * Note type
 */
export type NoteType = 'concise' | 'detailed' | 'interview' | 'revision' | 'custom';

/**
 * Note
 */
export interface Note {
  id: string;
  videoId: string;
  type: NoteType;
  title: string;
  content: string;
  format: 'markdown' | 'plain';
  createdAt: number;
  updatedAt: number;
  tags: string[];
  isPinned: boolean;
}

/**
 * Export format
 */
export type ExportFormat = 'markdown' | 'pdf' | 'notion' | 'json';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  includeTranscript: boolean;
  includeNotes: boolean;
  includeFlashcards: boolean;
  includeChapters: boolean;
  includeTimestamps: boolean;
}
