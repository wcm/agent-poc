import React, { useEffect, useMemo, useState } from "react";
import { Check, MoreHorizontal, ShieldCheck, X } from "lucide-react";
import { ResolvedIntegration } from "../../integrations/catalog";

interface MyConnectionsModalProps {
	isOpen: boolean;
	connections: ResolvedIntegration[];
	onClose: () => void;
	onConnectConnection: (connectionId: string) => Promise<void> | void;
	onDisconnectConnection: (connectionId: string) => Promise<void> | void;
}

const MyConnectionsModal: React.FC<MyConnectionsModalProps> = ({ isOpen, connections, onClose, onConnectConnection, onDisconnectConnection }) => {
	const [connectingId, setConnectingId] = useState<string | null>(null);
	const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
	const [openMenuId, setOpenMenuId] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState("");
	const resolvedConnections = useMemo(() => connections.filter((connection) => connection.section === "myConnections"), [connections]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest(".integration-card-menu")) {
				return;
			}

			setOpenMenuId(null);
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	useEffect(() => {
		if (!toastMessage) {
			return;
		}

		const timeoutId = window.setTimeout(() => setToastMessage(""), 2400);
		return () => window.clearTimeout(timeoutId);
	}, [toastMessage]);

	if (!isOpen) {
		return null;
	}

	const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (event.target === event.currentTarget) {
			onClose();
		}
	};

	const handleConnect = async (connectionId: string) => {
		const connection = resolvedConnections.find((item) => item.id === connectionId);
		if (!connection || connection.status !== "available") {
			return;
		}

		setConnectingId(connectionId);
		try {
			await onConnectConnection(connectionId);
			setToastMessage(`${connection.name} connected successfully.`);
		} catch (error) {
			console.error("Failed to connect connection:", error);
			setToastMessage(`Unable to connect ${connection.name} right now.`);
		} finally {
			setConnectingId(null);
		}
	};

	const handleDisconnect = async (connectionId: string) => {
		const connection = resolvedConnections.find((item) => item.id === connectionId);
		if (!connection || connection.status !== "connected") {
			return;
		}

		setDisconnectingId(connectionId);
		setOpenMenuId(null);
		try {
			await onDisconnectConnection(connectionId);
			setToastMessage(`${connection.name} disconnected.`);
		} catch (error) {
			console.error("Failed to disconnect connection:", error);
			setToastMessage(`Unable to disconnect ${connection.name} right now.`);
		} finally {
			setDisconnectingId(null);
		}
	};

	const handleConnectedAction = (connectionName: string, action: "manage" | "add") => {
		setOpenMenuId(null);
		setToastMessage(action === "manage" ? `Manage accounts for ${connectionName} coming soon.` : `Add account for ${connectionName} coming soon.`);
	};

	return (
		<div className="my-connections-backdrop" onClick={handleBackdropClick}>
			<div className="my-connections-modal" role="dialog" aria-modal="true" aria-labelledby="my-connections-title">
				<div className="my-connections-header">
					<div className="my-connections-header-copy">
						<h2 id="my-connections-title">My Connections</h2>
						<p>Power up your workflow with Raya by connecting your essential platforms.</p>
					</div>
					<button type="button" className="my-connections-close-btn" onClick={onClose} aria-label="Close my connections">
						<X size={24} />
					</button>
				</div>

				<div className="my-connections-list">
					{resolvedConnections.map((connection) => {
						const isConnecting = connectingId === connection.id;
						const isDisconnecting = disconnectingId === connection.id;
						const isConnected = connection.status === "connected";
						return (
							<div key={connection.id} className="my-connection-card">
								<div className="my-connection-card-main">
									<div className="my-connection-card-logo">{connection.renderLogo(40, "bare")}</div>
									<div className="my-connection-card-copy">
										<div className="integration-card-title-row">
											<strong>{connection.name}</strong>
											{isConnected && (
												<div className="integration-card-connected-label">
													<Check size={12} />
													<span>Connected</span>
												</div>
											)}
										</div>
										<p>{connection.description}</p>
									</div>
								</div>
								{isConnected ? (
									<div className="integration-card-menu">
										<button
											type="button"
											className={`integration-card-menu-trigger ${openMenuId === connection.id ? "is-open" : ""}`}
											aria-label={`Manage ${connection.name}`}
											onClick={() => setOpenMenuId((current) => (current === connection.id ? null : connection.id))}
										>
											<MoreHorizontal size={16} />
										</button>
										{openMenuId === connection.id && (
											<div className="integration-card-menu-dropdown">
												<button type="button" onClick={() => handleConnectedAction(connection.name, "manage")}>
													Manage accounts
												</button>
												<button type="button" onClick={() => handleConnectedAction(connection.name, "add")}>
													Add account
												</button>
												<button
													type="button"
													className="danger"
													disabled={isDisconnecting}
													onClick={() => handleDisconnect(connection.id)}
												>
													{isDisconnecting ? "Deleting..." : "Delete all"}
												</button>
											</div>
										)}
									</div>
								) : (
									<button
										type="button"
										className={`my-connection-card-action ${isConnected ? "connected" : ""}`}
										disabled={isConnected || connection.status !== "available" || isConnecting}
										onClick={() => handleConnect(connection.id)}
									>
										{isConnecting ? "Connecting..." : isConnected ? "Connected" : connection.status === "coming_soon" ? "Coming Soon" : "Connect"}
									</button>
								)}
							</div>
						);
					})}
				</div>
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

export default MyConnectionsModal;
