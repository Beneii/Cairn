import * as Automerge from "@automerge/automerge";
import { getRawDoc, mergeChanges } from "./warm.js";

export interface SyncMessage {
    type: 'sync';
    senderId: string;
    changes: string; // Base64 encoded changes
}

export function generateSyncMessage(senderId: string): SyncMessage {
    const doc = getRawDoc();

    // For MVP, we send the full document snapshot.
    // mergeChanges on receiver now correctly handles snapshots via Automerge.merge
    const combined = Automerge.save(doc);

    return {
        type: 'sync',
        senderId,
        changes: Buffer.from(combined).toString('base64')
    };
}

export async function processSyncMessage(message: SyncMessage): Promise<void> {
    const binary = Buffer.from(message.changes, 'base64');
    await mergeChanges(binary);
}
