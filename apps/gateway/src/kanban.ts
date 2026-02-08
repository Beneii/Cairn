import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { KanbanCard, KanbanStatus } from "@cairn/shared";
import { newId, now, bus, getDataPath } from "@cairn/shared";

const DATA_DIR = getDataPath("kanban");
const KANBAN_FILE = join(DATA_DIR, "cards.json");

let cards: KanbanCard[] = [];

export async function initKanban(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  if (existsSync(KANBAN_FILE)) {
    const raw = await readFile(KANBAN_FILE, "utf-8");
    if (raw.trim()) {
      cards = JSON.parse(raw);
    }
  }
}

export function getCards(): KanbanCard[] {
  return [...cards];
}

export async function createCard(
  title: string,
  status: KanbanStatus = "backlog",
  jobId?: string,
): Promise<KanbanCard> {
  const card: KanbanCard = {
    id: newId(),
    title,
    status,
    jobId,
    createdAt: now(),
    updatedAt: now(),
  };
  cards.unshift(card);
  await persist();
  bus.emit("kanban:updated", getCards());
  return card;
}

export async function updateCardStatus(
  id: string,
  status: KanbanStatus,
): Promise<KanbanCard | undefined> {
  const card = cards.find((c) => c.id === id);
  if (card) {
    card.status = status;
    card.updatedAt = now();
    await persist();
    bus.emit("kanban:updated", getCards());
  }
  return card;
}

export async function updateCardByJobId(
  jobId: string,
  status: KanbanStatus,
): Promise<KanbanCard | undefined> {
  const card = cards.find((c) => c.jobId === jobId);
  if (card) {
    card.status = status;
    card.updatedAt = now();
    await persist();
    bus.emit("kanban:updated", getCards());
  }
  return card;
}

export async function deleteCard(id: string): Promise<void> {
  const index = cards.findIndex((c) => c.id === id);
  if (index !== -1) {
    cards.splice(index, 1);
    await persist();
    bus.emit("kanban:updated", getCards());
  }
}

export async function updateCardProject(
  id: string,
  project: string,
): Promise<KanbanCard | undefined> {
  const card = cards.find((c) => c.id === id);
  if (card) {
    card.project = project;
    card.updatedAt = now();
    await persist();
    bus.emit("kanban:updated", getCards());
  }
  return card;
}

export async function archiveCard(id: string): Promise<KanbanCard | undefined> {
  const card = cards.find((c) => c.id === id);
  if (card) {
    card.archived = true;
    card.archivedAt = now();
    card.updatedAt = now();
    await persist();
    bus.emit("kanban:updated", getCards());
  }
  return card;
}

export async function restoreCard(id: string): Promise<KanbanCard | undefined> {
  const card = cards.find((c) => c.id === id);
  if (card) {
    card.archived = false;
    card.updatedAt = now();
    await persist();
    bus.emit("kanban:updated", getCards());
  }
  return card;
}

export function getActiveCards(): KanbanCard[] {
  return cards.filter((c) => !c.archived);
}

export function getArchivedCards(): KanbanCard[] {
  return cards.filter((c) => c.archived === true);
}

async function persist(): Promise<void> {
  await writeFile(KANBAN_FILE, JSON.stringify(cards, null, 2));
}
