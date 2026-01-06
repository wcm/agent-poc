import React from "react";
import { PlanTask, TaskStatus } from "../../types";
import { Check, Clock, Loader2, AlertCircle } from "lucide-react";

interface PlanTimelineProps {
	planId: string;
	agentName: string;
	title: string;
	tasks: PlanTask[];
}

const getStatusIcon = (status: TaskStatus) => {
	switch (status) {
		case "completed":
			return <Check size={12} className="status-icon" />;
		case "running":
			return <Loader2 size={12} className="status-icon running" />;
		case "failed":
			return <AlertCircle size={12} className="status-icon" />;
		case "pending":
		default:
			return <Clock size={12} className="status-icon" />;
	}
};

// Convert camelCase to Title Case (e.g., "dataQuery" → "Data Query")
const toTitleCase = (str: string) => {
	return str.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
};

const PlanTimeline: React.FC<PlanTimelineProps> = ({ planId, agentName, title, tasks }) => {
	const completedCount = tasks.filter((t) => t.status === "completed").length;
	const isComplete = completedCount === tasks.length && tasks.length > 0;
	const hasFailure = tasks.some((t) => t.status === "failed");

	const containerClass = `plan-timeline ${isComplete ? "complete" : ""} ${hasFailure ? "has-failure" : ""}`;

	return (
		<div className={containerClass}>
			<div className="plan-header">
				<div className="plan-header-left">
					<span className="plan-title-text">{title}</span>
				</div>
				<div className="plan-header-right">
					<span className="plan-progress-badge">
						{completedCount}/{tasks.length}
					</span>
				</div>
			</div>

			<div className="plan-tasks">
				{tasks.map((task, index) => (
					<div key={task.id} className={`plan-task ${task.status}`}>
						<div className="task-connector">
							<div className={`task-dot ${task.status}`}>{getStatusIcon(task.status)}</div>
							{index < tasks.length - 1 && <div className={`task-line ${tasks[index + 1]?.status === "pending" ? "pending" : "active"}`} />}
						</div>
						<div className="task-content">
							<span className="task-tool-icon">{toTitleCase(task.tool)}</span>
							<span className="task-description">{task.description}</span>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default PlanTimeline;
