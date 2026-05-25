import { useEffect } from 'react';

import { SidebarLayout } from './SidebarLayout';
import { useVideo } from '@/hooks/useVideo';
import { useTranscript } from '@/hooks/useTranscript';

export interface SidebarProps {
  videoId: string;
}

export function Sidebar({ videoId }: SidebarProps): JSX.Element {
  const { loadVideo } = useVideo(videoId);
  const { loadTranscript } = useTranscript(videoId);

  useEffect(() => {
    loadVideo().catch(() => {
      // handled by stores/UI
    });
    loadTranscript().catch(() => {
      // handled by stores/UI
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return <SidebarLayout />;
}

