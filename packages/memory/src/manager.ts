import { P2PNode } from "@cairn/p2p";
import { bus } from "@cairn/shared";
import { generateSyncMessage, processSyncMessage, type SyncMessage } from "./sync.js";
import { warmSet, warmDelete } from "./warm.js";

export class SyncManager {
    private node: P2PNode;
    private peerId: string;

    constructor(peerId: string, relayUrl: string = 'ws://localhost:4001') {
        this.peerId = peerId;
        this.node = new P2PNode(peerId, relayUrl);
    }

    async init(): Promise<void> {
        await this.node.connect();

        // Listen for sync messages from peers
        bus.on('p2p:message:sync', async (message: any) => {
            const syncMsg = message.payload as SyncMessage;
            await processSyncMessage(syncMsg);
            console.log(`[SyncManager] Processed sync from ${message.senderId}`);
        });

        // Request initial sync from whoever is online
        this.node.broadcast('request_sync', { requesterId: this.peerId });

        // Listen for sync requests and send current state
        bus.on('p2p:message:request_sync', () => {
            const syncMsg = generateSyncMessage(this.peerId);
            this.node.broadcast('sync', syncMsg);
        });

        console.log(`[SyncManager] Initialized for peer ${this.peerId}`);
    }

    // Specialized setters that also broadcast
    async setAndBroadcast(key: string, value: any): Promise<void> {
        await warmSet(key, value);
        const syncMsg = generateSyncMessage(this.peerId);
        this.node.broadcast('sync', syncMsg);
    }

    async deleteAndBroadcast(key: string): Promise<void> {
        await warmDelete(key);
        const syncMsg = generateSyncMessage(this.peerId);
        this.node.broadcast('sync', syncMsg);
    }
}
