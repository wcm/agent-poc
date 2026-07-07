import React, { useMemo, useState } from "react";
import { BookOpenText, House, User, PanelLeftClose, PanelLeftOpen, Globe, Heart, Bookmark, LayoutDashboard, Clock3, ChevronDown, Image as ImageIcon } from "lucide-react";
import BrandSelector from "./BrandSelector";
import { AnalyticsDashboardView, Integration, RayaView, Session } from "../../types";
import { AutomationDefinition, getUniqueAutomations } from "../../automations/catalog";
import ConnectIntegrationMenu from "../Integrations/ConnectIntegrationMenu";
import RayaLogo from "../icons/RayaLogo";
import IntegrationsIcon from "../icons/IntegrationsIcon";

const RayaIcon = ({ filled }: { filled?: boolean }) => <RayaLogo size={22} variant={filled ? "color" : "mono"} />;

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
	activeRayaView?: RayaView;
	onRayaViewChange?: (view: RayaView) => void;
	automations?: AutomationDefinition[];
	activeAutomationId?: string | null;
	activeAutomationMode?: "overview" | "details" | "run";
	onAutomationSelect?: (automationId: string | null) => void;
	onAutomationModeChange?: (mode: "overview" | "details" | "run") => void;
	activeAnalyticsView?: AnalyticsDashboardView;
	onAnalyticsViewChange?: (view: AnalyticsDashboardView) => void;
	integrations?: Integration[];
	onIntegrationSelect?: (integrationId: string) => void;
	onIntegrationConnect?: (integrationId: string) => Promise<void>;
	onRefreshIntegrations?: () => Promise<void> | void;
}

const ANALYTICS_DASHBOARDS: Array<{ id: AnalyticsDashboardView; label: string }> = [
	{ id: "top_spend", label: "Top Spend" },
	{ id: "top_videos", label: "Top Videos" },
	{ id: "top_images", label: "Top Images" },
];

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
	activeRayaView = "tasks",
	onRayaViewChange,
	automations = [],
	activeAutomationId = null,
	activeAutomationMode = "overview",
	onAutomationSelect,
	onAutomationModeChange,
	activeAnalyticsView = "top_spend",
	onAnalyticsViewChange,
	integrations = [],
	onIntegrationSelect,
	onIntegrationConnect,
	onRefreshIntegrations,
}) => {
	const orderedSessions = [...sessions].sort((a, b) => (b.lastActivityAt ?? b.createdAt) - (a.lastActivityAt ?? a.createdAt));
	const activeAutomations = useMemo(() => getUniqueAutomations(automations).filter((automation) => automation.status === "active"), [automations]);
	const [isActiveAutomationsCollapsed, setIsActiveAutomationsCollapsed] = useState(false);

	const handleNewTaskClick = () => {
		onRayaViewChange?.("tasks");
		onAutomationSelect?.(null);
		onAutomationModeChange?.("overview");
		onNewSession();
	};

	const handleAutomationSettingsClick = () => {
		onRayaViewChange?.("automations");
		onAutomationSelect?.(null);
		onAutomationModeChange?.("overview");
	};

	const handleBrandContextClick = () => {
		onRayaViewChange?.("brandContext");
		onAutomationSelect?.(null);
		onAutomationModeChange?.("overview");
	};

	const handleAutomationItemClick = (automationId: string) => {
		onRayaViewChange?.("automations");
		onAutomationSelect?.(automationId);
		onAutomationModeChange?.("run");
	};

	const navItems = [
		{ id: "atria", icon: RayaIcon, label: "Raya" },
		{ id: "analytics", icon: AnalyticsIcon, label: "Analytics" },
		{ id: "inspirations", icon: CompassIcon, label: "Inspirations" },
		{ id: "files", icon: FolderIcon, label: "Files" },
		{ id: "launch", icon: RocketIcon, label: "Launch" },
	];

	return (
		<div className={`sidebar-container ${isCollapsed ? "collapsed" : ""}`}>
			<div className="sidebar-body">
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

				{!isCollapsed && (
					<div className="sidebar-l2">
						<div className="l2-header">
							<span className="l2-title">{navItems.find((item) => item.id === activeTab)?.label}</span>
							{(activeTab === "atria" || activeTab === "analytics") && (
								<ConnectIntegrationMenu
									integrations={integrations}
									onIntegrationConnect={onIntegrationConnect || (async () => {})}
									onRefreshIntegrations={onRefreshIntegrations || (() => {})}
									onIntegrationSelect={(integrationId) => onIntegrationSelect?.(integrationId)}
									buttonClassName="l2-header-icon-btn"
									menuClassName="sidebar-connect-menu-dropdown"
								/>
							)}
						</div>

						<div className="l2-content">
							{activeTab === "atria" && (
								<>
									<div className="sidebar-brand-dropdown">
										<BrandSelector activeBrand={activeBrand} onBrandChange={onBrandChange} isCollapsed={false} />
									</div>

									<div className="raya-primary-nav-group">
										<div
											className={`session-item raya-new-task-item ${activeRayaView === "home3" ? "active" : ""}`}
											onClick={() => {
												onRayaViewChange?.("home3");
												onAutomationSelect?.(null);
												onAutomationModeChange?.("overview");
											}}
										>
											<House size={16} />
											<span className="session-item-title">Home-3</span>
										</div>

										<div
											className={`session-item raya-new-task-item ${activeRayaView === "home2" ? "active" : ""}`}
											onClick={() => {
												onRayaViewChange?.("home2");
												onAutomationSelect?.(null);
												onAutomationModeChange?.("overview");
											}}
										>
											<House size={16} />
											<span className="session-item-title">Home-2</span>
										</div>

										<div className={`session-item raya-new-task-item ${activeRayaView === "tasks" && !activeSessionId ? "active" : ""}`} onClick={handleNewTaskClick}>
											<House size={16} />
											<span className="session-item-title">Home</span>
										</div>

										<div className={`session-item raya-subview-item ${activeRayaView === "brandContext" ? "active" : ""}`} onClick={handleBrandContextClick}>
											<BookOpenText size={16} />
											<span className="session-item-title">Brand Context</span>
										</div>

										<div
											className={`session-item raya-subview-item ${activeRayaView === "integrations" ? "active" : ""}`}
											onClick={() => {
												onRayaViewChange?.("integrations");
												onAutomationSelect?.(null);
												onAutomationModeChange?.("overview");
											}}
										>
											<IntegrationsIcon size={16} />
											<span className="session-item-title">Integrations</span>
										</div>

										<div
											className={`session-item automation-sidebar-item automation-settings-item ${
												activeRayaView === "automations" && activeAutomationMode === "overview" ? "active" : ""
											}`}
											onClick={handleAutomationSettingsClick}
										>
											<Clock3 size={16} />
											<span className="session-item-title">Automations</span>
										</div>
									</div>

									<button
										type="button"
										className={`automation-section-toggle ${isActiveAutomationsCollapsed ? "is-collapsed" : ""}`}
										onClick={() => setIsActiveAutomationsCollapsed((currentValue) => !currentValue)}
										aria-expanded={!isActiveAutomationsCollapsed}
									>
										<span>Active Automations</span>
										<ChevronDown size={14} />
									</button>
									{!isActiveAutomationsCollapsed && (
										<div className="session-list automation-sidebar-list">
											{activeAutomations.map((automation) => (
												<div
													key={automation.id}
													className={`session-item automation-sidebar-item ${activeRayaView === "automations" && activeAutomationId === automation.id ? "active" : ""}`}
													onClick={() => handleAutomationItemClick(automation.id)}
												>
													<span className="session-item-title">{automation.name}</span>
												</div>
											))}
										</div>
									)}

									<div className="section-label">My Tasks</div>
									<div className="session-list">
										{orderedSessions.map((session) => (
											<div
												key={session.id}
												className={`session-item ${activeRayaView === "tasks" && activeSessionId === session.id ? "active" : ""}`}
												onClick={() => onSessionSelect(session.id)}
											>
												<span className="session-item-title">{session.title}</span>
												<span className="session-item-indicators">
													{session.status === "running" && <span className="session-status-spinner" aria-label="Task in progress" />}
													{session.status === "completed" && !session.isRead && <span className="session-unread-dot" aria-label="Unread completed task" />}
												</span>
											</div>
										))}
										{orderedSessions.length === 0 && <div className="empty-sessions">No tasks yet</div>}
									</div>
								</>
							)}

							{activeTab === "analytics" && (
								<>
									<div className="sidebar-brand-dropdown">
										<BrandSelector activeBrand={activeBrand} onBrandChange={onBrandChange} isCollapsed={false} />
									</div>

									<div className="section-label">Dashboards</div>
									<div className="session-list">
										{ANALYTICS_DASHBOARDS.map((dashboard) => (
											<div
												key={dashboard.id}
												className={`session-item analytics-dashboard-item ${activeAnalyticsView === dashboard.id ? "active" : ""}`}
												onClick={() => onAnalyticsViewChange?.(dashboard.id)}
											>
												<LayoutDashboard size={16} />
												<span className="session-item-title">{dashboard.label}</span>
											</div>
										))}
									</div>
								</>
							)}

							{activeTab === "inspirations" && (
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
							)}

							{activeTab === "files" && (
								<div className="session-list" style={{ marginTop: "4px" }}>
									<div className="session-item active">
										<ImageIcon size={16} />
										Generated Images
									</div>
								</div>
							)}

							{activeTab !== "atria" && activeTab !== "analytics" && activeTab !== "inspirations" && activeTab !== "files" && <div className="coming-soon">Nothing here yet.</div>}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default Sidebar;
