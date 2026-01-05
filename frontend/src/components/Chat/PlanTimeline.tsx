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
			return <Check size={14} className="status-icon" />;
		case "running":
			return <Loader2 size={14} className="status-icon running" />;
		case "failed":
			return <AlertCircle size={14} className="status-icon" />;
		case "pending":
		default:
			return <Clock size={14} fill="white" className="status-icon" />;
	}
};

const PlanTimeline: React.FC<PlanTimelineProps> = ({ planId, agentName, title, tasks }) => {
	const completedCount = tasks.filter((t) => t.status === "completed").length;
	const isComplete = completedCount === tasks.length && tasks.length > 0;
	const hasFailure = tasks.some((t) => t.status === "failed");

	return (
		<div className={`plan-timeline ${isComplete ? "complete" : ""} ${hasFailure ? "has-failure" : ""}`}>
			<div className="plan-header">
				<span className="plan-title">{title}</span>
				<span className="plan-progress">
					{agentName} - {completedCount}/{tasks.length}
				</span>
			</div>

			<div className="plan-tasks">
				{tasks.map((task, index) => (
					<div key={task.id} className={`plan-task ${task.status}`}>
						<div className="task-connector">
							<div className={`task-dot ${task.status}`}>{getStatusIcon(task.status)}</div>
							{index < tasks.length - 1 && <div className={`task-line ${tasks[index + 1]?.status === "pending" ? "pending" : "active"}`} />}
						</div>
						<div className="task-content">
							<div className="task-tool">{task.tool}</div>
							<div className="task-description">{task.description}</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default PlanTimeline;
