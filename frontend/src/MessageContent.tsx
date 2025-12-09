import React from "react";
import ReactMarkdown from "react-markdown";

interface MessageContentProps {
	content: string;
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

export const MessageContent: React.FC<MessageContentProps> = ({ content }) => {
	// Regex to match both ${{AD:ID}} and ${{PAGE:NAME}}
	// This regex captures:
	// 1. The text BEFORE the tag
	// 2. The TYPE (AD or PAGE)
	// 3. The VALUE (ID or NAME)
	// We split by the entire tag to get parts

	const parts = content.split(/(\${{AD:[^}]+}}|\${{PAGE:[^}]+}})/g);

	return (
		<div className="message-content">
			{parts.map((part, index) => {
				if (part.startsWith("${{AD:")) {
					const adId = part.match(/\${{AD:([^}]+)}}/)?.[1];
					return (
						<button key={index} className="interactive-btn detail-btn" onClick={() => alert(`Clicked Ad: ${adId}`)}>
							View Ad Details
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
					// Replace "•" with "-" and ensure proper spacing for lists
					const cleanPart = part
						.replace(/•/g, "-") // Replace bullets with dashes
						.replace(/(\n)- /g, "\n- "); // Ensure newline before list items if missing

					return <ReactMarkdown key={index}>{cleanPart}</ReactMarkdown>;
				}
			})}
		</div>
	);
};
