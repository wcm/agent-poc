import React, { useEffect, useMemo, useState } from "react";
import { Check, MoreHorizontal, Search, ShieldCheck } from "lucide-react";
import { Integration } from "../../types";
import {
	filterIntegrations,
	getConnectableIntegrationId,
	INTEGRATIONS_PAGE_SECTIONS,
	IntegrationState,
	resolveIntegrations,
} from "../../integrations/catalog";

interface IntegrationsPageProps {
	integrations: Integration[];
	integrationState: IntegrationState;
	onIntegrationConnect: (integrationId: string) => Promise<void>;
	onIntegrationDisconnect: (integrationId: string) => Promise<void>;
	onRefreshIntegrations: () => Promise<void> | void;
	onConnectIntegration: (integrationId: string) => Promise<void> | void;
	onDisconnectIntegration: (integrationId: string) => Promise<void> | void;
}

const IntegrationsPage: React.FC<IntegrationsPageProps> = ({
	integrations,
	integrationState,
	onIntegrationConnect,
	onIntegrationDisconnect,
	onRefreshIntegrations,
	onConnectIntegration,
	onDisconnectIntegration,
}) => {
	const [query, setQuery] = useState("");
	const [connectingId, setConnectingId] = useState<string | null>(null);
	const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
	const [openMenuId, setOpenMenuId] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState("");

	const resolvedIntegrations = useMemo(() => filterIntegrations(resolveIntegrations(integrations, integrationState), query), [integrations, integrationState, query]);

	const groupedIntegrations = useMemo(
		() =>
			INTEGRATIONS_PAGE_SECTIONS.map((section) => ({
				...section,
				items: resolvedIntegrations.filter((integration) => integration.section === section.id),
			})).filter((section) => section.items.length > 0),
		[resolvedIntegrations]
	);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest(".integration-card-menu")) {
				return;
			}

			setOpenMenuId(null);
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const showToast = (message: string) => {
		setToastMessage(message);
		window.setTimeout(() => setToastMessage(""), 2400);
	};

	const handleConnect = async (integrationId: string) => {
		const integration = resolvedIntegrations.find((item) => item.id === integrationId);
		if (!integration || integration.status !== "available") {
			return;
		}

		const connectableIntegrationId = getConnectableIntegrationId(integration);
		setConnectingId(integrationId);
		try {
			if (connectableIntegrationId) {
				await onIntegrationConnect(connectableIntegrationId);
				await onRefreshIntegrations();
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
		const integration = resolvedIntegrations.find((item) => item.id === integrationId);
		if (!integration || integration.status !== "connected") {
			return;
		}

		const connectableIntegrationId = getConnectableIntegrationId(integration);
		setDisconnectingId(integrationId);
		setOpenMenuId(null);
		try {
			if (connectableIntegrationId && integration.integration) {
				await onIntegrationDisconnect(connectableIntegrationId);
				await onDisconnectIntegration(integration.id);
				await onRefreshIntegrations();
			} else {
				await onDisconnectIntegration(integration.id);
			}
			showToast(`${integration.name} disconnected.`);
		} catch (error) {
			console.error("Failed to disconnect integration:", error);
			showToast(`Unable to disconnect ${integration.name} right now.`);
		} finally {
			setDisconnectingId(null);
		}
	};

	const handleConnectedAction = (integrationName: string, action: "manage" | "add") => {
		setOpenMenuId(null);
		showToast(action === "manage" ? `Manage accounts for ${integrationName} coming soon.` : `Add account for ${integrationName} coming soon.`);
	};

	return (
		<div className="integrations-page">
			<div className="integrations-page-shell">
				<div className="integrations-page-header">
					<div className="integrations-page-copy">
						<h1>Integrations</h1>
						<p>Connect data sources and tools that help Raya work across your team.</p>
					</div>
					<label className="workspace-search" aria-label="Search integrations">
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
								const description = isConnected && integration.connectedAccountName ? `Connected account: ${integration.connectedAccountName}` : integration.description;
								return (
									<div
										key={integration.id}
										className={`integration-card ${isConnected ? "is-connected" : ""} ${
											integration.status === "coming_soon" ? "is-coming-soon" : ""
										}`}
									>
										<div className="integration-card-top">
											<div className="integration-card-logo">{integration.renderLogo(44)}</div>
											{isConnected ? (
												<div className="integration-card-menu">
													<button
														type="button"
														className={`integration-card-menu-trigger ${openMenuId === integration.id ? "is-open" : ""}`}
														aria-label={`Manage ${integration.name}`}
														onClick={() => setOpenMenuId((current) => (current === integration.id ? null : integration.id))}
													>
														<MoreHorizontal size={16} />
													</button>
													{openMenuId === integration.id && (
														<div className="integration-card-menu-dropdown">
															<button type="button" onClick={() => handleConnectedAction(integration.name, "manage")}>
																Manage accounts
															</button>
															<button type="button" onClick={() => handleConnectedAction(integration.name, "add")}>
																Add account
															</button>
															<button
																type="button"
																className="danger"
																disabled={isDisconnecting}
																onClick={() => handleDisconnect(integration.id)}
															>
																{isDisconnecting ? "Deleting..." : "Delete all"}
															</button>
														</div>
													)}
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
											<div className="integration-card-title-row">
												<h3>{integration.name}</h3>
												{isConnected && (
													<div className="integration-card-connected-label">
														<Check size={12} />
														<span>Connected</span>
													</div>
												)}
											</div>
											<p className={isConnected && integration.connectedAccountName ? "is-connected-account" : ""}>{description}</p>
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
