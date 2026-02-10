
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3100/ws');

ws.on('open', () => {
    console.log('Connected to gateway');

    // Wait for initial state dump
    setTimeout(() => {
        console.log('Sending image message...');
        const payload = {
            type: 'chat:send',
            text: 'This is a test image',
            attachments: [
                {
                    id: 'test-img-1',
                    type: 'image',
                    mimeType: 'image/png',
                    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
                    name: 'pixel.png'
                }
            ]
        };
        ws.send(JSON.stringify(payload));
    }, 1000);
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'chat:message' && msg.message.role === 'cairn') {
        console.log('Received response:', msg.message.text);
        if (msg.message.text.length > 0) {
            console.log('Got valid response text!');
            ws.close();
            process.exit(0);
        }
    }
    if (msg.type === 'job:update') {
        console.log('Job update:', msg.job);
        if (msg.job.status === 'running' && msg.job.nodes_traversed.includes('gatekeeper')) {
            console.log('Job running through gatekeeper...');
        }
        if (msg.job.status === 'done' || msg.job.nodes_traversed.includes('vision_worker')) {
            console.log('Job processed by vision_worker!');
            // Don't exit yet, wait for chat message
        }
    }
    if (msg.type === 'error') {
        console.error('Error:', msg.message);
    }
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    process.exit(1);
});
