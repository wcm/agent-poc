import React from 'react';
import { AgentOutputSection } from '../../types';
import AgentProcessDisplay from './AgentProcessDisplay';
import DocumentCard from './DocumentCard';
import FocusedItemsGrid from './FocusedItemsGrid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AgentSectionProps {
    section: AgentOutputSection;
    isComplete?: boolean;
}

const AgentSection: React.FC<AgentSectionProps> = ({ section, isComplete = true }) => {
    switch (section.type) {
        case 'thinking':
            if (!section.steps || section.steps.length === 0) {
                return null;
            }
            // Add timestamps if missing
            const stepsWithTimestamps = section.steps.map((step, idx) => ({
                ...step,
                timestamp: step.timestamp || Date.now() + idx
            }));
            return (
                <AgentProcessDisplay 
                    steps={stepsWithTimestamps} 
                    isComplete={isComplete}
                    agentName={section.agent}
                />
            );

        case 'text':
            if (!section.content) return null;
            return (
                <div className="agent-text-section">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
                </div>
            );

        case 'document':
        case 'creative_report':
            if (!section.title || !section.content) return null;
            return (
                <DocumentCard
                    title={section.title}
                    content={section.content}
                    preview={section.preview || section.content.substring(0, 150)}
                    agent={section.agent}
                />
            );

        case 'focused_items':
            if (!section.items || section.items.length === 0) return null;
            return <FocusedItemsGrid items={section.items} />;

        default:
            return null;
    }
};

export default AgentSection;

