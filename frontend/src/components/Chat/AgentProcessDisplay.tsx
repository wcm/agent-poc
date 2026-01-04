import React, { useState, useRef, useEffect } from "react";
import { StepUpdate } from "../../types";

interface AgentProcessDisplayProps {
	steps: StepUpdate[];
	isComplete: boolean;
	agentName?: string; // Optional: 'performance', 'creative-insights', 'orchestrator'
}

const getAgentDisplayName = (agentName?: string): string => {
	switch (agentName) {
		case 'performance':
			return 'Performance Agent';
		case 'creative-insights':
			return 'Creative Insights Agent';
		case 'orchestrator':
			return 'Orchestrator';
		default:
			return 'Agent';
	}
};

const AgentProcessDisplay: React.FC<AgentProcessDisplayProps> = ({ steps, isComplete, agentName }) => {
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

	const displayName = getAgentDisplayName(agentName);
	const title = isComplete 
		? `${displayName} - Complete` 
		: `${displayName} Working...`;

	return (
		<div className={`agent-process-container ${isComplete ? "complete" : "active"} ${agentName ? `agent-${agentName}` : ''}`}>
			<div className="process-header" onClick={() => isComplete && setIsCollapsed(!isCollapsed)}>
				<span className="process-title">{title}</span>
				{isComplete && <span className="toggle-icon">{isCollapsed ? "▼" : "▲"}</span>}
			</div>

			{!isCollapsed && (
				<div className="steps-list">
					{steps.map((step, idx) => (
						<div key={idx} className="step-item">
							<div className="step-header">
								<span className="agent-name">{step.tool}</span>
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

export default AgentProcessDisplay;
