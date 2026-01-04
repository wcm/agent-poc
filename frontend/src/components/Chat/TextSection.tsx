import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TextSectionProps {
    content: string;
}

const TextSection: React.FC<TextSectionProps> = ({ content }) => {
    return (
        <div className="text-section">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
    );
};

export default TextSection;

