/**
 * Content Script Entry Point
 * 
 * This script runs on YouTube watch pages and:
 * 1. Detects when a video is loaded
 * 2. Injects the sidebar
 * 3. Sets up YouTube event tracking
 * 
 * Architecture Decision:
 * - Use MutationObserver to detect YouTube's SPA navigation
 * - Inject sidebar only once per video
 * - Clean up on navigation
 */

import { injectSidebar, removeSidebar } from './injectSidebar';

import { setupYouTubeEventTracking } from './youtubeEvents';
import { isYouTubeWatchPage, getCurrentVideoId } from '@lib/youtube';

let currentVideoId: string | null = null;
let cleanupFn: (() => void) | null = null;

let initTimer: number | null = null;

function initialize() {
  if (!isYouTubeWatchPage()) return;

  if (initTimer) window.clearTimeout(initTimer);

  initTimer = window.setTimeout(() => {
    const videoId = getCurrentVideoId();
    if (!videoId || videoId === currentVideoId) return;

    console.log('[YT StudyFlow] New video detected:', videoId);

    // Cleanup previous instance
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = null;
    }
    removeSidebar();

    // Inject sidebar
    injectSidebar(videoId);

    // Setup event tracking
    cleanupFn = setupYouTubeEventTracking(videoId);

    currentVideoId = videoId;
  }, 500);
}

/**
 * Watch for YouTube SPA navigation
 * YouTube doesn't reload the page when navigating between videos.
 */
function watchForNavigation() {
  // Initial load
  initialize();

  // Watch for actual URL changes (YouTube SPA navigation).
  // IMPORTANT: avoid reacting to unrelated DOM mutations (typing in sidebar, shadow DOM updates, etc.).
  const getUrlKey = () => location.pathname + location.search + location.hash;
  let lastUrlKey = getUrlKey();

  // Only observe attributes/URL-related changes; no subtree typing mutations.
  const observer = new MutationObserver(() => {
    const currentUrlKey = getUrlKey();
    if (currentUrlKey === lastUrlKey) return;

    // Ignore if the only reason changed is our own sidebar inject/remove.
    // (We still validate via URL key above.)
    lastUrlKey = currentUrlKey;
    console.log('[YT StudyFlow] Navigation detected (url key changed)');
    initialize();
  });


  // Focus model instrumentation for iframe (no keyboard interception)
  const IFRAME_ID = 'yt-studyflow-iframe';
  const getIframeDoc = (): Document | null => {
    const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
    return iframe?.contentDocument ?? null;
  };

  const getIframeInputIdentity = (doc: Document | null): { found: boolean; identity: string | null } => {
    if (!doc) return { found: false, identity: null };
    const input = doc.querySelector('input, textarea, [contenteditable="true"]') as any;
    if (!input) return { found: false, identity: null };
    const anyInput = input as any;
    if (!anyInput.__ytStudyFlowIdentity) {
      anyInput.__ytStudyFlowIdentity = `el_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    }
    return { found: true, identity: anyInput.__ytStudyFlowIdentity as string };
  };

  const logFocusOwnership = (phase: string, extra?: Record<string, any>) => {
    const iframeDoc = getIframeDoc();
    const iframeActive = iframeDoc?.activeElement as HTMLElement | null;
    const { found, identity } = getIframeInputIdentity(iframeDoc);

    console.log('[YT StudyFlow][FocusModel]', phase, {
      topDocActive: (document.activeElement as HTMLElement | null)?.tagName ?? null,
      iframeActive: iframeActive ? { tag: iframeActive.tagName, id: iframeActive.id } : null,
      iframeInputFound: found,
      iframeInputIdentity: identity,
      ...extra,
    });
  };

  document.addEventListener(
    'focusin',
    (e) => {
      logFocusOwnership('focusin', { targetTag: (e.target as HTMLElement | null)?.tagName });
    },
    true
  );

  document.addEventListener(
    'focusout',
    (e) => {
      const related = (e as FocusEvent).relatedTarget as HTMLElement | null;
      logFocusOwnership('focusout', {
        fromTag: (e.target as HTMLElement | null)?.tagName,
        relatedTag: related?.tagName,
      });
    },
    true
  );

  window.addEventListener(
    'keydown',
    (e) => {
      // No preventDefault/stopPropagation. Only log.
      logFocusOwnership('keydown', { key: e.key, code: e.code, repeat: e.repeat });
    },
    true
  );

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also listen to popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    initialize();
  });

  // Listen to YouTube's custom navigation events
  window.addEventListener('yt-navigate-finish', () => {
    initialize();
  });
}

// Start watching
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', watchForNavigation);
} else {
  watchForNavigation();
}

console.log('[YT StudyFlow] Content script loaded');

