import React, { useState, useEffect } from "react";
import { PlusSquare, User, PanelLeftClose, PanelLeftOpen, Plus, Globe, Heart, Bookmark } from "lucide-react";
import BrandSelector from "./BrandSelector";
import { Session } from "../../types";
import AddChannelModal from "../Analytics/AddChannelModal";
import logoBrand from "../../assets/logo-brand.svg";
import logoWhite from "../../assets/logo-white.svg";

// Atria logo icon - uses different SVG based on active state
const AtriaIcon = ({ filled }: { filled?: boolean }) => <img src={filled ? logoBrand : logoWhite} alt="Atria" width="22" height="22" />;

const CompassIcon = ({ filled }: { filled?: boolean }) => (
	<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<circle cx="12" cy="12" r="10" fill={filled ? "currentColor" : "none"} />
		<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={filled ? "#1e293b" : "currentColor"} stroke={filled ? "#1e293b" : "currentColor"} />
	</svg>
);

const AnalyticsIcon = ({ filled }: { filled?: boolean }) => (
	<svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<rect x="3" y="12" width="4" height="9" rx="1" fill={filled ? "currentColor" : "none"} />
		<rect x="10" y="8" width="4" height="13" rx="1" fill={filled ? "currentColor" : "none"} />
		<rect x="17" y="3" width="4" height="18" rx="1" fill={filled ? "currentColor" : "none"} />
	</svg>
);

const FolderIcon = ({ filled }: { filled?: boolean }) => (
	<svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
	</svg>
);

const RocketIcon = ({ filled }: { filled?: boolean }) => (
	<svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" fill={filled ? "currentColor" : "none"} />
		<path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
		<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
		<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
	</svg>
);

// Platform icons
const MetaIcon = () => <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQoqP_1QDPvtErnUpBxJrxH33nx7zB9-7m2-w&s" alt="Meta" width="16" height="16" style={{ objectFit: "contain" }} />;

const TikTokIcon = () => <img src="https://i.pinimg.com/1200x/40/21/63/4021636b5d203c1aba86e2643a30b87c.jpg" alt="TikTok" width="16" height="16" style={{ objectFit: "contain" }} />;

const getPlatformIcon = (platform: string) => {
	switch (platform) {
		case "meta":
			return <MetaIcon />;
		case "tiktok":
			return <TikTokIcon />;
		default:
			return <MetaIcon />;
	}
};

export interface Channel {
	id: string;
	name: string;
	platform: string;
	account_id: string;
	is_connected: boolean;
}

interface SidebarProps {
	activeTab: string;
	onTabChange: (tab: string) => void;
	activeBrand: string;
	onBrandChange: (brand: string) => void;
	sessions: Session[];
	activeSessionId: string | null;
	onSessionSelect: (id: string) => void;
	onNewSession: () => void;
	isCollapsed: boolean;
	onToggleCollapse: () => void;
	activeInspirationTab?: string;
	onInspirationTabChange?: (tab: string) => void;
	// Analytics props
	channels?: Channel[];
	activeChannelId?: string;
	onChannelSelect?: (channelId: string) => void;
	onChannelConnect?: (channelId: string) => Promise<void>;
	onRefreshChannels?: () => void;
	// Loading state
	isLoading?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
	activeTab,
	onTabChange,
	activeBrand,
	onBrandChange,
	sessions,
	activeSessionId,
	onSessionSelect,
	onNewSession,
	isCollapsed,
	onToggleCollapse,
	activeInspirationTab,
	onInspirationTabChange,
	channels = [],
	activeChannelId,
	onChannelSelect,
	onChannelConnect,
	onRefreshChannels,
	isLoading = false,
}) => {
	const [addChannelOpen, setAddChannelOpen] = useState(false);
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	// Auto-dismiss toast after 3 seconds
	useEffect(() => {
		if (toastMessage) {
			const timer = setTimeout(() => setToastMessage(null), 3000);
			return () => clearTimeout(timer);
		}
	}, [toastMessage]);

	const handleNewTaskClick = () => {
		if (isLoading) {
			setToastMessage("Please wait for the current task to finish...");
			return;
		}
		onNewSession();
	};

	const navItems = [
		{ id: "atria", icon: AtriaIcon, label: "Atria" },
		{ id: "inspirations", icon: CompassIcon, label: "Inspirations" },
		{ id: "analytics", icon: AnalyticsIcon, label: "Analytics" },
		{ id: "files", icon: FolderIcon, label: "Files" },
		{ id: "launch", icon: RocketIcon, label: "Launch" },
	];

	return (
		<div className={`sidebar-container ${isCollapsed ? "collapsed" : ""}`}>
			{/* Brand Selector Area - Now top of sidebar stack */}
			<div className="sidebar-top-section">
				<BrandSelector activeBrand={activeBrand} onBrandChange={onBrandChange} isCollapsed={isCollapsed} />
			</div>

			<div className="sidebar-body">
				{/* Level 1 Sidebar */}
				<div className="sidebar-l1">
					<div className="l1-nav-items">
						{navItems.map((item) => (
							<div key={item.id} className={`l1-item ${activeTab === item.id ? "active" : ""}`} onClick={() => onTabChange(item.id)} title={item.label}>
								<item.icon filled={activeTab === item.id} />
							</div>
						))}
					</div>

					<div className="l1-footer">
						<div className="l1-item user-profile" title="Profile">
							<User size={22} />
						</div>
						<div className="l1-item collapse-toggle" onClick={onToggleCollapse} title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
							{isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
						</div>
					</div>
				</div>

				{/* Level 2 Sidebar - Hidden if collapsed */}
				{!isCollapsed && (
					<div className="sidebar-l2">
						<div className="l2-header">
							<span className="l2-title">{navItems.find((i) => i.id === activeTab)?.label}</span>
						</div>

						<div className="l2-content">
							{activeTab === "atria" && (
								<>
									<div className={`new-task-btn ${isLoading ? "disabled" : ""}`} onClick={handleNewTaskClick}>
										<PlusSquare size={16} />
										<span>New Task</span>
									</div>

									<div className="section-label">Tasks</div>
									<div className="session-list">
										{sessions.map((session) => (
											<div key={session.id} className={`session-item ${activeSessionId === session.id ? "active" : ""}`} onClick={() => onSessionSelect(session.id)}>
												{session.title}
											</div>
										))}
										{sessions.length === 0 && <div className="empty-sessions">No tasks yet</div>}
									</div>
								</>
							)}

							{activeTab === "inspirations" && (
								<>
									<div className="session-list" style={{ marginTop: "4px" }}>
										<div className={`session-item ${activeInspirationTab === "discovery" ? "active" : ""}`} onClick={() => onInspirationTabChange?.("discovery")}>
											<Globe size={16} />
											Discovery
										</div>
										<div className={`session-item ${activeInspirationTab === "following_brands" ? "active" : ""}`} onClick={() => onInspirationTabChange?.("following_brands")}>
											<Heart size={16} />
											Following Brands
										</div>
										<div className={`session-item ${activeInspirationTab === "saved_ads" ? "active" : ""}`} onClick={() => onInspirationTabChange?.("saved_ads")}>
											<Bookmark size={16} />
											Saved Ads
										</div>
									</div>
								</>
							)}

							{activeTab === "analytics" && (
								<>
									<div className="new-task-btn" onClick={() => setAddChannelOpen(true)}>
										<Plus size={16} />
										<span>Add Channel</span>
									</div>
									<div className="section-label">Dashboards</div>
									<div className="session-list">
										{channels
											.filter((c) => c.is_connected)
											.map((channel) => (
												<div
													key={channel.id}
													className={`session-item channel-item ${activeChannelId === channel.id ? "active" : ""}`}
													onClick={() => onChannelSelect?.(channel.id)}
												>
													{getPlatformIcon(channel.platform)}
													<span>{channel.name}</span>
												</div>
											))}
										{channels.filter((c) => c.is_connected).length === 0 && <div className="empty-sessions">No channels connected</div>}
									</div>
									<AddChannelModal
										isOpen={addChannelOpen}
										onClose={() => setAddChannelOpen(false)}
										channels={channels}
										onChannelSelect={(id) => onChannelSelect?.(id)}
										onChannelConnect={onChannelConnect || (async () => {})}
										onRefreshChannels={onRefreshChannels || (() => {})}
									/>
								</>
							)}

							{activeTab !== "atria" && activeTab !== "inspirations" && activeTab !== "analytics" && <div className="coming-soon">Nothing here yet.</div>}
						</div>
					</div>
				)}
			</div>

			{/* Toast notification */}
			{toastMessage && <div className="toast-notification">{toastMessage}</div>}
		</div>
	);
};

export default Sidebar;
