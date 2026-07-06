import React from "react";
import { CheckCircle2, Link2, PlugZap, Sparkles } from "lucide-react";
import { getIntegrationDefinitionById } from "../../integrations/catalog";
import { IntegrationActionStatus, IntegrationResultMode, IntegrationResultStatus } from "../../types";

interface IntegrationCardProps {
	resultId: string;
	integrationId: string;
	integrationName: string;
	title: string;
	status: IntegrationResultStatus;
	mode: IntegrationResultMode;
	actionStatus?: IntegrationActionStatus;
	isBlocking?: boolean;
	canConnect?: boolean;
	content: string;
	onConnect?: (integrationId: string) => void;
}

const getStatusLabel = (status: IntegrationResultStatus, mode: IntegrationCardProps["mode"], actionStatus?: IntegrationActionStatus) => {
	if (mode === "action") {
		switch (actionStatus) {
			case "completed":
				return "Completed";
			case "connection_required":
				return "Connect";
			case "unavailable":
				return "Unavailable";
			default:
				return "Action";
		}
	}

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

const getStatusIcon = (status: IntegrationResultStatus, mode: IntegrationCardProps["mode"], actionStatus?: IntegrationActionStatus) => {
	if (mode === "action") {
		switch (actionStatus) {
			case "completed":
				return <CheckCircle2 size={12} />;
			case "connection_required":
				return <Link2 size={12} />;
			case "unavailable":
				return <Sparkles size={12} />;
			default:
				return <PlugZap size={12} />;
		}
	}

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

const IntegrationCard: React.FC<IntegrationCardProps> = ({
	resultId,
	integrationId,
	integrationName,
	title,
	status,
	mode,
	actionStatus,
	isBlocking,
	canConnect,
	content,
	onConnect,
}) => {
	const definition = getIntegrationDefinitionById(integrationId);
	const isConnectable = Boolean(isBlocking && canConnect && actionStatus === "connection_required" && onConnect);
	const preview = content
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.join(" ");
	const handleConnect = () => {
		if (isConnectable) {
			onConnect?.(integrationId);
		}
	};
	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (!isConnectable) {
			return;
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			handleConnect();
		}
	};

	return (
		<div
			className={`chat-integration-card ${status} ${mode} ${actionStatus ?? ""} ${isConnectable ? "is-clickable" : ""}`}
			data-result-id={resultId}
			role={isConnectable ? "button" : undefined}
			tabIndex={isConnectable ? 0 : undefined}
			onClick={handleConnect}
			onKeyDown={handleKeyDown}
		>
			<div className="chat-integration-card-header">
				<div className="chat-integration-card-brand">
					<div className="chat-integration-card-logo">{definition?.renderLogo(30) ?? <PlugZap size={18} />}</div>
					<div className="chat-integration-card-copy">
						<div className="chat-integration-card-name">{integrationName}</div>
						<div className="chat-integration-card-title">{title}</div>
					</div>
				</div>
				<div className={`chat-integration-card-badge ${status}`}>
					{getStatusLabel(status, mode, actionStatus)}
					{getStatusIcon(status, mode, actionStatus)}
				</div>
			</div>
			<div className="chat-integration-card-content">{preview}</div>
			{isConnectable && <div className="chat-integration-card-action">Connect {integrationName}</div>}
		</div>
	);
};

export default IntegrationCard;
