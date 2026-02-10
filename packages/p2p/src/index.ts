import { WebSocket, WebSocketServer } from 'ws';
import { bus, newId, now } from '@cairn/shared';

export interface P2PMessage {
    type: string;
    senderId: string;
    targetId?: string; // Optional: directed message
    payload: any;
    timestamp: string;
}

export class P2PNode {
    private ws: WebSocket | null = null;
    private peerId: string;
    private relayUrl: string;

    constructor(peerId: string, relayUrl: string) {
        this.peerId = peerId;
        this.relayUrl = relayUrl;
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(`${this.relayUrl}?peerId=${this.peerId}`);

            this.ws.on('open', () => {
                console.log(`[P2P] Connected to relay: ${this.relayUrl}`);
                resolve();
            });

            this.ws.on('message', (data: any) => {
                try {
                    const message = JSON.parse(data.toString()) as P2PMessage;
                    this.handleMessage(message);
                } catch (err) {
                    console.error('[P2P] Failed to parse message:', err);
                }
            });

            this.ws.on('error', (err: any) => {
                console.error('[P2P] Connection error:', err);
                reject(err);
            });
        });
    }

    broadcast(type: string, payload: any): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const message: P2PMessage = {
            type,
            senderId: this.peerId,
            payload,
            timestamp: now()
        };

        this.ws.send(JSON.stringify(message));
    }

    private handleMessage(message: P2PMessage): void {
        if (message.senderId === this.peerId) return; // Ignore self

        // Emit internally for other packages to consume (e.g., @cairn/memory)
        bus.emit(`p2p:message:${message.type}` as any, message);
    }
}

// Simple local relay server for development
export class RelayServer {
    private wss: WebSocketServer;
    private clients = new Map<string, WebSocket>();

    constructor(port: number = 4001) {
        this.wss = new WebSocketServer({ port });

        this.wss.on('connection', (ws: WebSocket, req: any) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const peerId = url.searchParams.get('peerId') || `anon-${newId()}`;

            this.clients.set(peerId, ws);
            console.log(`[Relay] Peer connected: ${peerId}`);

            ws.on('message', (data: any) => {
                const message = JSON.parse(data.toString());
                this.broadcast(message, ws);
            });

            ws.on('close', () => {
                this.clients.delete(peerId);
                console.log(`[Relay] Peer disconnected: ${peerId}`);
            });
        });

        console.log(`[Relay] Server listening on port ${port}`);
    }

    private broadcast(message: any, senderWs: WebSocket): void {
        const payload = JSON.stringify(message);
        for (const client of this.clients.values()) {
            if (client !== senderWs && client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        }
    }
}
