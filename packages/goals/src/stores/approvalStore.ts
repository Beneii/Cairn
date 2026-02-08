/**
 * Approval Store
 * 
 * Tracks pending approvals for actions that require human confirmation.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { getDataPath, now, newId } from "@cairn/shared";
import type { ApprovalRequest, ApprovalStatus } from "../types/approval.js";
import { getActionRisk, requiresApproval, isNeverAllowed } from "../types/approval.js";

// ---- State ----

let approvals: ApprovalRequest[] = [];
let dataPath: string;

// ---- Persistence ----

async function persist(): Promise<void> {
    const dir = dirname(dataPath);
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
    await writeFile(dataPath, JSON.stringify(approvals, null, 2));
}

async function load(): Promise<void> {
    try {
        const data = await readFile(dataPath, "utf-8");
        approvals = JSON.parse(data);
        console.log(`[approvals] Loaded ${approvals.length} approval requests`);
    } catch {
        approvals = [];
    }
}

// ---- Init ----

export async function initApprovalStore(): Promise<void> {
    dataPath = join(getDataPath(), "goals", "approvals.json");
    await load();
}

// ---- Create Approval Request ----

export async function requestApproval(
    goalId: string,
    action: string,
    description: string,
    payload: unknown,
    expiresInMinutes?: number
): Promise<ApprovalRequest | null> {
    // Check if action is never allowed
    if (isNeverAllowed(action)) {
        console.log(`[approvals] Action "${action}" is NEVER allowed`);
        return null;
    }

    // Check if approval is even needed
    if (!requiresApproval(action)) {
        console.log(`[approvals] Action "${action}" doesn't require approval`);
        return null; // Caller should proceed automatically
    }

    const request: ApprovalRequest = {
        id: newId(),
        goalId,
        action,
        description,
        payload,
        status: "pending",
        createdAt: now(),
        expiresAt: expiresInMinutes
            ? new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()
            : undefined,
    };

    approvals.push(request);
    await persist();

    console.log(`[approvals] Created approval request: ${description}`);
    return request;
}

// ---- Query ----

export function getPendingApprovals(): ApprovalRequest[] {
    const now = Date.now();
    return approvals.filter(a => {
        if (a.status !== "pending") return false;
        if (a.expiresAt && new Date(a.expiresAt).getTime() < now) return false;
        return true;
    });
}

export function getApprovalsByGoal(goalId: string): ApprovalRequest[] {
    return approvals.filter(a => a.goalId === goalId);
}

export function getApproval(id: string): ApprovalRequest | undefined {
    return approvals.find(a => a.id === id);
}

// ---- Resolve ----

export async function approve(id: string): Promise<ApprovalRequest | undefined> {
    const request = approvals.find(a => a.id === id);
    if (!request || request.status !== "pending") return undefined;

    request.status = "approved";
    request.resolvedAt = now();
    request.resolvedBy = "user";
    await persist();

    console.log(`[approvals] APPROVED: ${request.description}`);
    return request;
}

export async function reject(id: string): Promise<ApprovalRequest | undefined> {
    const request = approvals.find(a => a.id === id);
    if (!request || request.status !== "pending") return undefined;

    request.status = "rejected";
    request.resolvedAt = now();
    request.resolvedBy = "user";
    await persist();

    console.log(`[approvals] REJECTED: ${request.description}`);
    return request;
}

// ---- Expiration ----

export async function expireOldRequests(): Promise<number> {
    const now = Date.now();
    let count = 0;

    for (const request of approvals) {
        if (request.status === "pending" && request.expiresAt) {
            if (new Date(request.expiresAt).getTime() < now) {
                request.status = "expired";
                request.resolvedAt = new Date().toISOString();
                request.resolvedBy = "timeout";
                count++;
            }
        }
    }

    if (count > 0) {
        await persist();
        console.log(`[approvals] Expired ${count} requests`);
    }

    return count;
}

// ---- Re-export types for convenience ----

export { getActionRisk, requiresApproval, isNeverAllowed };
