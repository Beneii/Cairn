import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { Note } from "@cairn/shared";
import { newId, shortTime, bus, getDataPath } from "@cairn/shared";

const DATA_DIR = getDataPath("notes");
const NOTES_FILE = join(DATA_DIR, "notes.json");

let notes: Note[] = [];

export async function initNotes(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  if (existsSync(NOTES_FILE)) {
    const raw = await readFile(NOTES_FILE, "utf-8");
    notes = JSON.parse(raw);
  }
}

export function getNotes(): Note[] {
  return [...notes];
}

export async function createNote(content: string): Promise<Note> {
  const note: Note = {
    id: newId(),
    content,
    status: "unread",
    timestamp: shortTime(),
  };
  notes.unshift(note);
  await persist();
  bus.emit("note:updated", getNotes());
  return note;
}

export async function markNoteRead(id: string): Promise<void> {
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.status = "read";
    await persist();
    bus.emit("note:updated", getNotes());
  }
}

export async function resurfaceNote(id: string): Promise<void> {
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.status = "unread";
    await persist();
    bus.emit("note:updated", getNotes());
  }
}

async function persist(): Promise<void> {
  await writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
}
