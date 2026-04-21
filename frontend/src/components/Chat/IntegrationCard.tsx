import React from "react";
import { CheckCircle2, Link2, PlugZap, Sparkles } from "lucide-react";
import { getIntegrationDefinitionById } from "../../integrations/catalog";
import { IntegrationResultStatus } from "../../types";

interface IntegrationCardProps {
	resultId: string;
	integrationId: string;
	integrationName: string;
	title: string;
	status: IntegrationResultStatus;
	mode: "data" | "instruction";
	content: string;
}

const getStatusLabel = (status: IntegrationResultStatus, mode: IntegrationCardProps["mode"]) => {
	switch (status) {
		case "connected":
			return "Connected";
		case "available":
			return "Connect";
		case "coming_soon":
			return "Coming Soon";
		default:
			return mode === "data" ? "Connected" : "Integration";
	}
};

const getStatusIcon = (status: IntegrationResultStatus, mode: IntegrationCardProps["mode"]) => {
	switch (status) {
		case "connected":
			return <CheckCircle2 size={12} />;
		case "available":
			return <Link2 size={12} />;
		case "coming_soon":
			return <Sparkles size={12} />;
		default:
			return mode === "data" ? <CheckCircle2 size={12} /> : <PlugZap size={12} />;
	}
};

const IntegrationCard: React.FC<IntegrationCardProps> = ({ resultId, integrationId, integrationName, title, status, mode, content }) => {
	const definition = getIntegrationDefinitionById(integrationId);
	const preview = content
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.join(" ");

	return (
		<div className={`chat-integration-card ${status} ${mode}`} data-result-id={resultId}>
			<div className="chat-integration-card-header">
				<div className="chat-integration-card-brand">
					<div className="chat-integration-card-logo">{definition?.renderLogo(30) ?? <PlugZap size={18} />}</div>
					<div className="chat-integration-card-copy">
						<div className="chat-integration-card-name">{integrationName}</div>
						<div className="chat-integration-card-title">{title}</div>
					</div>
				</div>
				<div className={`chat-integration-card-badge ${status}`}>
					{getStatusLabel(status, mode)}
					{getStatusIcon(status, mode)}
				</div>
			</div>
			<div className="chat-integration-card-content">{preview}</div>
		</div>
	);
};

export default IntegrationCard;
