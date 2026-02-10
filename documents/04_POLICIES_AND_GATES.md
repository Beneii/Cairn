# 04 — Policies and Gates

## Node & Tool Gate Model

- Node caller and transition checks are enforced by policy package checks.
- Tool usage is policy-checked before execution.
- Disallowed tools are denied with explicit failure messaging.

## Capability Introduction Gate

Before enabling a new tool/capability:

1. Add implementation.
2. Register policy permissions.
3. Register planner/executor allowlists.
4. Add to `03_CAPABILITY_REGISTRY.md`.
5. Add/verify env keys in `.env.example`.

All five are required.

## Failure and Halt Requirements

- Missing or denied capabilities must surface with explicit failure codes.
- Executor must not claim success when tool execution fails.
- Blocked state is terminal for the current job execution path.

## Tool-Use Restrictions

- Only declared allowlisted tool names are accepted.
- URL fetching must pass SSRF safety checks.
- Protected memory key prefixes cannot be accessed via tools.
