

import { useMemo } from 'react';

import { useVideo } from '@/hooks/useVideo';
import { TranscriptPanel } from '@/features/transcript/TranscriptPanel';
import { getYouTubePlayer } from '@/lib/youtube';

export function SidebarLayout(): JSX.Element {
  // SidebarLayout doesn’t currently receive videoId; keep it minimal for Phase 1.
  // If videoId changes upstream, useVideo/transcript hooks should handle it.
  // Phase 1: sidebar does not require videoId directly.
  // Keeping hook call minimal avoids mismatched signatures.
  // Phase 1: sidebar does not require videoId directly.
  // We keep the hook call minimal to avoid wiring for missing video-store plumbing.
  useVideo('');

  const onJumpToTime = useMemo(() => {
    return (seconds: number) => {
      const player = getYouTubePlayer();
      if (!player) return;
      try {
        // Instrument every direct playback mutation from sidebar.
        console.log('[YT StudyFlow][PlaybackMutation][SidebarLayout] set currentTime', {
          seconds,
          currentTimeBefore: player.currentTime,
          playbackRate: player.playbackRate,
          paused: player.paused,
          stack: new Error().stack,
        });

        player.currentTime = seconds;

        console.log('[YT StudyFlow][PlaybackMutation][SidebarLayout] currentTime set', {
          seconds,
          currentTimeAfter: player.currentTime,
        });
      } catch (err) {
        console.log('[YT StudyFlow][PlaybackMutation][SidebarLayout] failed to set currentTime', {
          seconds,
          error: err,
          stack: new Error().stack,
        });
      }

    };
  }, []);


  return (
    <div className="h-full w-full bg-[#0b1220] text-white">
      <TranscriptPanel onJumpToTime={onJumpToTime} />
    </div>
  );
}


