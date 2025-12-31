import React, { useState, useRef, useEffect } from "react";
import { StepUpdate } from "../../types";

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

export default AgentProcessDisplay;
