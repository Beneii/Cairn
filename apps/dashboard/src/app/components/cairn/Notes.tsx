import { useState } from "react";
import { Note } from "./types";
import { clsx } from "clsx";
import { RefreshCcw } from "lucide-react";

interface NotesProps {
  notes: Note[];
  onResurface: (id: string) => void;
  onCreateNote?: (content: string) => void;
  className?: string;
}

export function Notes({ notes, onResurface, onCreateNote, className }: NotesProps) {
  return (
    <div className={clsx("flex flex-col h-full p-4 border-r border-[#1A1D21]/10", className)}>
      <h3 className="text-xs uppercase tracking-widest font-bold mb-4 opacity-40">Inbox / Notes</h3>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {notes.map((note) => (
          <div
            key={note.id}
            className={clsx(
              "group relative p-3 border border-[#1A1D21]/10 transition-all duration-500",
              note.status === "read" ? "opacity-30 hover:opacity-100" : "opacity-100 bg-white/50"
            )}
          >
            <div className="text-sm font-medium leading-snug mb-2">
              {note.content}
            </div>
            <div className="flex justify-between items-center text-[10px] opacity-50 uppercase tracking-wide">
              <span>{note.timestamp}</span>
              <span>{note.status}</span>
            </div>

            {note.status === "read" && (
              <button
                onClick={() => onResurface(note.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[#1A1D21]/10 rounded"
                title="Resurface"
              >
                <RefreshCcw size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <NoteInput onCreateNote={onCreateNote} />
    </div>
  );
}

function NoteInput({ onCreateNote }: { onCreateNote?: (content: string) => void }) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && onCreateNote) {
      onCreateNote(trimmed);
      setValue("");
    }
  };

  return (
    <div className="mt-4 pt-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="w-full h-20 bg-transparent resize-none outline-none text-sm placeholder:opacity-30 border-t border-[#1A1D21]/10 pt-2"
        placeholder="Write a note... (Enter to send)"
      />
    </div>
  );
}
