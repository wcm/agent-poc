import React, { useState, useRef, useEffect } from "react";
import "./App.css";

interface Message {
	role: "user" | "assistant";
	content: string;
	steps?: StepUpdate[];
}

interface StepUpdate {
	agent: string;
	title: string;
	content: string;
	timestamp: number;
}

// Separate component for the Agent Thinking Process
const AgentProcessDisplay: React.FC<{ steps: StepUpdate[]; isComplete: boolean }> = ({ steps, isComplete }) => {
	const [isCollapsed, setIsCollapsed] = useState(false);

	// Auto-collapse when complete
	useEffect(() => {
		if (isComplete) {
			setIsCollapsed(true);
		}
	}, [isComplete]);

	if (steps.length === 0) return null;

	return (
		<div className={`agent-process-container ${isComplete ? "complete" : "active"}`}>
			<div className="process-header" onClick={() => isComplete && setIsCollapsed(!isCollapsed)}>
				<span className="process-title">{isComplete ? "Process Complete" : "Agent Working..."}</span>
				{isComplete && <span className="toggle-icon">{isCollapsed ? "▼" : "▲"}</span>}
			</div>

			{!isCollapsed && (
				<div className="steps-list">
					{steps.map((step, idx) => (
						<div key={idx} className="step-item">
							<div className="step-header">
								<span className="agent-name">{step.agent}</span>
								<span className="step-title">{step.title}</span>
							</div>
							<div className="step-content">{step.content}</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

function App() {
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [currentProcessSteps, setCurrentProcessSteps] = useState<StepUpdate[]>([]);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Ref to track steps during streaming for the final message
	const stepsRef = useRef<StepUpdate[]>([]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages, currentProcessSteps]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;

		const userMessage: Message = { role: "user", content: input };
		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);
		setCurrentProcessSteps([]);
		stepsRef.current = []; // Reset ref

		// Use SSE for streaming updates
		const eventSource = new EventSource(`http://localhost:3001/api/stream?message=${encodeURIComponent(userMessage.content)}`);

		eventSource.onmessage = (event) => {
			const data = JSON.parse(event.data);

			if (data.type === "progress") {
				const newStep = { ...data.data, timestamp: Date.now() };
				// Update both State (for UI) and Ref (for final submission)
				setCurrentProcessSteps((prev) => [...prev, newStep]);
				stepsRef.current.push(newStep);
			} else if (data.type === "final") {
				// Create message WITH the accumulated steps
				const assistantMessage: Message = {
					role: "assistant",
					content: data.response,
					steps: [...stepsRef.current], // Attach steps here
				};
				setMessages((prev) => [...prev, assistantMessage]);
				setIsLoading(false);
				setCurrentProcessSteps([]); // Clear active steps as they are now in the message
				stepsRef.current = [];
				eventSource.close();
			} else if (data.type === "error") {
				setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
				setIsLoading(false);
				setCurrentProcessSteps([]);
				stepsRef.current = [];
				eventSource.close();
			}
		};

		eventSource.onerror = (err) => {
			console.error("EventSource failed:", err);
			eventSource.close();
			setIsLoading(false);
		};
	};

	return (
		<div className="App">
			<header className="App-header">
				<h1>Claude Marketing Agent</h1>
			</header>
			<div className="chat-container">
				<div className="messages">
					{messages.length === 0 && (
						<div className="welcome-message">
							<p>Hello! I can help you analyze marketing data. Ask me about campaigns, ROAS, or strategy.</p>
						</div>
					)}

					{messages.map((msg, index) => (
						<React.Fragment key={index}>
							{/* If this message has attached steps, show them BEFORE the message content */}
							{msg.steps && msg.steps.length > 0 && <AgentProcessDisplay steps={msg.steps} isComplete={true} />}

							<div className={`message ${msg.role}`}>
								<div className="message-content">
									{msg.content.split("\n").map((line, i) => (
										<p key={i}>{line}</p>
									))}
								</div>
							</div>
						</React.Fragment>
					))}

					{/* Current Active Process Display (Only show when loading) */}
					{isLoading && currentProcessSteps.length > 0 && <AgentProcessDisplay steps={currentProcessSteps} isComplete={false} />}

					<div ref={messagesEndRef} />
				</div>
				<form onSubmit={handleSubmit} className="input-form">
					<input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Calculate ROAS for my Facebook ads..." disabled={isLoading} />
					<button type="submit" disabled={isLoading || !input.trim()}>
						Send
					</button>
				</form>
			</div>
		</div>
	);
}

export default App;
