import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { Orchestrator } from './orchestrator';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Store orchestrator instance to maintain state across requests
let globalOrchestrator: Orchestrator | null = null;

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

    // Initialize or reuse the global orchestrator to keep history
    if (!globalOrchestrator) {
        globalOrchestrator = new Orchestrator();
    }

    // Listen for progress events from the orchestrator
    // We need to bind a new listener for THIS response, and remove it later
    const onProgress = (data: any) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', data })}\n\n`);
    };
    globalOrchestrator.on('progress', onProgress);

    try {
        const response = await globalOrchestrator.handleRequest(message);
        // Send final response
        res.write(`data: ${JSON.stringify({ type: 'final', response })}\n\n`);
    } catch (error: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    } finally {
        // Clean up listener to avoid leaks or duplicate messages on future requests
        globalOrchestrator.off('progress', onProgress);
        res.end();
    }
});

app.post('/api/clear', (req: Request, res: Response) => {
    if (globalOrchestrator) {
        globalOrchestrator.clearHistory();
    }
    res.json({ message: 'History cleared' });
});

// Anything that doesn't match the above, send back index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
