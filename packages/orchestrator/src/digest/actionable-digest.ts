import { now } from "@cairn/shared";
import type { ActionableDigest, ActionableDigestItem, ActionableExtractor } from "@cairn/shared";

const DEADLINE_PATTERNS = [
  /\b(due|deadline|submit by)\s+(\d{4}-\d{2}-\d{2})\b/gi,
  /\b(by|before)\s+([A-Z][a-z]{2,8}\s+\d{1,2}(?:,\s*\d{4})?)\b/g,
];

const TASK_PATTERNS = [
  /\b(todo|task|action item|follow up)\b[:\-]?\s*(.+)$/gim,
  /^[-*]\s+\[\s?\]\s+(.+)$/gim,
];

function extractDeadlines(text: string): string[] {
  const out: string[] = [];
  for (const pattern of DEADLINE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = (match[2] || "").trim();
      if (value) out.push(value);
    }
  }
  return out;
}

function extractTasks(text: string): string[] {
  const out: string[] = [];
  for (const pattern of TASK_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = (match[2] || match[1] || "").trim();
      if (value) out.push(value);
    }
  }
  return out;
}

export const universityAdminExtractor: ActionableExtractor<string> = {
  id: "uni-admin-v1",
  description: "Extracts explicit tasks and deadlines from university/admin text streams.",
  async extract(input: string): Promise<ActionableDigestItem[]> {
    const deadlines = extractDeadlines(input);
    const tasks = extractTasks(input);

    const taskItems = tasks.slice(0, 10).map((task, idx) => ({
      source: "admin" as const,
      title: `Action ${idx + 1}`,
      summary: task,
      dueAt: deadlines[idx],
      priority: deadlines[idx] ? "high" as const : "medium" as const,
      confidence: deadlines[idx] ? 0.86 : 0.72,
      tags: ["digest", "task-extracted"],
    }));

    const standaloneDeadlines = deadlines
      .filter((d) => !taskItems.some((item) => item.dueAt === d))
      .slice(0, 10)
      .map((dueAt, idx) => ({
        source: "university" as const,
        title: `Deadline ${idx + 1}`,
        summary: `Detected deadline: ${dueAt}`,
        dueAt,
        priority: "high" as const,
        confidence: 0.68,
        tags: ["digest", "deadline"],
      }));

    return [...taskItems, ...standaloneDeadlines];
  },
};

export async function buildActionableDigest(
  inputs: string[],
  extractors: ActionableExtractor<string>[] = [universityAdminExtractor],
): Promise<ActionableDigest> {
  const allItems: ActionableDigestItem[] = [];

  for (const input of inputs) {
    for (const extractor of extractors) {
      const items = await extractor.extract(input);
      allItems.push(...items);
    }
  }

  const deduped = Array.from(new Map(allItems.map((item) => [`${item.title}|${item.summary}|${item.dueAt || ""}`, item])).values());
  const sorted = deduped.sort((a, b) => (b.confidence - a.confidence));

  return {
    generatedAt: now(),
    items: sorted,
    risks: sorted.length === 0 ? ["No actionable items extracted; parser confidence is low."] : [],
    recommendedNextActions: sorted.slice(0, 3).map((item) => `Review: ${item.summary}`),
  };
}
