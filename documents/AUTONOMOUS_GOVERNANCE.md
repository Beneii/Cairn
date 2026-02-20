# AUTONOMOUS GOVERNANCE - Cairn Repository

## Routing Strategy
The repository uses a **Tiered Credit-Aware Failover** system.

### Architectural Tiers
- **Tier 1 (Execution Layer):** High-efficiency agents (`antigravity_pro`, `antigravity_flash`). These are prioritized for all autonomous tasks.
- **Tier 2 (Direct Model Layer):** Raw model APIs (`openai`, `claude`). These are used only when Tier 1 is exhausted.

### Cooldown & Recovery
- **Trigger:** Any provider returning a `QUOTA_EXHAUSTED` or `BUDGET_EXCEEDED` error.
- **Duration:** 24-hour persistent cooldown.
- **Selection:** "Sticky" selection—the router remains on the active provider until failure.

## Governance & Safety
### Budget Limits
- Each provider has a daily token budget (default: 1,000,000 tokens).
- Exceeding the budget triggers a 24-hour cooldown.

### Commit Discipline
- **No Direct Main Commits:** All changes must be made on feature branches.
- **Branch Pattern:** `cairn-auto/<task>/<timestamp>`.
- **Pre-Commit Guard:** Commits are blocked if secrets (.env, API keys) are detected in staged changes.
- **Verification:** All commits require passing build and test suites (governed by `scripts/commit.sh`).

## Monitoring
- **Logs:** `logs/provider.log` (switches) and `logs/provider_usage.log` (usage).
- **Status:** Run `claw doctor` for a live report of provider health and budgets.
