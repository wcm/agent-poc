import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import { MessageContent } from "./MessageContent"; // Import the new component
import logo from "./assets/logo.svg";

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
	const stepsEndRef = useRef<HTMLDivElement>(null);

	// Auto-collapse when complete
	useEffect(() => {
		if (isComplete) {
			setIsCollapsed(true);
		}
	}, [isComplete]);

	// Scroll to bottom when steps update (only if not complete/collapsed)
	useEffect(() => {
		if (!isComplete && !isCollapsed) {
			stepsEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [steps, isComplete, isCollapsed]);

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
					{!isComplete && (
						<div className="step-item loading">
							<span className="loading-dots">Thinking...</span>
						</div>
					)}
					<div ref={stepsEndRef} />
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

	// Clear server history on initial load (page refresh)
	useEffect(() => {
		const apiUrl = window.location.hostname === "localhost" 
			? "http://localhost:3001/api/clear" 
			: "/api/clear";
			
		fetch(apiUrl, { method: "POST" })
			.catch(err => console.error("Failed to clear history:", err));
	}, []);

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
		// Use SSE for streaming updates
		// Use direct URL for localhost to avoid proxy buffering, relative path for production
		const apiUrl = window.location.hostname === "localhost" 
			? `http://localhost:3001/api/stream?message=${encodeURIComponent(userMessage.content)}`
			: `/api/stream?message=${encodeURIComponent(userMessage.content)}`;
			
		const eventSource = new EventSource(apiUrl);

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
				<img src={logo} className="app-logo" alt="Atria Logo" />
			</header>
			<div className="chat-container">
				{messages.length === 0 && (
					<div className="empty-state-container">
						<div className="suggested-questions-container">
							<button
								className="suggested-card"
								onClick={() => setInput("Based on my current performance, which ads should I experiment more with, and why?")}
							>
								<span className="card-title">Analyse Data</span>
								<span className="card-subtitle">Which ads need more experimentation?</span>
							</button>
							<button
								className="suggested-card"
								onClick={() => setInput("Why are my best ads performing well? Compare their key efficiency and conversion metrics to show what they’re doing better.")}
							>
								<span className="card-title">Explain</span>
								<span className="card-subtitle">Why are my best ads performing well?</span>
							</button>
							<button
								className="suggested-card"
								onClick={() => setInput("Given my recent performance trends, what are the top 3 recommended actions I should take right now to improve results?")}
							>
								<span className="card-title">Recommend Actions</span>
								<span className="card-subtitle">What are the top 3 actions to take now?</span>
							</button>
						</div>
					</div>
				)}

				{messages.map((msg, index) => (
					<React.Fragment key={index}>
						{/* If this message has attached steps, show them BEFORE the message content */}
						{msg.steps && msg.steps.length > 0 && <AgentProcessDisplay steps={msg.steps} isComplete={true} />}

						<div className={`message ${msg.role}`}>
							{/* Use the new MessageContent component for parsing buttons */}
							<MessageContent content={msg.content} />
						</div>
					</React.Fragment>
				))}

				{/* Current Active Process Display (Only show when loading) */}
				{isLoading && currentProcessSteps.length > 0 && <AgentProcessDisplay steps={currentProcessSteps} isComplete={false} />}

				<div ref={messagesEndRef} />
			</div>
			<div className="input-container">
				<form onSubmit={handleSubmit} className="input-form">
					<input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask me anything..." disabled={isLoading} />
					<button type="submit" disabled={isLoading || !input.trim()}>
						Send
					</button>
				</form>
			</div>
		</div>
	);
}

export default App;
