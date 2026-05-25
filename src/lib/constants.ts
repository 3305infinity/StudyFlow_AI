/**
 * Application-wide constants
 * 
 * Centralized configuration for:
 * - API endpoints
 * - Chunking parameters
 * - Similarity thresholds
 * - UI constants
 */

// YouTube API endpoints
export const YOUTUBE_API = {
  TIMEDTEXT: 'https://www.youtube.com/api/timedtext',
  PLAYER_RESPONSE: 'https://www.youtube.com/youtubei/v1/player',
} as const;

// Semantic chunking configuration
export const CHUNKING = {
  MAX_CHUNK_SIZE: 800, // tokens
  MIN_CHUNK_SIZE: 100,
  OVERLAP_SIZE: 100,
  SENTENCE_BOUNDARY_WEIGHT: 0.7,
} as const;

// Vector search configuration
export const VECTOR_SEARCH = {
  TOP_K: 5,
  SIMILARITY_THRESHOLD: 0.7,
  HYBRID_WEIGHT: 0.5, // Balance between vector and keyword search
} as const;

// Gemini API configuration
export const GEMINI = {
  MODEL: 'gemini-1.5-flash',
  EMBEDDING_MODEL: 'models/embedding-001',
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.7,
} as const;

// Storage keys
export const STORAGE_KEYS = {
  GEMINI_API_KEY: 'gemini_api_key',
  SETTINGS: 'settings',
  LAST_VIDEO_ID: 'last_video_id',
} as const;

// UI constants
export const UI = {
  SIDEBAR_WIDTH: 420,
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 3000,
} as const;

// Analytics event types
export const ANALYTICS_EVENTS = {
  VIDEO_LOAD: 'video_load',
  SEEK: 'seek',
  PAUSE: 'pause',
  REWIND: 'rewind',
  SPEED_CHANGE: 'speed_change',
  CONFUSION_DETECTED: 'confusion_detected',
} as const;

// Confusion detection thresholds
export const CONFUSION = {
  REWIND_THRESHOLD: 3, // seconds
  PAUSE_DURATION_THRESHOLD: 5, // seconds
  SEEK_BACK_THRESHOLD: 10, // seconds
  SPEED_CHANGE_THRESHOLD: 0.25, // speed difference
} as const;
