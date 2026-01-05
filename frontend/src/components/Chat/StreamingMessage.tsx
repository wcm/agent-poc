import React from 'react';
import { StreamedSection, PlanTask } from '../../types';
import TextSection from './TextSection';
import PlanTimeline from './PlanTimeline';
import ReportCard from './ReportCard';
import FocusedItemsGrid from './FocusedItemsGrid';

interface StreamingMessageProps {
    sections: StreamedSection[];
    planStates: Map<string, PlanTask[]>;  // Map of planId -> current task states
    hidePlan?: boolean;  // Whether to hide plan sections (when shown sticky)
}

/**
 * StreamingMessage renders a collection of streamed sections
 * Each section type is rendered with its appropriate component
 */
const StreamingMessage: React.FC<StreamingMessageProps> = ({ sections, planStates, hidePlan = false }) => {
    if (sections.length === 0) {
        return null;
    }

    return (
        <div className="streaming-message">
            {sections.map((section, index) => {
                switch (section.type) {
                    case 'text':
                        return (
                            <TextSection 
                                key={`text-${index}`} 
                                content={section.content} 
                            />
                        );
                    
                    case 'plan':
                        // Skip plan if hidePlan is true (shown in sticky sidebar instead)
                        if (hidePlan) return null;
                        
                        // Get the latest task states for this plan
                        const tasks = planStates.get(section.planId) || section.tasks;
                        return (
                            <PlanTimeline
                                key={`plan-${section.planId}`}
                                planId={section.planId}
                                agentName={section.agentName}
                                title={section.title}
                                tasks={tasks}
                            />
                        );
                    
                    case 'report':
                        return (
                            <ReportCard
                                key={`report-${section.reportId}`}
                                reportType={section.reportType}
                                reportId={section.reportId}
                                title={section.title}
                                content={section.content}
                                itemName={section.itemName}
                                itemData={section.itemData}
                            />
                        );
                    
                    case 'focused_items':
                        return (
                            <FocusedItemsGrid
                                key={`items-${index}`}
                                title="Focus Items"
                                items={section.items}
                            />
                        );
                    
                    default:
                        return null;
                }
            })}
        </div>
    );
};

export default StreamingMessage;
