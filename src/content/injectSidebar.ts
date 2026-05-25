/**
 * Sidebar Injection System (iframe architecture)
 *
 * Architecture:
 * 1. Inject a fixed-position iframe overlay into the YouTube page
 * 2. Mount the React app inside the iframe document
 * 3. Inject styles into the iframe document (Tailwind CSS isolation)
 * 4. Keep SPA navigation cleanup via injection tokens
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

import { Sidebar } from '@/sidebar/Sidebar';
import sidebarStyles from '@/sidebar/sidebar.css?inline';
import contentStyles from './content.css?inline';

const SIDEBAR_ID = 'yt-studyflow-sidebar';
const IFRAME_ID = 'yt-studyflow-iframe';

let reactRoot: ReactDOM.Root | null = null;
let injectionToken = 0;
let activeToken: number | null = null;

function getOrCreateIframe(): HTMLIFrameElement {
  const existing = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
  if (existing) return existing;

  const iframe = document.createElement('iframe');
  iframe.id = IFRAME_ID;

  iframe.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 420px;
    height: 100vh;
    z-index: 9999;
    border: none;
    margin: 0;
    padding: 0;
    background: transparent;

    /* Let the iframe receive focus + keyboard while isolating it from YouTube. */
    pointer-events: auto;
  `;

  // Strong isolation while allowing React/scripts to run.
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

  return iframe;
}

function buildIframeDocument(iframe: HTMLIFrameElement): Document {
  const doc = iframe.contentDocument;
  if (!doc) throw new Error('iframe.contentDocument is null');

  // Ensure a predictable blank document.
  doc.open();
  doc.write(`<!doctype html><html><head></head><body></body></html>`);
  doc.close();

  // Styles (Tailwind base + our sidebar styles)
  const styleEl = doc.createElement('style');
  styleEl.textContent = `
    ${contentStyles}
    ${sidebarStyles}

    /* Tailwind base reset (also scoped inside iframe) */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* Custom scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #1f2937; }
    ::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #6b7280; }
  `;
  doc.head.appendChild(styleEl);

  // Mount container
  const container = doc.createElement('div');
  container.id = SIDEBAR_ID;
  container.style.cssText = `width: 100%; height: 100%;`;
  doc.body.appendChild(container);

  return doc;
}

function adjustYouTubeLayout(addMargin: boolean): void {
  const ytdApp = document.querySelector('ytd-app');
  if (ytdApp instanceof HTMLElement) {
    if (addMargin) {
      ytdApp.style.marginRight = '420px';
      ytdApp.style.transition = 'margin-right 0.3s ease';
    } else {
      ytdApp.style.marginRight = '0';
    }
  }
}

/**
 * Inject sidebar into YouTube page
 */
export function injectSidebar(videoId: string): void {
  const token = ++injectionToken;
  activeToken = token;

  // Hard cleanup of stale iframe
  const stale = document.getElementById(IFRAME_ID);
  if (stale) stale.remove();

  removeSidebar();

  console.log('[YT StudyFlow] Injecting sidebar for video:', videoId);

  const iframe = getOrCreateIframe();
  document.body.appendChild(iframe);

  // Write iframe contents + mount React
  const doc = buildIframeDocument(iframe);

  const container = doc.getElementById(SIDEBAR_ID);
  if (!container) throw new Error('Failed to create sidebar mount container in iframe');

  // Create React root in the iframe document
  reactRoot = ReactDOM.createRoot(container);
  reactRoot.render(React.createElement(Sidebar, { videoId }));

  requestAnimationFrame(() => adjustYouTubeLayout(true));

  console.log('[YT StudyFlow] Sidebar injected (iframe)');
}

/**
 * Remove sidebar from page
 */
export function removeSidebar(): void {
  if (activeToken == null) return;

  const tokenAtCall = activeToken;
  if (tokenAtCall !== activeToken) return;

  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }

  const iframe = document.getElementById(IFRAME_ID);
  if (iframe) iframe.remove();

  activeToken = null;
  adjustYouTubeLayout(false);

  console.log('[YT StudyFlow] Sidebar removed (iframe)');
}

/**
 * Toggle sidebar visibility
 */
export function toggleSidebar(): void {
  const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
  if (!iframe) return;

  const isHidden = iframe.style.display === 'none';
  iframe.style.display = isHidden ? 'block' : 'none';
  adjustYouTubeLayout(!isHidden);
}

