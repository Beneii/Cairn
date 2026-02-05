import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { Job } from "@cairn/shared";
import { newId, now, bus, getDataPath } from "@cairn/shared";

const DATA_DIR = getDataPath("jobs");
const JOBS_FILE = join(DATA_DIR, "jobs.json");

const jobs = new Map<string, Job>();

export async function initJobStore(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  if (existsSync(JOBS_FILE)) {
    const raw = await readFile(JOBS_FILE, "utf-8");
    const arr: Job[] = JSON.parse(raw);
    for (const j of arr) jobs.set(j.id, j);
  }
}

export function createJob(input: string): Job {
  const job: Job = {
    id: newId(),
    status: "queued",
    input,
    nodes_traversed: [],
    artifacts: [],
    costs_so_far: [],
    created_at: now(),
    updated_at: now(),
  };
  jobs.set(job.id, job);
  persist();
  bus.emit("job:created", job);
  return job;
}

export function updateJob(id: string, updates: Partial<Job>): Job {
  const job = jobs.get(id);
  if (!job) throw new Error(`Job not found: ${id}`);
  Object.assign(job, updates, { updated_at: now() });
  persist();
  bus.emit("job:updated", job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function getJobs(filter?: { status?: string }): Job[] {
  let result = Array.from(jobs.values());
  if (filter?.status) result = result.filter((j) => j.status === filter.status);
  return result;
}

function persist(): void {
  // Fire-and-forget write — acceptable for MVP single-process
  writeFile(JOBS_FILE, JSON.stringify(Array.from(jobs.values()), null, 2)).catch(
    (err) => console.error("[jobs] persist error:", err),
  );
}
