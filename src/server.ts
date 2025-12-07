import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { Orchestrator } from './orchestrator';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Support Server-Sent Events (SSE) for streaming updates
app.get('/api/stream', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const message = req.query.message as string;
    if (!message) {
        res.write(`data: ${JSON.stringify({ error: "Message required" })}\n\n`);
        res.end();
        return;
    }

    const orchestrator = new Orchestrator();

    // Listen for progress events from the orchestrator
    orchestrator.on('progress', (data) => {
        // Send SSE event
        res.write(`data: ${JSON.stringify({ type: 'progress', data })}\n\n`);
    });

    try {
        const response = await orchestrator.handleRequest(message);
        // Send final response
        res.write(`data: ${JSON.stringify({ type: 'final', response })}\n\n`);
    } catch (error: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    } finally {
        res.end();
    }
});

// Original endpoint (optional, kept for compatibility)
app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
    try {
        const { message } = req.body;
        const orchestrator = new Orchestrator();
        const response = await orchestrator.handleRequest(message);
        res.json({ response });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/clear', (req: Request, res: Response) => {
    res.json({ message: 'History cleared' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
