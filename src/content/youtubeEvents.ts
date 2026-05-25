/**
 * YouTube Event Tracking
 * 
 * Tracks user interactions with the video player:
 * - Time updates (for transcript sync)
 * - Seeks (for confusion detection)
 * - Pauses (for confusion detection)
 * - Playback rate changes
 * - Video load/unload
 * 
 * These events are used for:
 * - Syncing transcript with video
 * - Detecting confusion patterns
 * - Building learning analytics
 */

import { getYouTubePlayer } from '@lib/youtube';
import { ANALYTICS_EVENTS } from '@lib/constants';

export interface VideoEvent {
  type: string;
  videoId: string;
  timestamp: number;
  data?: any;
}

// Event listeners storage
const eventListeners: Array<() => void> = [];

/**
 * Setup YouTube event tracking
 * Returns cleanup function
 */
export function setupYouTubeEventTracking(videoId: string): () => void {
  const player = getYouTubePlayer();
  
  if (!player) {
    console.warn('[YT StudyFlow] Video player not found');
    return () => {};
  }
  
  console.log('[YT StudyFlow] Setting up event tracking for:', videoId);
  
  // Track previous state for comparison
  let lastTime = 0;
  let lastPlaybackRate = player.playbackRate;
  let pauseStartTime = 0;
  
  // Time update handler (fires frequently)
  const handleTimeUpdate = () => {
    const currentTime = player.currentTime;
    // If the extension itself were seeking/forcing time, we'd see large jumps here.
    // We already emit SEEK/REWIND when diff > 1; keep additional log only when diff is suspicious.

    
    // Detect seeks (jumps in time)
    const timeDiff = Math.abs(currentTime - lastTime);
    if (timeDiff > 1) {
      const isRewind = currentTime < lastTime;
      
      emitEvent({
        type: isRewind ? ANALYTICS_EVENTS.REWIND : ANALYTICS_EVENTS.SEEK,
        videoId,
        timestamp: Date.now(),
        data: {
          from: lastTime,
          to: currentTime,
          diff: currentTime - lastTime,
        },
      });
    }
    
    lastTime = currentTime;
    
    // Broadcast current time for transcript sync
    window.dispatchEvent(new CustomEvent('yt-studyflow-time-update', {
      detail: { currentTime, videoId },
    }));
  };
  
  // Pause handler
  const handlePause = () => {
    pauseStartTime = Date.now();

    // Targeted logs: confirm whether pause is a real player pause (not caused by our own synthetic dispatches)
    console.log('[YT StudyFlow][Playback] pause event fired', {
      videoId,
      currentTime: player.currentTime,
      playbackRate: player.playbackRate,
      paused: player.paused,
      readyState: player.readyState,
    });

    emitEvent({
      type: ANALYTICS_EVENTS.PAUSE,
      videoId,
      timestamp: pauseStartTime,
      data: {
        time: player.currentTime,
      },
    });
  };
  
  // Play handler (to track pause duration)
  const handlePlay = () => {
    console.log('[YT StudyFlow][Playback] play event fired', {
      videoId,
      currentTime: player.currentTime,
      playbackRate: player.playbackRate,
      paused: player.paused,
      readyState: player.readyState,
    });

    if (pauseStartTime > 0) {
      const pauseDuration = Date.now() - pauseStartTime;

      window.dispatchEvent(new CustomEvent('yt-studyflow-pause-duration', {
        detail: { duration: pauseDuration, time: player.currentTime, videoId },
      }));

      pauseStartTime = 0;
    }
  };
  
  // Playback rate change handler
  const handleRateChange = () => {
    const newRate = player.playbackRate;
    
    if (newRate !== lastPlaybackRate) {
      emitEvent({
        type: ANALYTICS_EVENTS.SPEED_CHANGE,
        videoId,
        timestamp: Date.now(),
        data: {
          from: lastPlaybackRate,
          to: newRate,
          time: player.currentTime,
        },
      });
      
      lastPlaybackRate = newRate;
    }
  };
  
  // Attach event listeners
  player.addEventListener('timeupdate', handleTimeUpdate);
  player.addEventListener('pause', handlePause);
  player.addEventListener('play', handlePlay);
  player.addEventListener('ratechange', handleRateChange);
  
  // Store cleanup functions
  const cleanup = () => {
    player.removeEventListener('timeupdate', handleTimeUpdate);
    player.removeEventListener('pause', handlePause);
    player.removeEventListener('play', handlePlay);
    player.removeEventListener('ratechange', handleRateChange);
    console.log('[YT StudyFlow] Event tracking cleaned up');
  };

  // Detach on page unload/nav to avoid leaks
  const handlePageHide = () => cleanup();
  window.addEventListener('beforeunload', handlePageHide);
  window.addEventListener('pagehide', handlePageHide);
  eventListeners.push(() => {
    window.removeEventListener('beforeunload', handlePageHide);
    window.removeEventListener('pagehide', handlePageHide);
  });
  
  eventListeners.push(cleanup);
  
  // Emit video load event
  emitEvent({
    type: ANALYTICS_EVENTS.VIDEO_LOAD,
    videoId,
    timestamp: Date.now(),
    data: {
      duration: player.duration,
    },
  });
  
  return cleanup;
}

/**
 * Emit custom event
 */
function emitEvent(event: VideoEvent): void {
  window.dispatchEvent(new CustomEvent('yt-studyflow-event', {
    detail: event,
  }));
  
  // Also log for debugging
  console.log('[YT StudyFlow Event]', event.type, event.data);
}

/**
 * Cleanup all event listeners
 */
export function cleanupAllEventListeners(): void {
  eventListeners.forEach(cleanup => cleanup());
  eventListeners.length = 0;
}
