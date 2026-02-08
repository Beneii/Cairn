/**
 * Librarian Agent
 *
 * End-of-day task organization agent that:
 * - Runs once per day at a configurable hour (default: 5 PM)
 * - Reviews all "done" cards from the day
 * - Auto-archives them with project categorization
 * - Uses LLM to categorize tasks that don't have a project
 * - Sends summary message to user
 */

import { warmGet, warmSet } from "@cairn/memory";
import { bus, newId, shortTime } from "@cairn/shared";
import { appendEntry } from "@cairn/ledger";
import { isLLMAvailable, callLLM } from "@cairn/orchestrator";
import { getCards, archiveCard, updateCardProject } from "./kanban.js";

const LIBRARIAN_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
const END_OF_DAY_HOUR = 17; // 5 PM - configurable

interface LibrarianState {
  last_run_date: string; // YYYY-MM-DD format
  tasks_archived: number;
  tasks_categorized: number;
}

export function startLibrarianProcessor(): void {
  setInterval(async () => {
    try {
      const now = new Date();
      const currentHour = now.getHours();

      // Only run at end of day hour
      if (currentHour !== END_OF_DAY_HOUR) {
        return;
      }

      // Check if already ran today
      const today = now.toISOString().split("T")[0];
      const libState = warmGet<LibrarianState>("librarian_state");
      if (libState?.last_run_date === today) {
        return; // Already ran today
      }

      // Get done cards that aren't archived yet
      const allCards = getCards();
      const doneCards = allCards.filter(
        (c) => c.status === "done" && !c.archived
      );

      if (doneCards.length === 0) {
        // Nothing to organize, but still mark as ran
        await warmSet("librarian_state", {
          last_run_date: today,
          tasks_archived: 0,
          tasks_categorized: 0,
        });
        return;
      }

      console.log(
        `[librarian] Starting end-of-day organization: ${doneCards.length} tasks`
      );

      await appendEntry(
        "agent",
        "librarian",
        "daily",
        `End-of-day organization started: ${doneCards.length} tasks to process`
      );

      let tasksArchived = 0;
      let tasksCategorized = 0;

      // Categorize tasks without projects (if LLM available)
      const uncategorized = doneCards.filter((c) => !c.project);
      if (uncategorized.length > 0 && isLLMAvailable()) {
        try {
          const taskTitles = uncategorized.map((c) => c.title).join("\n- ");

          const response = await callLLM(
            {
              model: "gpt-4o-mini",
              systemPrompt: `You are a task categorization assistant. Categorize the following tasks into projects.

Available project categories:
- "work" - Work-related tasks
- "personal" - Personal tasks and errands
- "health" - Health, fitness, medical
- "finance" - Money, bills, banking
- "home" - Home maintenance, chores
- "learning" - Education, courses, reading
- "social" - Friends, family, events
- "general" - Everything else

Respond in JSON format:
{
  "categorizations": [
    { "title": "task title here", "project": "category" },
    ...
  ]
}`,
              userMessage: `Categorize these completed tasks:\n- ${taskTitles}`,
              maxTokens: 1000,
              responseFormat: "json_object",
            },
            "librarian",
            "daily"
          );

          const parsed = JSON.parse(response.content);
          if (parsed.categorizations && Array.isArray(parsed.categorizations)) {
            for (const cat of parsed.categorizations) {
              const card = uncategorized.find((c) => c.title === cat.title);
              if (card && cat.project) {
                await updateCardProject(card.id, cat.project);
                tasksCategorized++;
              }
            }
          }
        } catch (err) {
          console.error("[librarian] Categorization error:", err);
        }
      }

      // Archive all done cards
      for (const card of doneCards) {
        await archiveCard(card.id);
        tasksArchived++;
      }

      // Update state
      await warmSet("librarian_state", {
        last_run_date: today,
        tasks_archived: tasksArchived,
        tasks_categorized: tasksCategorized,
      });

      // Send summary to user
      const summaryParts: string[] = [];
      if (tasksArchived > 0) {
        summaryParts.push(`archived ${tasksArchived} completed task${tasksArchived === 1 ? "" : "s"}`);
      }
      if (tasksCategorized > 0) {
        summaryParts.push(`categorized ${tasksCategorized} task${tasksCategorized === 1 ? "" : "s"}`);
      }

      if (summaryParts.length > 0) {
        bus.emit("chat:message", {
          id: newId(),
          role: "cairn",
          text: `End-of-day housekeeping: ${summaryParts.join(" and ")}. Your kanban is tidy for tomorrow!`,
          timestamp: shortTime(),
        });
      }

      await appendEntry(
        "agent",
        "librarian",
        "daily",
        `Organization complete: ${tasksArchived} archived, ${tasksCategorized} categorized`
      );

      console.log(
        `[librarian] Organization complete: ${tasksArchived} archived, ${tasksCategorized} categorized`
      );
    } catch (err) {
      console.error("[librarian] Error in organization processor:", err);
    }
  }, LIBRARIAN_CHECK_INTERVAL_MS);

  console.log(
    `[librarian] Librarian processor started (runs at ${END_OF_DAY_HOUR}:00)`
  );
}
