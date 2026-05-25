import { useMemo } from 'react';

export function useVideo(_videoId: string): { loadVideo: () => Promise<void> } {
  // Phase 1 safe subset: video store may not yet be fully compiled.
  // Returning a safe loader keeps sidebar mounting production-stable.
  const loadVideo = useMemo(() => {
    return async () => {
      // no-op for now
    };
  }, []);

  return { loadVideo };
}

