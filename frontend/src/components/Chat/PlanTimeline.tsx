import React, { useState, useEffect } from "react";
import { PlanTask, TaskStatus } from "../../types";
import { Check, Clock, Loader2, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";

interface PlanTimelineProps {
	planId: string;
	agentName: string;
	title: string;
	tasks: PlanTask[];
	isSticky?: boolean;
	isVisible?: boolean;
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

const getToolIcon = (tool: string) => {
	switch (tool) {
		case "dataQuery":
			return "🔍";
		case "dataAnalysis":
			return "📊";
		case "focusItems":
			return "🎯";
		case "creativeInsights":
			return "✨";
		case "consolidateFindings":
			return "📋";
		default:
			return "⚙️";
	}
};

const PlanTimeline: React.FC<PlanTimelineProps> = ({ planId, agentName, title, tasks, isSticky = false, isVisible = true }) => {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const completedCount = tasks.filter((t) => t.status === "completed").length;
	const isComplete = completedCount === tasks.length && tasks.length > 0;
	const hasFailure = tasks.some((t) => t.status === "failed");

	// Auto-collapse when complete
	useEffect(() => {
		if (isComplete && isSticky) {
			const timer = setTimeout(() => setIsCollapsed(true), 1500);
			return () => clearTimeout(timer);
		}
	}, [isComplete, isSticky]);

	if (!isVisible && isSticky) return null;

	const containerClass = isSticky
		? `sticky-plan-sidebar ${isComplete ? "complete" : ""} ${hasFailure ? "has-failure" : ""} ${isCollapsed ? "collapsed" : ""}`
		: `plan-timeline ${isComplete ? "complete" : ""} ${hasFailure ? "has-failure" : ""}`;

	return (
		<div className={containerClass}>
			<div className="plan-header" onClick={() => isSticky && setIsCollapsed(!isCollapsed)}>
				<div className="plan-header-left">
					<span className="plan-title-text">{isCollapsed ? "Plan" : title}</span>
				</div>
				<div className="plan-header-right">
					<span className="plan-progress-badge">
						{completedCount}/{tasks.length}
					</span>
					{isSticky && <span className="collapse-toggle">{isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</span>}
				</div>
			</div>

			{!isCollapsed && (
				<div className="plan-tasks">
					{tasks.map((task, index) => (
						<div key={task.id} className={`plan-task ${task.status}`}>
							<div className="task-connector">
								<div className={`task-dot ${task.status}`}>{getStatusIcon(task.status)}</div>
								{index < tasks.length - 1 && <div className={`task-line ${tasks[index + 1]?.status === "pending" ? "pending" : "active"}`} />}
							</div>
							<div className="task-content">
								<span className="task-tool-icon">{getToolIcon(task.tool)}</span>
								<span className="task-description">{task.description}</span>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default PlanTimeline;
