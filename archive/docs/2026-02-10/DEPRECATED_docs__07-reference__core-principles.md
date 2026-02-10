# Core Principles

Deep dive into CAIRN's five foundational principles. These are non-negotiable.

---

## Principle 1: UI is Truth

### The Principle

**If a behavior, state, or process cannot be represented in the UI (logs, animations, state, costs), it must not exist.**

### What This Means

1. **Transparency** — All system state is visible somewhere
2. **No hidden work** — There is no background processing that isn't logged
3. **Direct representation** — States have visual representations
4. **No implicit behavior** — Everything explicit, nothing inferred

### Examples

#### ✅ Following the Principle

- **Tool execution** — Shows in logs + Nucleus animates to "tooling"
- **Agent thinking** — Nucleus shows "thinking" state with orbital motion
- **Error** — Nucleus shows "error" state with jitter + Error logged in Logs panel
- **Cost** — Every API call logs cost in Ledger (visible in UI)
- **Task waiting** — Nucleus shows "waiting" state, Kanban shows task as "blocked"

#### ❌ Violating the Principle

- Agent does thinking process but doesn't update state
- Tool fails silently without logging
- Memory updated without UI indication
- Cost incurred without showing it
- Background job completes without any record

### Why It Matters

Complete visibility prevents:
- Silent failures
- Wasted resources
- Difficult debugging
- User confusion
- Security issues

### Implementation in CAIRN

**Nucleus Component** — The primary truth indicator

| State | Animation | What's Happening |
|-------|-----------|------------------|
| Idle | Gentle drift | System ready |
| Thinking | Fast spin | Planning/reasoning |
| Tooling | Expansion, budding | Executing tools |
| Waiting | Frozen | Blocked on external input |
| Error | Jitter | Something failed |

The Nucleus is always truthful. If you see it idle, it IS idle. If you see it thinking, it IS thinking.

**Logs Component** — The detailed truth ledger

Every meaningful action produces a log:
- Tool calls (with inputs/outputs)
- State transitions
- Costs
- Errors
- Permission checks
- Agent actions

---

## Principle 2: System > Agent

### The Principle

**Agents are constrained workers. The system owns state, memory, permissions, and security.**

### What This Means

1. **Central authority** — System makes all final decisions
2. **Agent constraints** — Each agent has explicit limits
3. **No agent autonomy** — Agents execute instructions, don't choose their own path
4. **System oversight** — All agent actions are monitored and logged

### Hierarchy

```
System (owns everything)
  ├── Gateway (fast path)
  ├── Orchestrator (graph engine)
  ├── Memory (state storage)
  ├── Ledger (audit trail)
  ├── Scheduler (time awareness)
  └── Executor (constrained tool runner)
        └── Agents (workers)
```

Agents exist **within** the system, not alongside it.

### Examples

#### ✅ Following the Principle

- **Policy immutability** — Agent cannot modify its own permissions
- **Orchestrator enforces** — Only declared graph transitions occur
- **Tool allowlists** — Each agent has specific tools it can use
- **Memory tiers** — Agents cannot write to cold memory
- **Ledger control** — System writes audit trail, agents cannot delete

#### ❌ Violating the Principle

- Agent modifies its own policy file
- Agent creates a new tool not in the system
- Agent escalates beyond its declared permissions
- Agent deletes audit logs
- Agent modifies warm/cold memory directly

### Why It Matters

Agent containment prevents:
- Rogue agents
- Permission escalation
- Audit trail tampering
- Uncontrolled behavior
- Security breaches

### Implementation in CAIRN

**Orchestrator Node Configuration** — The permission boundary

```typescript
const nodes = {
  executor: {
    // What other nodes can call this
    allowed_callers: ["planner", "security_auditor"],

    // What tools it can use
    allowed_tools: ["shell", "file_read", "api_call"],

    // What memory it can access
    memory_access: ["hot", "warm"],
    memory_write: ["hot"],

    // Resource limits
    max_runtime_seconds: 300,
    max_tokens_per_call: 10000,

    // Which model to use
    assigned_model: "gpt-4o"
  }
};
```

If an agent tries to:
- Call a forbidden node → Hard fail
- Execute an unlisted tool → Hard fail
- Write to cold memory → Hard fail
- Exceed runtime limit → Killed and logged

---

## Principle 3: No Invisible Work

### The Principle

**Every meaningful action produces:**
- **A log entry**, or
- **A job state change**, or
- **A cost delta**, or
- **A visible animation/state change**

### What This Means

1. **Everything is recorded** — No action without a trace
2. **Costs are transparent** — Every resource use is visible
3. **State changes are explicit** — System always shows what changed
4. **Visibility is verification** — If you can see it, it happened; if you can't, it didn't

### Examples

#### ✅ Following the Principle

- **Agent queries API** → Logged with input/output/cost
- **Task moves to blocked** → Kanban updates, Logs show change
- **Tool fails** → Error logged with details, Nucleus shows error state
- **Model choice** → Ledger records which model used
- **Memory promotion** → Warm → Cold logged with details

#### ❌ Violating the Principle

- Agent queries API silently (no log)
- Task state changes without updating Kanban
- Computation happens without cost tracking
- Error occurs but isn't recorded
- Tool executes without showing inputs/outputs

### Why It Matters

Invisible work causes:
- Debuggability problems
- Cost surprises
- State confusion
- Difficult auditing
- Security gaps

### Implementation in CAIRN

**Logs Component** — The visibility mechanism

Every action type has a log entry:

| Type | Example | Contains |
|------|---------|----------|
| **thought** | "Planning approach" | Agent reasoning |
| **tool** | "API call to weather service" | Tool name, status |
| **file** | "Reading config.json" | File operation details |
| **api** | "OpenAI API request" | Tokens, cost, model |
| **agent** | "Executor started job" | Agent state change |
| **error** | "Rate limit exceeded" | Error type, context |

Everything is logged. If it happened, it's in the logs.

---

## Principle 4: Six Services Only

### The Principle

**Adding a seventh service without explicit revision of this document is a design failure.**

### What This Means

1. **Strict architecture** — Exactly these six services, no more
2. **No hidden services** — No background processes
3. **Discipline** — All functionality fits within six services
4. **Simplicity** — More services = more complexity

### The Six

1. **Gateway** — Input, intent classification
2. **Orchestrator** — Graph execution, permissions
3. **Executor** — Tool execution
4. **Memory** — Three-tier storage
5. **Ledger** — Audit trail
6. **Scheduler** — Heartbeat, background jobs

### Examples

#### ✅ Following the Principle

- **New feature** — "Authentication" → Fits in Orchestrator (permission system)
- **New capability** — "Web scraping" → Fits in Executor (new tool)
- **New data** → "User preferences" → Fits in Memory (warm tier)

#### ❌ Violating the Principle

- Add "Authentication Service"
- Add "Notification Service"
- Add "Analytics Service"
- Add "Caching Service"

If you need a seventh service, you haven't thought hard enough about how to fit it in the six.

### Why It Matters

Keeping to six services ensures:
- Conceptual clarity
- Design discipline
- Easier reasoning about the system
- Reduced coupling
- Simpler deployment

### Implementation in CAIRN

**File Structure** — Enforces service boundaries

```
cairn/
  apps/
    gateway/           # Service 1
    dashboard/         # UI
  packages/
    orchestrator/      # Service 2
    nodes/            # Orchestrator configuration
    executor/         # Service 3
    memory/           # Service 4
    ledger/           # Service 5
    scheduler/        # Service 6
    policy/           # Policy files (not a service)
    shared/           # Shared utilities (not a service)
```

If you think you need a 7th package, you're probably adding configuration/utilities to an existing service.

---

## Principle 5: No Self-Modifying Policy

### The Principle

**The system may read its identity and policy. It may never rewrite them.**

### What This Means

1. **Read-only policy** — Agents can read how they're configured
2. **Immutable constraints** — Agents cannot change their own limits
3. **System preservation** — Policy files cannot be modified by agents
4. **Trust through immutability** — Policies are guaranteed not to change

### What Agents Can Read

```typescript
// Agents CAN read:
const my_allowed_tools = policy.read("CAPABILITIES.md");
const my_permissions = policy.read("POLICY.md");
const my_purpose = policy.read("SOUL.md");
```

### What Agents Cannot Do

```typescript
// Agents CANNOT:
policy.write("CAPABILITIES.md", newCapabilities);  // ❌ Hard fail
policy.modify("POLICY.md", loosen_constraints);    // ❌ Hard fail
policy.delete("IDENTITY.md");                      // ❌ Hard fail
```

### Examples

#### ✅ Following the Principle

- **Agent reads its tools** — "I can use: api_call, file_read, no shell"
- **Agent reads its permissions** — "I can be called by planner only"
- **Agent respects limits** — "I have 300 second timeout, I must complete by then"
- **Policies unchanged** — Same policy at start and end of execution

#### ❌ Violating the Principle

- **Agent adds tool** — "I'll modify CAPABILITIES to add shell access"
- **Agent escalates** — "I'll change POLICY to allow more memory access"
- **Agent extends time** — "I'll rewrite my timeout limit"
- **Agent corrupts policy** — "I'll delete IDENTITY.md"

### Why It Matters

Policy immutability ensures:
- **Trust** — Policies are guaranteed not to change at runtime
- **Security** — Agents cannot escalate themselves
- **Auditability** — Policy changes are explicit and tracked
- **Predictability** — Agent behavior is bounded and knowable

### Implementation in CAIRN

**Policy Files** (immutable at runtime)

```
cairn/
  configs/
    SOUL.md         # Immutable: values, tone, purpose
    IDENTITY.md     # Immutable: ownership, access
    POLICY.md       # Immutable: hard safety rules
    CAPABILITIES.md # Immutable: tools and tiers
```

**Orchestrator Check** (runtime enforcement)

```typescript
// Before task execution
const policy = loadPolicy();
const nodeConfig = policy.readNodeConfig("executor");
const allowedTools = nodeConfig.allowed_tools;

// During execution
if (!allowedTools.includes(requestedTool)) {
  // Hard fail
  throw new SecurityError("Tool not in allowlist");
  // log to ledger
  // update UI to error state
}

// After execution
const policyAfter = loadPolicy();
assert(policy === policyAfter);  // Must be identical
```

---

## Principles in Tension

### System > Agent vs. No Invisible Work

These sometimes conflict:

**Conflict:** Agent needs to do internal reasoning (invisible work)

**Resolution:**
- Agent does reasoning inside Executor (hidden)
- But Executor logs the reasoning ("thought" type)
- Results are visible in Logs

### UI is Truth vs. Performance

**Conflict:** Logging everything would be slow

**Resolution:**
- Log strategically (important actions, not every cycle)
- Use asynchronous logging (doesn't block execution)
- Aggregate related actions in single log entry
- UI still shows comprehensive view

### Six Services Only vs. Scaling

**Conflict:** More services make scaling easier

**Resolution:**
- Six services can scale horizontally
- Each service can have multiple instances
- Services stay independent through defined interfaces
- Simplicity > Scalability

---

## Applying the Principles

When designing a feature:

1. **Can it be shown in UI?** (Principle 1: UI is Truth)
2. **Who controls it — system or agent?** (Principle 2: System > Agent)
3. **Is it logged/visible?** (Principle 3: No Invisible Work)
4. **Does it fit in the six services?** (Principle 4: Six Services Only)
5. **Can agents modify their own constraints?** (Principle 5: No Self-Modifying)

If you can answer yes/correctly to all five, the feature aligns with CAIRN's principles.

---

## See Also

- [Architecture Overview](../02-architecture/overview.md) — How principles are applied
- [truth.md](../../truth.md) — Authoritative specification
- [UI Components](../03-ui-components/overview.md) — UI visualization of principles
