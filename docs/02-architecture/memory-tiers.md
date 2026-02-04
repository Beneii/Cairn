# Memory Tiers

Understanding CAIRN's three-tier memory system.

## Overview

From [truth.md](../../truth.md):

CAIRN uses three distinct memory tiers to preserve context without contamination:

- **Hot Memory** — Volatile, current session
- **Warm Memory** — Curated, semi-persistent
- **Cold Memory** — RAG-based, long-term storage

Each tier serves a different purpose and has different access rules.

---

## Hot Memory (Volatile)

### Purpose

Current working context for the active task.

### Contents

- Active conversation thread
- Current task context
- Working plans
- Temporary calculations

### Duration

- Automatically expires (short TTL)
- Cleared at task completion
- Not persisted to disk

### Access

- **Read** — All agents
- **Write** — Active executor + Scheduler
- **Tier** — No special restrictions

### Example

```
Hot Memory for Job #12:

User: "Find me the cheapest flights to NYC next week"

Current Task: Research flights
  - Budget: under $300
  - Dates: Dec 15-20
  - Airports: Any SF area

Active Step: Searching flight sites
  - Skyscanner: Not checked yet
  - Google Flights: Checked (found $275)
  - Kayak: In progress

Cost so far: 0.03 credits
```

### Characteristics

- **Temporary** — Expires after task completion or timeout
- **Fast** — In-memory access
- **Limited** — Doesn't grow without bound
- **Accessible** — All agents can read

---

## Warm Memory (Curated)

### Purpose

Important, human-curated summaries and preferences that persist across sessions.

### Contents

- Task summaries
- User preferences
- Important recent events
- Stable configuration

### Duration

- Persists across sessions
- Curated by Scheduler or manual intervention
- Indefinite lifetime (until modified)

### Access

- **Read** — All agents
- **Write** — Scheduler + Ledger (curator only)
- **Tier** — Curated access only

### Format

Structured JSON + short text:

```json
{
  "user_preferences": {
    "timezone": "US/Pacific",
    "currency": "USD",
    "language": "English",
    "communication_style": "brief"
  },
  "recent_tasks": [
    {
      "date": "2024-12-10",
      "task": "Flight research",
      "summary": "Found flights under $300 to NYC",
      "status": "completed"
    }
  ],
  "important_notes": [
    {
      "topic": "Team meeting",
      "reminder": "Every Monday 10am PST",
      "contact": "team@example.com"
    }
  ]
}
```

### Curator Process

The Scheduler acts as a curator:

1. **Read** warm memory
2. **Evaluate** what's worth keeping
3. **Promote** good summaries to cold memory (RAG)
4. **Clean** warm memory (remove expired items)
5. **Update** preferences from user input

### Characteristics

- **Curated** — Manually reviewed, important items only
- **Persistent** — Survives task completion
- **Limited** — Not unlimited growth
- **Readable** — Human and machine readable

---

## Cold Memory (RAG)

### Purpose

Long-term storage with semantic search capabilities.

### Contents

- Historical documents
- System logs
- Important summaries
- Knowledge base entries
- Archived conversations

### Duration

- Indefinite
- Searchable history
- Can be queried via RAG

### Access

- **Read** — All agents (via retrieval only)
- **Write** — Curator only (Scheduler)
- **Tier** — Read-only for agents

### Storage

- Vector embeddings (semantic search)
- Metadata for filtering
- Original text for reference

### Example Query

```
Agent: "What was the best restaurant we tried last month?"

Cold Memory Search:
  - Query: "restaurant recommendation"
  - Vector search returns: [3 results]
  - Result 1: "Tried Casa Verde on Dec 2. Outstanding pasta."
  - Result 2: "Reservation at The Grill Dec 8. Excellent steaks."
  - Result 3: "Food truck on Dec 15. Good tacos."

Agent returns: "Casa Verde and The Grill were both excellent."
```

### Characteristics

- **Long-term** — Indefinite storage
- **Queryable** — Semantic search via vectors
- **Read-only** — Agents cannot write
- **Retrievable** — Not all data is visible, only relevant results

---

## Memory Promotion Rules

From [truth.md](../../truth.md):

```
Brain writes → hot / warm
Curator summarizes warm
Promotion job writes → cold

No exceptions.
```

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Flow                                 │
└─────────────────────────────────────────────────────────────┘

1. EXECUTION PHASE
   ┌──────────────┐
   │   Agent      │ Generates output, decisions, findings
   └──────┬───────┘
          │ writes to
          ▼
   ┌──────────────┐
   │ Hot Memory   │ Current context (volatile)
   └──────┬───────┘
          │ task completes
          │
2. CURATION PHASE
          │
          ▼
   ┌──────────────────────────┐
   │  Scheduler (Curator)     │ Evaluates what's important
   └──────┬───────────────────┘
          │ summarizes important items
          │
3. WARM MEMORY PHASE
          │
          ▼
   ┌──────────────┐
   │ Warm Memory  │ Curated summaries (persistent)
   └──────┬───────┘
          │ promotion job runs
          │
4. COLD STORAGE PHASE
          │
          ▼
   ┌──────────────┐
   │ Cold Memory  │ Vector embeddings + RAG (long-term)
   └──────────────┘
```

### Key Rule

**Agents never write directly to cold memory.**

Only the Curator (Scheduler) can promote from warm → cold. This ensures:
- Quality control (only good summaries stored)
- Security (malicious agents cannot pollute knowledge base)
- Consistency (structured promotion process)

---

## Memory Access Patterns

### Read-Only Access (All Agents)

Agents can **read** from any tier:

```typescript
// Agent can retrieve relevant context
const context = memory.read("warm", "user_preferences");
const history = memory.search("cold", "similar_projects");
```

### Write Access (Restricted)

Only specific agents can write:

```typescript
// Hot memory writes (allowed during execution)
executor.write("hot", "current_step", { status: "analyzing" });

// Warm memory writes (curator only)
scheduler.write("warm", "task_summary", summary);

// Cold memory writes (curator only)
scheduler.promote("warm_to_cold", summary);
```

### Agent Constraints

The Orchestrator enforces these rules via node configuration:

```typescript
const nodes = {
  executor: {
    allowed_callers: ["planner"],
    memory_access: ["hot", "warm"],  // Can read hot and warm
    memory_write: ["hot"]             // Can write to hot only
  },
  scheduler: {
    allowed_callers: ["system"],
    memory_access: ["hot", "warm", "cold"],  // Can read all
    memory_write: ["warm", "cold"]           // Can write to warm, cold
  }
};
```

---

## Practical Examples

### Example 1: Research Task

```
STEP 1: User Input
  Input: "Research Python 3.13 features"

STEP 2: Hot Memory (During Execution)
  - Current query: Python 3.13 features
  - Findings so far: [list of discovered features]
  - Cost: $0.02
  - Status: In progress

STEP 3: Task Completion
  - Task complete at 14:32
  - Hot memory auto-expires

STEP 4: Curator Review (Next heartbeat)
  - Scheduler evaluates findings
  - Creates summary: "Python 3.13: Pattern matching, typing improvements"

STEP 5: Warm Memory
  - Summary added to "tech_research" summaries
  - Retained for future reference

STEP 6: Long-term (Next month)
  - Promote important summaries to cold memory
  - Now searchable as: "What Python features did we research?"
```

### Example 2: User Preferences

```
STEP 1: User Sets Preference
  "I prefer brief responses in a professional tone"

STEP 2: Hot Memory (during current session)
  - Preference known to current agent
  - Guides response style

STEP 3: Warm Memory (persistent)
  - Preference saved: tone: "professional", style: "brief"
  - Survives session end

STEP 4: Future Sessions
  - Warm memory loaded automatically
  - All agents know to be professional and brief
  - No need to repeat preference
```

### Example 3: Failed Task

```
STEP 1: Task Starts
  "Calculate quarterly report"
  Context in hot memory

STEP 2: Task Fails
  "API rate limit exceeded"
  Hot memory auto-expires (doesn't clutter system)

STEP 3: No Pollution
  - Cold memory unchanged
  - Warm memory unchanged
  - Only error logged in Ledger
  - Clean state for next attempt
```

---

## Memory vs. Ledger

Important distinction:

| Aspect | Memory | Ledger |
|--------|--------|--------|
| **Purpose** | Context for decisions | Audit trail |
| **Content** | Current context, summaries | All events, immutable |
| **Access** | Agents read; curator writes | Append-only, no deletes |
| **Growth** | Limited (tiers overflow) | Unlimited (complete history) |
| **Query** | By relevance (RAG) | By time, by type |

---

## Best Practices

### ✅ Do

- **Use hot memory** for temporary work
- **Promote summaries** to warm memory for persistence
- **Search cold memory** for historical context
- **Let hot expire** naturally (don't try to preserve)
- **Curator reviews** before promoting to cold

### ❌ Don't

- **Write to cold memory** as an agent (curator only)
- **Assume hot persists** across sessions
- **Overflow warm memory** with unreviewed data
- **Query cold memory** for current context (use hot/warm)
- **Store raw conversations** in cold (store summaries)

---

## Implementation Notes

### Current State

- ✅ Hot memory concept (UI shows current context)
- 🚧 Warm memory (structure defined, implementation pending)
- 🚧 Cold memory + RAG (planned for Phase 2)

### Future Expansion

- Vector database for cold memory search
- Curator process automation
- Warm memory overflow handling
- Archival policies for old data

---

## See Also

- [Architecture Overview](overview.md) — System design
- [Core Principles](../07-reference/core-principles.md) — Foundational concepts
- [Ledger](../02-architecture/ledger.md) — Audit trail (different from memory)
