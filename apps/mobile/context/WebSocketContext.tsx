import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AuthService, PairingConfig } from '../services/auth';

export interface Task {
    id: string;
    title: string;
    status: 'todo' | 'done';
    type: 'one-off' | 'recurring';
    due_date?: string;
    scheduled_date?: string;
    source?: string;
    suggested_by_agent?: boolean;
    created_at?: string;
}

interface WebSocketContextType {
    connected: boolean;
    messages: any[];
    tasks: Task[];
    sendMessage: (text: string) => void;
    completeTask: (id: string) => void;
    createTask: (title: string) => void;
    deleteTask: (id: string) => void;
    connect: (config: PairingConfig) => void;
    disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocket() {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const configRef = useRef<PairingConfig | null>(null);

    useEffect(() => {
        AuthService.getPairingConfig().then((config) => {
            if (config) {
                connect(config);
            }
        });

        return () => {
            disconnect();
        };
    }, []);

    const send = (data: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    };

    const connect = (config: PairingConfig) => {
        if (wsRef.current && configRef.current?.url === config.url) {
            if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
                return;
            }
        }

        clearTimeout(reconnectTimer.current);
        if (wsRef.current) {
            wsRef.current.onopen = null;
            wsRef.current.onclose = null;
            wsRef.current.onerror = null;
            wsRef.current.onmessage = null;
            try { wsRef.current.close(); } catch (e) { }
            wsRef.current = null;
        }

        configRef.current = config;
        let wsUrl = config.url;

        if (wsUrl.startsWith('http')) {
            wsUrl = wsUrl.replace(/^http/, 'ws');
        }
        if (!wsUrl.endsWith('/ws')) {
            wsUrl = wsUrl.replace(/\/$/, '') + '/ws';
        }

        console.log(`Connecting to ${wsUrl}...`);

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                setConnected(true);
                ws.send(JSON.stringify({ type: 'mobile:connect', secret: config.secret }));
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setConnected(false);
                wsRef.current = null;
                if (configRef.current) {
                    clearTimeout(reconnectTimer.current);
                    reconnectTimer.current = setTimeout(() => {
                        if (configRef.current) connect(configRef.current);
                    }, 5000);
                }
            };

            ws.onerror = () => {
                console.log('WebSocket error occurred');
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'chat:message') {
                        setMessages((prev) => [...prev, msg.message]);
                    } else if (msg.type === 'task:update') {
                        setTasks(msg.tasks || []);
                    }
                } catch (e) {
                    console.error('Failed to parse message', e);
                }
            };
        } catch (e) {
            console.error('Failed to create WebSocket', e);
        }
    };

    const disconnect = () => {
        configRef.current = null;
        clearTimeout(reconnectTimer.current);
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setConnected(false);
    };

    const sendMessage = (text: string) => {
        send({ type: 'mobile:send', text });
    };

    const completeTask = (id: string) => {
        send({ type: 'task:update', id, changes: { status: 'done' } });
    };

    const createTask = (title: string) => {
        send({ type: 'task:create', title, taskType: 'one-off' });
    };

    const deleteTask = (id: string) => {
        send({ type: 'task:delete', id });
    };

    return (
        <WebSocketContext.Provider value={{
            connected, messages, tasks,
            sendMessage, completeTask, createTask, deleteTask,
            connect, disconnect,
        }}>
            {children}
        </WebSocketContext.Provider>
    );
}
