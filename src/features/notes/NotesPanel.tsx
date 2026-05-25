import { useEffect, useMemo, useState } from 'react';
import type { Note } from '@/types/notes';
import { getDb } from '@/lib/db';

type Props = {
  videoId: string | null;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/10 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-semibold text-sm">{title}</span>
        <span className="text-xs opacity-70">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="px-3 py-2 text-sm text-white/90">{children}</div> : null}
    </div>
  );
}

function Markdownish({ content }: { content: string }) {
  // Minimal renderer: treat content as markdown-like with paragraphs and bullets.
  // For Phase 3 we keep it dependency-free.
  const lines = content.split(/\r?\n/);
  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        if (!l.trim()) return <div key={i} className="h-1" />;
        if (l.startsWith('# ')) return <div key={i} className="text-base font-bold">{l.replace(/^#\s+/, '')}</div>;
        if (l.startsWith('## ')) return <div key={i} className="text-sm font-bold">{l.replace(/^##\s+/, '')}</div>;
        if (/^[-*]\s+/.test(l)) return <div key={i} className="flex gap-2"> <span className="opacity-70">•</span><span>{l.replace(/^[-*]\s+/, '')}</span></div>;
        return <div key={i} className="leading-relaxed">{l}</div>;
      })}
    </div>
  );
}

export default function NotesPanel({ videoId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!videoId) {
        setNotes([]);
        return;
      }
      setLoading(true);
      try {
        const db = getDb();
        const rows = await db.notes.where('videoId').equals(videoId).sortBy('updatedAt');
        if (cancelled) return;
        setNotes(
            rows.map((r) => ({
            id: r.id.split('|').slice(-1)[0] || r.id,
            videoId: r.videoId,
            type: r.type,
            title: r.title,
            content: r.content,
            format: r.format,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            tags: r.tags,
            isPinned: r.isPinned,
          }))
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const pinned = useMemo(() => notes.filter((n) => n.isPinned), [notes]);
  const rest = useMemo(() => notes.filter((n) => !n.isPinned), [notes]);

  if (!videoId) {
    return (
      <div className="p-4 text-sm text-white/70">Select a video to generate learning notes.</div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-white/10">
        <div className="text-xs uppercase tracking-wider opacity-70">Notes</div>
        <div className="text-sm text-white/80">{loading ? 'Loading…' : `${notes.length} artifacts saved`}</div>
      </div>

      <div className="p-3 overflow-auto space-y-3">
        {loading ? (
          <div className="text-sm text-white/70">Generating/loading notes…</div>
        ) : notes.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            No notes stored yet.
          </div>
        ) : (
          <>
            {pinned.length ? (
              <Section title="Pinned">
                <div className="space-y-3">
                  {pinned.slice(0, 3).map((n) => (
                    <div key={n.id} className="space-y-1">
                      <div className="font-semibold">{n.title}</div>
                      <Markdownish content={n.content} />
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            <div className="space-y-3">
              {rest.slice(0, 10).map((n) => (
                <Section key={n.id} title={`${n.type.toUpperCase()}: ${n.title}`}>
                  <Markdownish content={n.content} />
                </Section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

