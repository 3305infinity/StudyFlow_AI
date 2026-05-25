import { useCallback } from 'react';
import { useChatStore } from '@/features/chat/chat.store';
import type { ChatServiceDeps, ChatSendOptions } from '@/features/chat/chat.service';
import { sendChatMessage } from '@/features/chat/chat.service';

export function useChat() {
  const state = useChatStore();

  const send = useCallback(
    async (deps: ChatServiceDeps, options: ChatSendOptions) => {
      return sendChatMessage(deps, options);
    },
    []
  );

  return {
    ...state,
    send,
  };
}

