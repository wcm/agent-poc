import React, { useState } from 'react';
import { FileText, ChevronRight } from 'lucide-react';
import DocumentModal from './DocumentModal';

interface DocumentCardProps {
    title: string;
    content: string;
    preview: string;
    agent?: string;
}

const DocumentCard: React.FC<DocumentCardProps> = ({ title, content, preview, agent }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const getAgentColor = (agent?: string) => {
        switch (agent) {
            case 'performance':
                return '#3b82f6'; // blue
            case 'creative-insights':
                return '#8b5cf6'; // purple
            default:
                return '#6b7280'; // gray
        }
    };

    return (
        <>
            <div 
                className="document-card"
                onClick={() => setIsModalOpen(true)}
                style={{ borderLeftColor: getAgentColor(agent) }}
            >
                <div className="document-card-header">
                    <div className="document-card-icon">
                        <FileText size={18} />
                    </div>
                    <div className="document-card-title">{title}</div>
                    <div className="document-card-action">
                        <ChevronRight size={16} />
                    </div>
                </div>
                <div className="document-card-preview">
                    {preview}
                </div>
                <div className="document-card-footer">
                    Click to view full report
                </div>
            </div>

            {isModalOpen && (
                <DocumentModal
                    title={title}
                    content={content}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </>
    );
};

export default DocumentCard;

