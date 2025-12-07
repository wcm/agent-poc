import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
// Import Agents and Guardrails
import { marketingAgent } from './agents/marketing';
import { errorAgent } from './agents/error-handler';
import { Guardrails } from './guardrails';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
    try {
        const { message } = req.body;
        
        if (!message) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }

        console.log(`[API] Received message: ${message.substring(0, 50)}...`);

        // 1. Run Guardrails (Only on User Input)
        const inputCheck = await Guardrails.validateInput(message);
        
        if (!inputCheck.passed) {
            console.warn(`[API] Guardrail Failed: ${inputCheck.reason}`);
            
            // Delegate to Error Agent
            const errorResponse = await errorAgent.processError(message, inputCheck.reason || "Safety Violation");
            res.json({ response: errorResponse });
            return;
        }

        // 2. Process with Marketing Agent
        const response = await marketingAgent.process(message);

        // 3. Optional: Run Output Guardrails (Safety check on generated content)
        // We do this here at the API level too
        const outputCheck = await Guardrails.validateOutput(response);
        if (!outputCheck.passed) {
            console.error(`[API] Output Guardrail Failed: ${outputCheck.reason}`);
            res.status(500).json({ error: "Response validation failed." });
            return;
        }

        res.json({ response });

    } catch (error: any) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

app.get('/api/history', (req: Request, res: Response) => {
    res.json(marketingAgent.getHistory());
});

app.post('/api/clear', (req: Request, res: Response) => {
    marketingAgent.clearHistory();
    res.json({ message: 'History cleared' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
