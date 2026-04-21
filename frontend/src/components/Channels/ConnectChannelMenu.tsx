import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Channel } from "../../types";
import { getConnectableChannelId, getQuickAddIntegrations } from "../../integrations/catalog";

interface ConnectChannelMenuProps {
	channels: Channel[];
	onChannelConnect: (channelId: string) => Promise<void>;
	onRefreshChannels: () => Promise<void> | void;
	onChannelSelect?: (channelId: string) => void;
	buttonClassName?: string;
	menuClassName?: string;
}

const MetaMenuIcon = () => (
	<svg width="18" height="18" viewBox="0 0 64 40" fill="none" aria-hidden="true">
		<path
			d="M14.5 31.5c4.4 0 7.5-7 12.5-16.7 4.4-8.6 7.1-13 10.6-13 3.1 0 5.6 3.8 8.7 10.1l7.2 14.7c1 2.1 2.1 4.9 5.4 4.9 2.8 0 4.9-2 4.9-4.9 0-1.4-.4-2.7-1-4L55.8 9.8C51.5 1.6 46.8 0 42.1 0c-6.8 0-11 5.7-15.2 13.8l-2 3.9-1.8-3.6C18.9 5.9 14.8 0 8 0 3.2 0 0 2.6 0 7.2c0 3.2 1.9 5.8 5.1 5.8 3.7 0 5.7-4.5 8.6-4.5 2.1 0 4.1 2.1 7.3 8.2l1.4 2.8-1.6 3.2c-3.1 6.1-4.9 8.8-6.3 8.8-2.8 0-4.9-6.2-9.8-6.2C1.8 25.3 0 27.6 0 30.8 0 36.1 4.5 40 10.7 40c5.5 0 8.9-3 13-8.5l2.8-3.7 2 3C31.7 35.9 35.4 40 41.3 40c4.7 0 8.1-2.6 8.1-6.7 0-2.9-2-5.1-5.1-5.1-4 0-5.5 3.3-8.8 3.3-2.1 0-4.1-1.8-7-7.3l-1.5-3 1.7-3.2c3.7-6.9 5.7-10.4 7.2-10.4 1.5 0 3.2 3.2 6 8.8l7 13.8c2.9 5.6 6.1 9.8 12.1 9.8 4.8 0 8-3.2 8-8.1 0-2.2-.6-4.2-1.6-6.3L58.5 7.4C53.9-1.3 48.4-4 42-4 34-4 29.8 1.6 24.8 11.4l-3.1 6-1.8-3.6C15.5 5.1 11.9.5 6.5.5 1.9.5-1.6 3.6-1.6 8c0 3 1.9 5.1 4.8 5.1 3.5 0 5.1-3.6 8.2-3.6 2 0 4 2 6.8 7.6l1.7 3.4-1.8 3.6c-2.7 5.3-4.2 7.4-5.6 7.4-3.2 0-5-4.2-9.3-4.2-3.4 0-5.5 2.3-5.5 5.9 0 5.6 4.7 9.5 11.4 9.5 5.9 0 9.8-3.2 14.4-9.2l2.5-3.2 2 2.8C31.9 37.3 35.9 41 42.3 41c5.5 0 9.4-3.1 9.4-7.8 0-3.4-2.4-6-6.1-6-4.4 0-5.7 3.4-8.6 3.4-1.7 0-3.5-1.8-6.3-7.1l-1.4-2.6 1.5-2.9c4-7.5 6.1-11 7.6-11 1.6 0 3.4 3 6.4 9.1l7 14c1 2 2 4.2 4.7 4.2 2.1 0 3.5-1.4 3.5-3.6 0-1.1-.4-2.3-1-3.6L52 10.8C48.7 4.1 44.7 1.6 40.4 1.6c-6.1 0-9.6 5.1-14.3 14.3-4.8 9.4-7.5 15.6-11.6 15.6z"
			fill="#0866FF"
		/>
	</svg>
);

const TikTokMenuIcon = () => (
	<svg width="18" height="18" viewBox="0 0 24 32" fill="none" aria-hidden="true">
		<path d="M13.8 0h4.6c.5 4.5 3 7.2 7.6 7.6v4.6c-2.8.1-5.2-.5-7.6-1.9V22c0 6.1-4.8 10-10.4 10C3.1 32 0 28.4 0 23.8 0 18.7 3.7 15 9 15c.9 0 1.5.1 2.2.3v4.7c-.7-.2-1.2-.3-1.9-.3-2.6 0-4.5 1.6-4.5 4 0 2.5 1.8 4 4.3 4 2.9 0 4.7-1.9 4.7-5.1V0z" fill="#25F4EE" />
		<path d="M12.6 0h4.6c.5 4.5 3 7.2 7.6 7.6v4.6c-2.8.1-5.2-.5-7.6-1.9V22c0 6.1-4.8 10-10.4 10C2.8 32 0 29 0 24.7c0-4.9 3.4-8.7 8.8-8.7.8 0 1.6.1 2.4.3v4.7c-.7-.3-1.4-.4-2.1-.4-2.5 0-4.3 1.5-4.3 4 0 2.2 1.6 3.9 3.9 3.9 3 0 4.8-1.9 4.8-5.1V0z" fill="#FE2C55" fillOpacity=".82" />
		<path d="M13.2 0h4.2c.4 3.6 2.5 5.8 6.6 6.2v3.8c-2.5.1-4.6-.5-6.6-1.6V22c0 5.6-4.4 9.2-9.7 9.2C3.1 31.2 0 28 0 23.5c0-4.7 3.4-8.2 8.4-8.2.8 0 1.5.1 2.2.3V20c-.6-.2-1.1-.3-1.7-.3-2.4 0-4.2 1.5-4.2 3.9s1.7 3.9 4.1 3.9c2.9 0 4.4-1.7 4.4-5V0z" fill="#0F172A" />
	</svg>
);

const ConnectChannelMenu: React.FC<ConnectChannelMenuProps> = ({
	channels,
	onChannelConnect,
	onRefreshChannels,
	onChannelSelect,
	buttonClassName = "page-connect-menu-btn",
	menuClassName = "page-connect-menu-dropdown",
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [connectingId, setConnectingId] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const quickAddIntegrations = useMemo(() => getQuickAddIntegrations(channels), [channels]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleOptionClick = async (integrationId: string) => {
		const integration = quickAddIntegrations.find((item) => item.id === integrationId);
		if (!integration) {
			return;
		}

		if (integration.isConnected && integration.channel) {
			onChannelSelect?.(integration.channel.id);
			setIsOpen(false);
			return;
		}

		const connectableChannelId = getConnectableChannelId(integration);
		if (!connectableChannelId) {
			return;
		}

		setConnectingId(integration.id);
		try {
			await onChannelConnect(connectableChannelId);
			await onRefreshChannels();
			onChannelSelect?.(connectableChannelId);
			setIsOpen(false);
		} catch (error) {
			console.error("Failed to connect channel:", error);
		} finally {
			setConnectingId(null);
		}
	};

	return (
		<div className="page-connect-menu" ref={containerRef}>
			<button type="button" className={buttonClassName} aria-label="Add channel account" onClick={() => setIsOpen((prev) => !prev)}>
				<Plus size={16} />
			</button>
			{isOpen && (
				<div className={menuClassName}>
						{quickAddIntegrations.map((integration) => (
							<button key={integration.id} type="button" className="page-connect-menu-item" onClick={() => handleOptionClick(integration.id)} disabled={connectingId === integration.id}>
								<span className="page-connect-menu-item-icon">{integration.id === "meta_ads" ? <MetaMenuIcon /> : <TikTokMenuIcon />}</span>
								<span>{integration.name === "Meta Ads" ? "Add Meta Ads Account" : "Add Tiktok Ads Account"}</span>
							</button>
						))}
				</div>
			)}
		</div>
	);
};

export default ConnectChannelMenu;
