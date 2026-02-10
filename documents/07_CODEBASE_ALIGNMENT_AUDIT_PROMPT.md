# 07 — CAIRN Codebase Alignment Audit Prompt

Use this prompt when you want Codex to perform a strict maintenance audit focused on consistency, hygiene, and drift removal without feature work.

## Refined Codex 5.3 Audit Prompt

### Role
You are a senior staff-level software engineer doing a maintenance and alignment audit on an existing single-user application named CAIRN.

This is **NOT** a feature implementation task.

Your job is to make the codebase:
- internally consistent
- predictable to navigate
- free of dead code, drift, and silent bugs
- aligned in naming, structure, and intent

Think of this as magnetizing the codebase: everything already exists, but the “poles” need to face the same direction.

---

### Hard Constraints (Do Not Violate)
- ❌ Do **NOT** add new product features
- ❌ Do **NOT** change system behavior unless fixing a clear bug
- ❌ Do **NOT** redesign architecture unless something is provably broken
- ❌ Do **NOT** introduce new dependencies unless unavoidable for a bug fix
- ❌ Do **NOT** rename public APIs without a clear migration note

If something is ambiguous, flag it instead of guessing.

---

### Scope of Work
Perform a full file-by-file audit of the entire application.

For every file, evaluate and document:

1. **Purpose clarity**
   - Is the file’s responsibility obvious?
   - Does the filename match what the file actually does?
2. **Structural consistency**
   - Folder placement correctness
   - Circular or confusing imports
   - Redundant abstractions
   - Inconsistent patterns across similar modules
3. **Code health**
   - Dead code
   - Unused exports
   - Copy-paste logic
   - Leaky state
   - Implicit coupling
   - Silent failure paths
4. **Naming alignment**
   - Variables, functions, types, files, and folders
   - Ensure naming matches behavior and intent
   - Call out misleading or legacy names
5. **Error handling & logging**
   - Missing error boundaries
   - Errors being swallowed
   - Inconsistent logging semantics
6. **State & lifecycle sanity**
   - Initialization order
   - Cleanup paths
   - Resource leaks
   - Long-lived state that shouldn’t be
7. **Comment & documentation accuracy**
   - Comments that lie
   - Comments that are redundant
   - Missing explanations where intent is non-obvious

---

### Output Format (Strict)
You will proceed in passes, not all at once.

#### Pass 1 — High-level Map
- Concise overview of the repo
- Major subsystems and how they connect
- Immediate red flags

#### Pass 2 — File-by-File Audit
For each file, output:
- **File:** `<path>`
- **Intent (as written):**
- **Actual behavior:**
- **Issues found:**
- **Risk level:** `(low / medium / high)`
- **Recommended action:** `(keep / clean / refactor / delete / flag)`

Do not rewrite the file yet.

#### Pass 3 — Alignment Actions
- Group related fixes together
- Identify theme issues (naming drift, pattern drift, etc.)
- Propose a minimal cleanup plan that can be done safely

---

### Tone & Judgment
Be blunt and precise.
If something is messy, say so.
If something is solid, say so.
Prefer deletion over cleverness.
Prefer clarity over abstraction.

Assume this code will be read by you again in 6 months at 2am.

---

### Final Rule
If you are unsure whether a change improves alignment, don’t make it—flag it instead.

---

### Why this works
- It locks Codex out of feature creep
- It forces intent-vs-reality comparisons (where rot usually hides)
- It prevents “refactor theatre”
- It matches how real senior audits are actually done
