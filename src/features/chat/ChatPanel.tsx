import React, { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, SendHorizontal, Timer, Volume2 } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { SemanticChunk } from '@/types/ai';
import { useChat } from '@/hooks/useChat';
import type { ChatServiceDeps, ChatSendOptions } from './chat.service';

function cx(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

type Props = {
  videoId: string;
  transcriptDeps: {
    transcript: any; // Transcript type is pulled inside service; keep UI decoupled
    semanticChunks: SemanticChunk[];
  };
  onJumpToTime?: (timeSeconds: number) => void;
};

export function ChatPanel({ videoId, transcriptDeps, onJumpToTime }: Props) {
  const { messages, isLoading, error, send, resetConversation } = useChat();

  const [draft, setDraft] = React.useState('');
  const [mode, setMode] = React.useState<'concise' | 'deep' | 'interview' | 'beginner'>('concise');

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // auto scroll
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, isLoading]);

  useEffect(() => {
    // keyboard shortcut: Cmd/Ctrl+K focuses input
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const deps: ChatServiceDeps = useMemo(
    () => ({
      videoId,
      transcript: transcriptDeps.transcript,
      semanticChunks: transcriptDeps.semanticChunks,
    }),
    [videoId, transcriptDeps]
  );

  const citationsForMessage = (m: any) => m?.citations ?? [];

  const onSubmit = async () => {
    const question = draft.trim();
    if (!question || isLoading) return;

    const options: ChatSendOptions = {
      question,
      mode: mode === 'deep' ? 'deep' : mode === 'interview' ? 'interview' : mode === 'beginner' ? 'beginner' : 'concise',
      maxChunks: 8,
      similarityThreshold: 0.25,
    };

    setDraft('');
    await send(deps, options);
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0f14] text-slate-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
            <Bot className="w-4 h-4 text-slate-200" />
          </div>
          <div>
            <div className="font-semibold leading-5">AI Study Chat</div>
            <div className="text-xs text-slate-400">Retrieval-grounded answers with timestamps</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200"
            value={mode}
            onChange={e => setMode(e.target.value as any)}
          >
            <option value="concise">Concise</option>
            <option value="deep">Deep</option>
            <option value="interview">Interview</option>
            <option value="beginner">Beginner</option>
          </select>

          <button
            className="text-xs text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-white/5 border border-white/10"
            onClick={() => {
              resetConversation();
              setDraft('');
              inputRef.current?.focus();
            }}
            type="button"
          >
            Reset
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="text-sm font-medium flex items-center gap-2">
                <Timer className="w-4 h-4 text-slate-300" />
                Ask anything about this video
              </div>
              <div className="text-xs text-slate-400 mt-2 leading-relaxed">
                Questions are answered using retrieved transcript context. Responses include clickable timestamps.
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {['Explain the key idea here', 'What should I remember?', 'Where did they define X?', 'Give me a study plan for this section'].map(
                  (q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDraft(q);
                        inputRef.current?.focus();
                      }}
                      className="text-xs text-slate-200 hover:text-white bg-white/5 border border-white/10 rounded-lg px-3 py-1"
                    >
                      {q}
                    </button>
                  )
                )}
              </div>
            </motion.div>
          ) : null}

          {messages.map(m => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div className={cx('max-w-[88%] rounded-2xl p-3 border', m.role === 'user'
                ? 'bg-white/5 border-white/10'
                : 'bg-white/5 border-white/10')}
              >
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.content}</div>

                {m.isStreaming ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Thinking...
                  </div>
                ) : null}

                {m.role === 'assistant' && citationsForMessage(m).length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {citationsForMessage(m)
                      .filter((c: any) => typeof c?.startTime === 'number')
                      .slice(0, 6)
                      .map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          className="text-xs text-slate-200 hover:text-white bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 flex items-center gap-1"
                          onClick={() => {
                            onJumpToTime?.(c.startTime);
                          }}
                          title="Jump to timestamp"
                        >
                          <Volume2 className="w-3 h-3 text-slate-300" />
                          {formatTime(c.startTime)}
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
      </div>

      <div className="px-4 pb-4">
        <div className="sticky bottom-0">
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onFocus={e => {
                const el = e.currentTarget as any;
                if (!el.__ytStudyFlowIdentity) {
                  el.__ytStudyFlowIdentity = `el_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
                }
                console.log('[YT StudyFlow][ChatInput][focus]', {
                  identity: el.__ytStudyFlowIdentity,
                  tag: el.tagName,
                  id: (el as HTMLElement).id,
                  documentActiveTag: document.activeElement?.tagName,
                  shadowActiveTag: (inputRef.current?.getRootNode() as ShadowRoot | Document | null)?.activeElement?.tagName,
                });
              }}
              onKeyDown={e => {
                const el = e.currentTarget as any;
                if (!el.__ytStudyFlowIdentity) {
                  el.__ytStudyFlowIdentity = `el_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
                }
                console.log('[YT StudyFlow][ChatInput][keydown]', {
                  key: e.key,
                  code: e.code,
                  repeat: e.repeat,
                  identity: el.__ytStudyFlowIdentity,
                  isSameNode: inputRef.current === el,
                  documentActiveTag: document.activeElement?.tagName,
                  shadowActiveTag: (inputRef.current?.getRootNode() as ShadowRoot | Document | null)?.activeElement?.tagName,
                });

                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void onSubmit();
                }
              }}
              className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="Ask about the video... (Ctrl/Cmd + K)"
            />

            <button
              type="button"
              onClick={() => {
                void onSubmit();
              }}
              disabled={isLoading || !draft.trim()}
              className={cx(
                'px-3 py-2 rounded-xl border flex items-center justify-center gap-2',
                isLoading || !draft.trim()
                  ? 'border-white/10 bg-white/5 text-slate-400 cursor-not-allowed'
                  : 'border-white/15 bg-white/10 hover:bg-white/15 text-slate-100'
              )}
            >
              <SendHorizontal className="w-4 h-4" />
              <span className="text-sm font-medium">Send</span>
            </button>
          </div>

          <div className="mt-2 text-[11px] text-slate-500">
            Answers are grounded in retrieved transcript chunks; timestamps are clickable.
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

