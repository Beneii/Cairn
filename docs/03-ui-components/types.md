# TypeScript Types

Complete type definitions and interfaces for CAIRN UI.

**File:** [UI/src/app/components/cairn/types.ts](../../UI/src/app/components/cairn/types.ts)

These types serve as the **contract between UI and future backend services**. All data exchanged will use these interfaces.

## Nucleus Types

```typescript
type NucleusState = "idle" | "thinking" | "tooling" | "waiting" | "error";

interface SubAgent {
  id: string;        // Unique identifier
  name: string;      // Display name ("api_call", "file_read", etc.)
  action: string;    // Current action ("calling", "reading", etc.)
  model: string;     // Model used ("gpt-4o", "gpt-4-turbo", etc.)
}
```

## Chat Types

```typescript
type ChatRole = "user" | "cairn";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: string;
  tools?: string[];              // Tool outputs that can be expanded
}
```

## Notes Types

```typescript
type NoteStatus = "unread" | "read";

interface Note {
  id: string;
  content: string;
  status: NoteStatus;
  timestamp: string;
}
```

## Kanban Types

```typescript
type KanbanStatus = "backlog" | "active" | "blocked" | "done";

interface KanbanCard {
  id: string;
  title: string;
  status: KanbanStatus;
}
```

## Logs Types

```typescript
type LogType = "thought" | "tool" | "file" | "api" | "agent" | "error";

interface LogEntry {
  id: string;
  timestamp: string;
  type: LogType;
  content: string;
}
```

## See Also

- [UI Components Overview](overview.md) — How these types are used
- [Nucleus Component](nucleus.md) — NucleusState usage
- [Chat Component](chat.md) — ChatMessage usage

*Complete types available in [types.ts](../../UI/src/app/components/cairn/types.ts)*
