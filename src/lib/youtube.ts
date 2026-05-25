/**
 * YouTube utility functions
 * 
 * Handles:
 * - Video ID extraction from URLs
 * - URL parsing and validation
 * - YouTube player interaction
 */

/**
 * Extract video ID from YouTube URL
 * Supports multiple URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
export function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    // Standard watch URL
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
      return urlObj.searchParams.get('v');
    }
    
    // Short URL
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    
    // Embed URL
    if (urlObj.pathname.startsWith('/embed/')) {
      return urlObj.pathname.split('/')[2] ?? null;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Get current video ID from page
 */
export function getCurrentVideoId(): string | null {
  return extractVideoId(window.location.href);
}

/**
 * Check if current page is a YouTube watch page
 */
export function isYouTubeWatchPage(): boolean {
  return window.location.hostname.includes('youtube.com') && 
         window.location.pathname === '/watch';
}

/**
 * Get YouTube player element
 */
export function getYouTubePlayer(): HTMLVideoElement | null {
  return document.querySelector('video.html5-main-video');
}

/**
 * Get current video time
 */
export function getCurrentTime(): number {
  const player = getYouTubePlayer();
  return player?.currentTime ?? 0;
}

/**
 * Seek to specific time
 */
export function seekTo(time: number): void {
  const player = getYouTubePlayer();
  if (player) {
    player.currentTime = time;
  }
}

/**
 * Get video duration
 */
export function getVideoDuration(): number {
  const player = getYouTubePlayer();
  return player?.duration ?? 0;
}

/**
 * Format time in seconds to MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse time string (MM:SS or HH:MM:SS) to seconds
 */
export function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  
  if (parts.length === 2) {
    return parts[0]! * 60 + parts[1]!;
  }
  
  if (parts.length === 3) {
    return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  }
  
  return 0;
}
