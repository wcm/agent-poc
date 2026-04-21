import React from "react";
import { PlanTask, TaskStatus } from "../../types";
import { Check, Clock, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface PlanTimelineProps {
	planId: string;
	agentName: string;
	title: string;
	tasks: PlanTask[];
	collapsed?: boolean;
	onToggleCollapsed?: () => void;
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

const PlanTimeline: React.FC<PlanTimelineProps> = ({ planId, agentName, title, tasks, collapsed = false, onToggleCollapsed }) => {
	const completedCount = tasks.filter((t) => t.status === "completed").length;
	const isComplete = completedCount === tasks.length && tasks.length > 0;
	const hasFailure = tasks.some((t) => t.status === "failed");
	const isInProgress = !isComplete && !hasFailure && tasks.length > 0;
	const runningIndex = tasks.findIndex((task) => task.status === "running");
	const failedIndex = tasks.findIndex((task) => task.status === "failed");
	const pendingIndex = tasks.findIndex((task) => task.status === "pending");
	const fallbackIndex = tasks.length > 0 ? Math.max(completedCount - 1, 0) : 0;
	const activeIndex = runningIndex >= 0 ? runningIndex : failedIndex >= 0 ? failedIndex : pendingIndex >= 0 ? pendingIndex : fallbackIndex;
	const activeTask = tasks[activeIndex];
	const currentStep = tasks.length > 0 ? Math.min(activeIndex + 1, tasks.length) : 0;

	const containerClass = `plan-timeline ${collapsed ? "collapsed" : "expanded"} ${isInProgress ? "in-progress" : ""} ${isComplete ? "complete" : ""} ${hasFailure ? "has-failure" : ""}`;

	const statusIndicator = isComplete ? (
		<span className="plan-summary-indicator complete" aria-label="Completed">
			<Check size={14} />
		</span>
	) : hasFailure ? (
		<span className="plan-summary-indicator failed" aria-label="Failed">
			<AlertCircle size={14} />
		</span>
	) : isInProgress ? (
		<span className="plan-summary-indicator running" aria-label="In progress">
			<Loader2 size={14} />
		</span>
	) : null;

	if (collapsed) {
		return (
			<button type="button" className={`${containerClass} plan-timeline-toggle`} onClick={onToggleCollapsed}>
				<div className="plan-collapsed-summary">
					<span className="plan-progress-badge">
						{currentStep}/{tasks.length}
					</span>
					<span className="plan-collapsed-tool">{activeTask ? toTitleCase(activeTask.tool) : "Planning"}</span>
				</div>
				<div className="plan-collapsed-actions">
					{statusIndicator}
					<ChevronUp size={16} className="plan-toggle-icon" />
				</div>
			</button>
		);
	}

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
					{statusIndicator}
					{onToggleCollapsed && (
						<button type="button" className="plan-toggle-button" onClick={onToggleCollapsed} aria-label="Collapse progress">
							<ChevronDown size={16} />
						</button>
					)}
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
