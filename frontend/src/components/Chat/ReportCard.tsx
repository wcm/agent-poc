import React, { useState } from 'react';
import { FileText, BarChart3, Lightbulb, Sparkles } from 'lucide-react';
import DocumentModal from './DocumentModal';

interface ReportCardProps {
    reportType: 'performance' | 'creative' | 'common';
    reportId: string;
    title: string;
    content: string;
    itemName?: string;
}

const getReportIcon = (reportType: ReportCardProps['reportType']) => {
    switch (reportType) {
        case 'performance':
            return <BarChart3 size={18} className="report-icon performance" />;
        case 'creative':
            return <Lightbulb size={18} className="report-icon creative" />;
        case 'common':
            return <Sparkles size={18} className="report-icon common" />;
        default:
            return <FileText size={18} className="report-icon" />;
    }
};

const getReportTypeLabel = (reportType: ReportCardProps['reportType']) => {
    switch (reportType) {
        case 'performance':
            return 'Performance';
        case 'creative':
            return 'Creative';
        case 'common':
            return 'Common Findings';
        default:
            return 'Report';
    }
};

const ReportCard: React.FC<ReportCardProps> = ({ reportType, reportId, title, content, itemName }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Get first 3-4 lines for preview
    const preview = content.split('\n').slice(0, 4).join('\n');

    return (
        <>
            <div 
                className={`report-card ${reportType}`}
                onClick={() => setIsModalOpen(true)}
            >
                <div className="report-card-header">
                    {getReportIcon(reportType)}
                    <div className="report-card-titles">
                        <span className="report-title">{title}</span>
                        {itemName && <span className="report-item">{itemName}</span>}
                    </div>
                    <span className={`report-type-badge ${reportType}`}>
                        {getReportTypeLabel(reportType)}
                    </span>
                </div>
                <div className="report-card-preview">
                    {preview.split('\n').map((line, idx) => (
                        <p key={idx}>{line || '\u00A0'}</p>
                    ))}
                </div>
                <div className="report-card-footer">
                    <span className="view-full">Click to view full report</span>
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

export default ReportCard;

