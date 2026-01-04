import React from 'react';
import { PlanTask, TaskStatus } from '../../types';
import { Check, Clock, Loader2, AlertCircle } from 'lucide-react';

interface PlanTimelineProps {
    planId: string;
    agentName: string;
    title: string;
    tasks: PlanTask[];
}

const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
        case 'completed':
            return <Check size={14} className="status-icon completed" />;
        case 'running':
            return <Loader2 size={14} className="status-icon running" />;
        case 'failed':
            return <AlertCircle size={14} className="status-icon failed" />;
        case 'pending':
        default:
            return <Clock size={14} className="status-icon pending" />;
    }
};

const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
        case 'completed':
            return 'Done';
        case 'running':
            return 'In Progress';
        case 'failed':
            return 'Failed';
        case 'pending':
        default:
            return 'Pending';
    }
};

const PlanTimeline: React.FC<PlanTimelineProps> = ({ planId, agentName, title, tasks }) => {
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const isComplete = completedCount === tasks.length && tasks.length > 0;
    const hasFailure = tasks.some(t => t.status === 'failed');

    return (
        <div className={`plan-timeline ${isComplete ? 'complete' : ''} ${hasFailure ? 'has-failure' : ''}`}>
            <div className="plan-header">
                <span className="plan-agent">{agentName}</span>
                <span className="plan-title">{title}</span>
                <span className="plan-progress">{completedCount}/{tasks.length}</span>
            </div>
            
            <div className="plan-tasks">
                {tasks.map((task, index) => (
                    <div 
                        key={task.id} 
                        className={`plan-task ${task.status}`}
                    >
                        <div className="task-connector">
                            <div className={`task-dot ${task.status}`}>
                                {getStatusIcon(task.status)}
                            </div>
                            {index < tasks.length - 1 && (
                                <div className={`task-line ${tasks[index + 1]?.status === 'pending' ? 'pending' : 'active'}`} />
                            )}
                        </div>
                        <div className="task-content">
                            <div className="task-description">{task.description}</div>
                            <div className="task-meta">
                                <span className={`task-status-badge ${task.status}`}>
                                    {getStatusLabel(task.status)}
                                </span>
                                <span className="task-tool">{task.tool}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlanTimeline;

