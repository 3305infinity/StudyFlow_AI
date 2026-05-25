import { getDb, DbIds } from '@/lib/db';
import type { Note } from '@/types/notes';

export type NotesStoreState = {
  // no zustand; keep simple repository abstraction for Phase 3
};

function makeId() {
  return `n_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export async function listNotes(videoId: string): Promise<Note[]> {
  const db = getDb();
  const rows = await db.notes.where('videoId').equals(videoId).sortBy('updatedAt');
  return rows.map((r) => ({
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
  }));
}


export async function getLatestNoteByType(videoId: string, type: Note['type']): Promise<Note | null> {
  const db = getDb();
  const rows = await db.notes.where('videoId').equals(videoId).and(function (this: any) {
    // Dexie where+and requires index; if missing, we filter in memory.
    return true;
  }).toArray();

  const filtered = rows.filter((r) => r.type === type).sort((a, b) => b.updatedAt - a.updatedAt);
  const r = filtered[0];
  if (!r) return null;
  return {
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
  };
}

export async function upsertNote(videoId: string, noteInput: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'videoId'> & { id?: string; createdAt?: number }): Promise<Note> {
  const db = getDb();
  const idPart = noteInput.id ?? makeId();

  const id = DbIds.note(videoId, idPart);
  const t = {
    id,
    videoId,
    type: noteInput.type,
    title: noteInput.title,
    content: noteInput.content,
    format: noteInput.format,
    createdAt: noteInput.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    tags: noteInput.tags,
    isPinned: noteInput.isPinned,
    schemaVersion: 1,
    timestampAnchors: (noteInput as any).timestampAnchors,
  };

  await db.notes.put(t);

  return {
    id: idPart,
    videoId,
    type: noteInput.type,
    title: noteInput.title,
    content: noteInput.content,
    format: noteInput.format,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    tags: t.tags,
    isPinned: t.isPinned,
  };
}

