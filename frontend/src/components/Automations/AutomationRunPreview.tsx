import React from "react";
import { Message, PlanTask } from "../../types";
import StreamingMessage from "../Chat/StreamingMessage";
import { MessageContent } from "../../MessageContent";

interface AutomationRunPreviewProps {
	messages: Message[];
}

const AutomationRunPreview: React.FC<AutomationRunPreviewProps> = ({ messages }) => {
	return (
		<div className="automation-run-preview">
			<div className="chat-thread-shell automation-run-thread">
				{messages.map((message, index) => {
					if (message.role === "user") {
						return (
							<div key={index} className="message user">
								<div className="message-content">{message.content}</div>
							</div>
						);
					}

					if (message.sections && message.sections.length > 0) {
						return (
							<div key={index} className="assistant-response">
								<StreamingMessage sections={message.sections} planStates={new Map<string, PlanTask[]>()} />
							</div>
						);
					}

					return (
						<div key={index} className="message assistant">
							<MessageContent content={message.content} />
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default AutomationRunPreview;
