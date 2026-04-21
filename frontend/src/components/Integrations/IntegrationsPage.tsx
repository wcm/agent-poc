import React, { useMemo, useState } from "react";
import { Check, Search, ShieldCheck } from "lucide-react";
import { Channel } from "../../types";
import {
	filterIntegrations,
	getConnectableChannelId,
	INTEGRATION_SECTIONS,
	IntegrationConnectionState,
	QUICK_ADD_INTEGRATION_IDS,
	resolveIntegrations,
} from "../../integrations/catalog";

interface IntegrationsPageProps {
	channels: Channel[];
	integrationConnectionState: IntegrationConnectionState;
	onChannelConnect: (channelId: string) => Promise<void>;
	onRefreshChannels: () => Promise<void> | void;
	onConnectIntegration: (integrationId: string) => Promise<void> | void;
	onDisconnectIntegration: (integrationId: string) => Promise<void> | void;
}

const IntegrationsPage: React.FC<IntegrationsPageProps> = ({
	channels,
	integrationConnectionState,
	onChannelConnect,
	onRefreshChannels,
	onConnectIntegration,
	onDisconnectIntegration,
}) => {
	const [query, setQuery] = useState("");
	const [connectingId, setConnectingId] = useState<string | null>(null);
	const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState("");

	const integrations = useMemo(
		() =>
			filterIntegrations(resolveIntegrations(channels, integrationConnectionState), query).filter(
				(integration) => !QUICK_ADD_INTEGRATION_IDS.includes(integration.id as (typeof QUICK_ADD_INTEGRATION_IDS)[number])
			),
		[channels, integrationConnectionState, query]
	);

	const groupedIntegrations = useMemo(
		() =>
			INTEGRATION_SECTIONS.map((section) => ({
				...section,
				items: integrations.filter((integration) => integration.section === section.id),
			})).filter((section) => section.items.length > 0),
		[integrations]
	);

	const showToast = (message: string) => {
		setToastMessage(message);
		window.setTimeout(() => setToastMessage(""), 2400);
	};

	const handleConnect = async (integrationId: string) => {
		const integration = integrations.find((item) => item.id === integrationId);
		if (!integration || integration.status !== "available") {
			return;
		}

		const connectableChannelId = getConnectableChannelId(integration);
		setConnectingId(integrationId);
		try {
			if (connectableChannelId) {
				await onChannelConnect(connectableChannelId);
				await onRefreshChannels();
			} else {
				await onConnectIntegration(integration.id);
			}
			showToast(`${integration.name} connected successfully.`);
		} catch (error) {
			console.error("Failed to connect integration:", error);
			showToast(`Unable to connect ${integration.name} right now.`);
		} finally {
			setConnectingId(null);
		}
	};

	const handleDisconnect = async (integrationId: string) => {
		const integration = integrations.find((item) => item.id === integrationId);
		if (!integration || integration.status !== "connected") {
			return;
		}

		const connectableChannelId = getConnectableChannelId(integration);
		setDisconnectingId(integrationId);
		try {
			if (connectableChannelId && integration.channel) {
				showToast(`Disconnect ${integration.name} from Channels soon.`);
				return;
			}

			await onDisconnectIntegration(integration.id);
			showToast(`${integration.name} disconnected.`);
		} catch (error) {
			console.error("Failed to disconnect integration:", error);
			showToast(`Unable to disconnect ${integration.name} right now.`);
		} finally {
			setDisconnectingId(null);
		}
	};

	return (
		<div className="integrations-page">
			<div className="integrations-page-shell">
				<div className="integrations-page-header">
					<div className="integrations-page-copy">
						<h1>Integrations</h1>
						<p>Add integrations to this ad account to make Raya more intelligent. Integrations are shared within the workspace.</p>
					</div>
					<label className="integrations-search" aria-label="Search integrations">
						<Search size={18} />
						<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search integrations..." />
					</label>
				</div>
				{groupedIntegrations.map((section) => (
					<section key={section.id} className="integrations-section">
						<h2>{section.label}</h2>
						<div className="integrations-grid">
							{section.items.map((integration) => {
								const isConnecting = connectingId === integration.id;
								const isDisconnecting = disconnectingId === integration.id;
								const isConnected = integration.status === "connected";
								const isAvailable = integration.status === "available";
								return (
									<div key={integration.id} className={`integration-card ${isConnected ? "is-connected" : ""}`}>
										<div className="integration-card-top">
											<div className="integration-card-logo">{integration.renderLogo(44)}</div>
											{isConnected ? (
												<div className="integration-card-status">
													<div className="integration-card-status-badge">
														<Check size={14} />
														<span>Connected</span>
													</div>
													<button
														type="button"
														className="integration-card-action disconnect"
														disabled={isDisconnecting}
														onClick={() => handleDisconnect(integration.id)}
													>
														{isDisconnecting ? "Disconnecting..." : "Disconnect"}
													</button>
												</div>
											) : (
												<button
													type="button"
													className={`integration-card-action ${isAvailable ? "connect" : "request"}`}
													disabled={!isAvailable || isConnecting}
													onClick={() => handleConnect(integration.id)}
												>
													{isConnecting ? "Connecting..." : isAvailable ? "Connect" : "Request Access"}
												</button>
											)}
										</div>
										<div className="integration-card-content">
											<h3>{integration.name}</h3>
											<p>{integration.description}</p>
										</div>
									</div>
								);
							})}
						</div>
					</section>
				))}

				{groupedIntegrations.length === 0 && (
					<div className="integrations-empty-state">
						<p>No integrations match your search yet.</p>
					</div>
				)}
			</div>

			{toastMessage && (
				<div className="toast-notification">
					<ShieldCheck size={16} />
					<span>{toastMessage}</span>
				</div>
			)}
		</div>
	);
};

export default IntegrationsPage;
