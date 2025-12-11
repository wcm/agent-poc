import React from "react";
import ReactMarkdown from "react-markdown";

interface MessageContentProps {
	content: string;
	dataPool?: any[]; // Allow passing in the data pool to look up details
}

// Helper to convert SNAKE_CASE to Title Case
const toTitleCase = (str: string) => {
	return str
		.replace(/_/g, " ")
		.toLowerCase()
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};

export const MessageContent: React.FC<MessageContentProps> = ({ content, dataPool = [] }) => {
	// Regex matches: ${{KEY:value}} OR ${{PAGE:value}}
	const parts = content.split(/(\${{KEY:[^}]+}}|\${{PAGE:[^}]+}})/g);

	const handleDetailsClick = (key: string) => {
		const data = dataPool.find((item) => item.group_key === key);
		if (data) {
			alert(`Details for ${key}:\n${JSON.stringify(data, null, 2)}`);
		} else {
			alert(`No details found for key: ${key}`);
		}
	};

	return (
		<div className="message-content">
			{parts.map((part, index) => {
				if (part.startsWith("${{KEY:")) {
					const key = part.match(/\${{KEY:([^}]+)}}/)?.[1];
					return (
						<button key={index} className="interactive-btn detail-btn" onClick={() => key && handleDetailsClick(key)}>
							View Details
						</button>
					);
				} else if (part.startsWith("${{PAGE:")) {
					const pageName = part.match(/\${{PAGE:([^}]+)}}/)?.[1] || "";
					return (
						<button key={index} className="interactive-btn page-button" onClick={() => alert(`Redirecting to: ${toTitleCase(pageName)}`)}>
							Go to {toTitleCase(pageName)}
						</button>
					);
				} else {
					// Clean up bullets to standard markdown format before rendering
					const cleanPart = part
						.replace(/•/g, "-") 
						.replace(/(\n)- /g, "\n- "); 

					return <ReactMarkdown key={index}>{cleanPart}</ReactMarkdown>;
				}
			})}
		</div>
	);
};
