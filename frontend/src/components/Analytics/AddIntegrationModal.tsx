import React, { useMemo, useState } from "react";
import { X, Check } from "lucide-react";
import { Integration } from "../../types";
import { INTEGRATIONS_PAGE_SECTIONS, getConnectableIntegrationId, resolveIntegrations } from "../../integrations/catalog";

interface AddIntegrationModalProps {
	isOpen: boolean;
	onClose: () => void;
	integrations: Integration[];
	onIntegrationSelect: (integrationId: string) => void;
	onIntegrationConnect: (integrationId: string) => Promise<void>;
	onRefreshIntegrations: () => Promise<void> | void;
}

const AddIntegrationModal: React.FC<AddIntegrationModalProps> = ({ isOpen, onClose, integrations, onIntegrationSelect, onIntegrationConnect, onRefreshIntegrations }) => {
	const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
	const [connecting, setConnecting] = useState<string | null>(null);

	const integrationsBySection = useMemo(
		() =>
			INTEGRATIONS_PAGE_SECTIONS.map((section) => ({
				...section,
				items: resolveIntegrations(integrations).filter((integration) => integration.section === section.id),
			})).filter((section) => section.items.length > 0),
		[integrations]
	);

	if (!isOpen) return null;

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	const showToast = (message: string) => {
		setToast({ message, visible: true });
		window.setTimeout(() => setToast({ message: "", visible: false }), 3000);
	};

	const handleIntegrationClick = async (integrationId: string) => {
		const integration = resolveIntegrations(integrations).find((item) => item.id === integrationId);
		if (!integration) {
			return;
		}

		if (integration.status === "coming_soon") {
			return;
		}

		if (integration.status === "connected" && integration.integration) {
			onIntegrationSelect(integration.integration.id);
			onClose();
			return;
		}

		const connectableIntegrationId = getConnectableIntegrationId(integration);
		if (!connectableIntegrationId) {
			return;
		}

		setConnecting(integration.id);
		try {
			await onIntegrationConnect(connectableIntegrationId);
			await onRefreshIntegrations();
			showToast(`${integration.name} connected successfully!`);
			window.setTimeout(() => {
				onIntegrationSelect(connectableIntegrationId);
				onClose();
			}, 900);
		} catch (error) {
			console.error("Failed to connect integration:", error);
			showToast("Failed to connect integration. Please try again.");
		} finally {
			setConnecting(null);
		}
	};

	return (
		<div className="add-integration-backdrop" onClick={handleBackdropClick}>
			<div className="add-integration-modal">
				<div className="add-integration-header">
					<h2>Add Integration</h2>
					<button className="close-btn" onClick={onClose}>
						<X size={20} />
					</button>
				</div>
				<p className="add-integration-subtitle">Connect your integrations to unlock insights</p>

				<div className="integration-categories">
					{integrationsBySection.map((section) => (
						<div key={section.id} className="integration-category">
							<div className="category-name">{section.label}</div>
							<div className="integration-chips">
								{section.items.map((integration) => {
									const isConnecting = connecting === integration.id;
									return (
										<button
											key={integration.id}
											className={`integration-chip ${isConnecting ? "connecting" : ""} ${integration.status === "connected" ? "connected" : ""}`}
											onClick={() => handleIntegrationClick(integration.id)}
										>
											<span className="chip-icon">{integration.renderLogo(20)}</span>
											<span className="chip-name">{integration.name}</span>
											{integration.status === "connected" && <span className="chip-badge connected">Connected</span>}
											{integration.status === "coming_soon" && <span className="chip-badge">Soon</span>}
											{isConnecting && <span className="chip-connecting">...</span>}
										</button>
									);
								})}
							</div>
						</div>
					))}
				</div>

				{toast.visible && (
					<div className="toast-notification">
						<Check size={16} />
						<span>{toast.message}</span>
					</div>
				)}
			</div>
		</div>
	);
};

export default AddIntegrationModal;
