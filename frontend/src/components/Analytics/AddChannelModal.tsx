import React, { useMemo, useState } from "react";
import { X, Check } from "lucide-react";
import { Channel } from "../../types";
import { INTEGRATION_SECTIONS, getConnectableChannelId, resolveIntegrations } from "../../integrations/catalog";

interface AddChannelModalProps {
	isOpen: boolean;
	onClose: () => void;
	channels: Channel[];
	onChannelSelect: (channelId: string) => void;
	onChannelConnect: (channelId: string) => Promise<void>;
	onRefreshChannels: () => Promise<void> | void;
}

const AddChannelModal: React.FC<AddChannelModalProps> = ({ isOpen, onClose, channels, onChannelSelect, onChannelConnect, onRefreshChannels }) => {
	const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
	const [connecting, setConnecting] = useState<string | null>(null);

	const integrationsBySection = useMemo(
		() =>
			INTEGRATION_SECTIONS.map((section) => ({
				...section,
				items: resolveIntegrations(channels).filter((integration) => integration.section === section.id),
			})).filter((section) => section.items.length > 0),
		[channels]
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
		const integration = resolveIntegrations(channels).find((item) => item.id === integrationId);
		if (!integration) {
			return;
		}

		if (integration.status === "coming_soon") {
			return;
		}

		if (integration.status === "connected" && integration.channel) {
			onChannelSelect(integration.channel.id);
			onClose();
			return;
		}

		const connectableChannelId = getConnectableChannelId(integration);
		if (!connectableChannelId) {
			return;
		}

		setConnecting(integration.id);
		try {
			await onChannelConnect(connectableChannelId);
			await onRefreshChannels();
			showToast(`${integration.name} connected successfully!`);
			window.setTimeout(() => {
				onChannelSelect(connectableChannelId);
				onClose();
			}, 900);
		} catch (error) {
			console.error("Failed to connect channel:", error);
			showToast("Failed to connect channel. Please try again.");
		} finally {
			setConnecting(null);
		}
	};

	return (
		<div className="add-channel-backdrop" onClick={handleBackdropClick}>
			<div className="add-channel-modal">
				<div className="add-channel-header">
					<h2>Add Channel</h2>
					<button className="close-btn" onClick={onClose}>
						<X size={20} />
					</button>
				</div>
				<p className="add-channel-subtitle">Connect your marketing channels to unlock insights</p>

				<div className="channel-categories">
					{integrationsBySection.map((section) => (
						<div key={section.id} className="channel-category">
							<div className="category-name">{section.label}</div>
							<div className="channel-chips">
								{section.items.map((integration) => {
									const isConnecting = connecting === integration.id;
									return (
										<button
											key={integration.id}
											className={`channel-chip ${isConnecting ? "connecting" : ""} ${integration.status === "connected" ? "connected" : ""}`}
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

export default AddChannelModal;
