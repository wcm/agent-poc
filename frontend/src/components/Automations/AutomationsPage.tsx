import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, Clock3, Pencil, Play, Save, Search, Settings, ShieldCheck, X } from "lucide-react";
import ChatInterface from "../Chat/ChatInterface";
import {
	AUTOMATION_MONTH_DATES,
	AUTOMATION_WEEKDAYS,
	AutomationDefinition,
	AutomationFrequency,
	filterAutomations,
	formatAutomationSchedule,
	formatHistoryTimestamp,
	getDefaultDeliveryForFrequency,
} from "../../automations/catalog";
import { getAutomationMockRunById, getDefaultAutomationMockRun } from "../../automations/mockRuns";
import { getConnectableIntegrationId, getIntegrationDefinitionById, IntegrationState, resolveIntegrations, ResolvedIntegration } from "../../integrations/catalog";
import { Integration, Message } from "../../types";

interface AutomationsPageProps {
	automations: AutomationDefinition[];
	activeAutomationId: string | null;
	activeAutomationMode: "overview" | "details" | "run";
	integrations: Integration[];
	activeIntegrationId: string | null;
	activeBrand: string;
	initialRunId?: string | null;
	composerPrefill?: string | null;
	integrationState: IntegrationState;
	onAutomationSelect: (automationId: string | null) => void;
	onAutomationModeChange: (mode: "overview" | "details" | "run") => void;
	onSaveAutomation: (automation: AutomationDefinition) => Promise<void> | void;
	onIntegrationConnect: (integrationId: string) => Promise<void>;
	onRefreshIntegrations: () => Promise<void> | void;
	onConnectIntegration: (integrationId: string) => Promise<void> | void;
	onDisconnectIntegration: (integrationId: string) => Promise<void> | void;
	onOpenBrandContext: () => void;
	onTestAutomation: (prompt: string) => Promise<void> | void;
	onContinueAutomationRun: (historyMessages: Message[], message: string) => Promise<void> | void;
}

interface ActivationRequest {
	automation: AutomationDefinition;
	missingIntegrations: ResolvedIntegration[];
	blockedIntegrations: ResolvedIntegration[];
}

const cloneAutomation = (automation: AutomationDefinition): AutomationDefinition => ({
	...automation,
	delivery: { ...automation.delivery },
	integrations: [...automation.integrations],
	history: automation.history.map((entry) => ({ ...entry })),
});

const AutomationsPage: React.FC<AutomationsPageProps> = ({
	automations,
	activeAutomationId,
	activeAutomationMode,
	integrations,
	activeIntegrationId,
	activeBrand,
	initialRunId = null,
	composerPrefill = null,
	integrationState,
	onAutomationSelect,
	onAutomationModeChange,
	onSaveAutomation,
	onIntegrationConnect,
	onRefreshIntegrations,
	onConnectIntegration,
	onDisconnectIntegration,
	onOpenBrandContext,
	onTestAutomation,
	onContinueAutomationRun,
}) => {
	const [query, setQuery] = useState("");
	const [draftAutomation, setDraftAutomation] = useState<AutomationDefinition | null>(null);
	const [activationRequest, setActivationRequest] = useState<ActivationRequest | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isConnectingRequired, setIsConnectingRequired] = useState(false);
	const [isEditingSchedule, setIsEditingSchedule] = useState(false);
	const [openedRunId, setOpenedRunId] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState("");

	const resolvedIntegrations = useMemo(() => resolveIntegrations(integrations, integrationState), [integrations, integrationState]);

	const integrationsById = useMemo(
		() => new Map(resolvedIntegrations.map((integration) => [integration.id, integration])),
		[resolvedIntegrations]
	);

	const filteredAutomations = useMemo(() => filterAutomations(automations, query), [automations, query]);
	const selectedAutomation = useMemo(
		() => automations.find((automation) => automation.id === activeAutomationId) ?? null,
		[activeAutomationId, automations]
	);

	useEffect(() => {
		if (!selectedAutomation) {
			setDraftAutomation(null);
			return;
		}

		setDraftAutomation(cloneAutomation(selectedAutomation));
		setIsEditingSchedule(false);
		setOpenedRunId(null);
	}, [selectedAutomation]);

	useEffect(() => {
		if (!toastMessage) {
			return;
		}

		const timeoutId = window.setTimeout(() => setToastMessage(""), 2400);
		return () => window.clearTimeout(timeoutId);
	}, [toastMessage]);

	const getAutomationIntegrations = (automation: AutomationDefinition) =>
		automation.integrations
			.map((integrationId) => {
				const resolved = integrationsById.get(integrationId);
				if (resolved) {
					return resolved;
				}

				const definition = getIntegrationDefinitionById(integrationId);
				if (!definition) {
					return null;
				}

				return {
					...definition,
					integration: null,
					isConnected: false,
					status: definition.availability === "available" ? "available" : "coming_soon",
				};
			})
			.filter((integration): integration is ResolvedIntegration => integration !== null);

	const openAutomation = (automationId: string) => {
		onAutomationSelect(automationId);
		onAutomationModeChange("details");
	};

	const updateDraftDelivery = (updates: Partial<AutomationDefinition["delivery"]>) => {
		setDraftAutomation((previous) => (previous ? { ...previous, delivery: { ...previous.delivery, ...updates } } : previous));
	};

	const updateFrequency = (frequency: AutomationFrequency) => {
		setDraftAutomation((previous) => {
			if (!previous) {
				return previous;
			}

			return {
				...previous,
				frequency,
				delivery: getDefaultDeliveryForFrequency(frequency, previous.delivery.time || "09:00"),
			};
		});
	};

	const persistAutomation = async (automation: AutomationDefinition, successMessage: string) => {
		setIsSaving(true);
		try {
			await onSaveAutomation(cloneAutomation(automation));
			setDraftAutomation(cloneAutomation(automation));
			setToastMessage(successMessage);
			return true;
		} catch (error) {
			console.error("Failed to save automation:", error);
			setToastMessage(`Unable to save ${automation.name} right now.`);
			return false;
		} finally {
			setIsSaving(false);
		}
	};

	const handleSaveChanges = async () => {
		if (!draftAutomation) {
			return;
		}

		const didSave = await persistAutomation(draftAutomation, `${draftAutomation.name} updated.`);
		if (didSave) {
			setIsEditingSchedule(false);
		}
	};

	const handleToggleStatus = async (nextStatus: AutomationDefinition["status"]) => {
		if (!draftAutomation) {
			return;
		}

		if (nextStatus === "inactive") {
			const updatedAutomation = { ...draftAutomation, status: "inactive" as const };
			await persistAutomation(updatedAutomation, `${updatedAutomation.name} paused.`);
			return;
		}

		const automationIntegrations = getAutomationIntegrations(draftAutomation);
		const missingIntegrations = automationIntegrations.filter((integration) => integration.status !== "connected");
		const blockedIntegrations = missingIntegrations.filter((integration) => integration.status === "coming_soon");

		if (missingIntegrations.length === 0) {
			const updatedAutomation = { ...draftAutomation, status: "active" as const };
			await persistAutomation(updatedAutomation, `${updatedAutomation.name} activated.`);
			return;
		}

		setActivationRequest({
			automation: cloneAutomation(draftAutomation),
			missingIntegrations: missingIntegrations.filter((integration) => integration.status === "available"),
			blockedIntegrations,
		});
	};

	const handleConfirmActivation = async () => {
		if (!activationRequest) {
			return;
		}

		if (activationRequest.blockedIntegrations.length > 0) {
			setActivationRequest(null);
			return;
		}

		setIsConnectingRequired(true);
		try {
			for (const integration of activationRequest.missingIntegrations) {
				const connectableIntegrationId = getConnectableIntegrationId(integration);
				if (connectableIntegrationId) {
					await onIntegrationConnect(connectableIntegrationId);
					continue;
				}

				await onConnectIntegration(integration.id);
			}

			await onRefreshIntegrations();

			const updatedAutomation = { ...activationRequest.automation, status: "active" as const };
			await onSaveAutomation(cloneAutomation(updatedAutomation));
			setDraftAutomation(cloneAutomation(updatedAutomation));
			setToastMessage(`${updatedAutomation.name} activated.`);
			setActivationRequest(null);
		} catch (error) {
			console.error("Failed to activate automation:", error);
			setToastMessage(`Unable to activate ${activationRequest.automation.name} right now.`);
		} finally {
			setIsConnectingRequired(false);
		}
	};

	const renderIntegrationIcons = (automation: AutomationDefinition, size = 30) => {
		const automationIntegrations = getAutomationIntegrations(automation);

		return automationIntegrations.map((integration) => (
			<span key={integration.id} className={`automation-integration-logo-badge ${integration.status}`} title={integration.name} aria-label={integration.name}>
				<span className="automation-integration-logo-badge-icon">{integration.renderLogo(size)}</span>
			</span>
		));
	};

	const getDeliverySummary = (automation: AutomationDefinition) => {
		if (automation.frequency === "weekly") {
			return [
				{ label: "Frequency", value: "Weekly" },
				{ label: "Delivery", value: `${automation.delivery.day || "Monday"} at ${automation.delivery.time}` },
			];
		}

		if (automation.frequency === "monthly") {
			return [
				{ label: "Frequency", value: "Monthly" },
				{ label: "Delivery", value: `Day ${automation.delivery.date || 1} at ${automation.delivery.time}` },
			];
		}

		return [
			{ label: "Frequency", value: "Daily" },
			{ label: "Delivery", value: automation.delivery.time },
		];
	};

	const getHistoryRunId = (automation: AutomationDefinition, sampleRunId?: string) => {
		if (sampleRunId && getAutomationMockRunById(sampleRunId)) {
			return sampleRunId;
		}

		const latestHistoryWithSample = [...automation.history]
			.sort((left, right) => right.timestamp.localeCompare(left.timestamp))
			.find((entry) => entry.sampleRunId && getAutomationMockRunById(entry.sampleRunId));

		if (latestHistoryWithSample?.sampleRunId) {
			return latestHistoryWithSample.sampleRunId;
		}

		return getDefaultAutomationMockRun()?.id ?? null;
	};

	useEffect(() => {
		if (!selectedAutomation) {
			setOpenedRunId(null);
			return;
		}

		if (activeAutomationMode === "run") {
			setOpenedRunId((previous) => {
				if (initialRunId) {
					const preferredRun = getAutomationMockRunById(initialRunId);
					if (preferredRun?.automationId === selectedAutomation.id) {
						return initialRunId;
					}
				}

				if (!previous) {
					return getHistoryRunId(selectedAutomation);
				}

				const existingRun = getAutomationMockRunById(previous);
				return existingRun?.automationId === selectedAutomation.id ? previous : getHistoryRunId(selectedAutomation);
			});
			return;
		}

		setOpenedRunId(null);
	}, [activeAutomationMode, initialRunId, selectedAutomation]);

	if (draftAutomation) {
		const automationIntegrations = getAutomationIntegrations(draftAutomation);
		const openedMockRun = (openedRunId ? getAutomationMockRunById(openedRunId) : null) || null;
		const handleHistoryClick = (sampleRunId?: string) => {
			const targetRunId = getHistoryRunId(draftAutomation, sampleRunId);
			if (!targetRunId) {
				return;
			}

			setOpenedRunId(targetRunId);
			onAutomationModeChange("run");
		};

		if (openedMockRun) {
			return (
				<div className="automations-page automation-run-page">
					<ChatInterface
						sessionId={`automation-run-${openedMockRun.id}`}
						sessions={[]}
						messages={openedMockRun.messages}
						isLoading={false}
						streamingSections={[]}
						planStates={new Map()}
						onSendMessage={(message) => onContinueAutomationRun(openedMockRun.messages, message)}
						onSessionSelect={() => {}}
						onOpenIntegrations={() => {}}
						onOpenBrandContext={onOpenBrandContext}
						connectedIntegrations={resolvedIntegrations.filter((integration) => integration.isConnected)}
						myConnections={resolvedIntegrations.filter((integration) => integration.section === "myConnections")}
						activeIntegrationId={activeIntegrationId}
						activeBrand={activeBrand}
						onConnectMyConnection={onConnectIntegration}
						onDisconnectMyConnection={onDisconnectIntegration}
						showComposer={true}
						prefilledInput={composerPrefill}
						headerContent={
							<div className="automation-run-header">
								<button
									type="button"
									className="automation-back-button automation-run-back-button"
									onClick={() => {
										setOpenedRunId(null);
										onAutomationModeChange("details");
									}}
								>
									<Settings size={16} />
									<span>Settings</span>
								</button>
								<span className="automation-run-timestamp">{formatHistoryTimestamp(openedMockRun.timestamp)}</span>
							</div>
						}
					/>
				</div>
			);
		}

		return (
			<div className="automations-page">
				<div className="automations-page-shell automation-detail-shell">
					<div className="automation-detail-back-row">
						<button
							type="button"
							className="automation-back-button"
							onClick={() => {
								onAutomationSelect(null);
								onAutomationModeChange("overview");
							}}
						>
							<ChevronLeft size={16} />
							<span>All Automations</span>
						</button>
					</div>

					<div className="automation-detail-hero">
						<div className="automation-detail-heading">
							<div className="automation-detail-title-row">
								<h1>{draftAutomation.name}</h1>
								<button
									type="button"
									className={`automation-status-toggle ${draftAutomation.status}`}
									onClick={() => handleToggleStatus(draftAutomation.status === "active" ? "inactive" : "active")}
									disabled={isSaving || isConnectingRequired}
								>
									<span className="automation-status-toggle-track">
										<span className="automation-status-toggle-thumb" />
									</span>
									<span>{draftAutomation.status === "active" ? "Active" : "Inactive"}</span>
								</button>
							</div>
							<p>{draftAutomation.description}</p>
						</div>
						<div className="automation-hero-actions">
							<button type="button" className="automation-primary-action automation-test-action" onClick={() => onTestAutomation(draftAutomation.prompt)}>
								<Play size={15} />
								<span>Test This Task</span>
							</button>
						</div>
					</div>
					<div className="automation-detail-divider" />

					<div className="automation-detail-grid">
						<div className="automation-detail-main">
							<section className="automation-detail-card">
								<div className="automation-detail-card-header">
									<h2>Automation Prompt</h2>
								</div>
								<div className="automation-prompt-block">{draftAutomation.prompt}</div>
							</section>

							<section className="automation-detail-card">
								<div className="automation-detail-card-header">
									<h2>Required Integrations</h2>
								</div>
								<div className="automation-required-list">
									{automationIntegrations.map((integration) => (
										<div key={integration.id} className="automation-required-item">
											<div className="automation-required-item-left">
												<span className="automation-required-item-logo">{integration.renderLogo(34)}</span>
												<div className="automation-required-item-copy">
													<span className="automation-required-item-name">{integration.name}</span>
													<span className="automation-required-item-description">{integration.description}</span>
												</div>
											</div>
											<span className={`automation-required-item-status ${integration.status}`}>
												{integration.status === "connected" ? "Connected" : integration.status === "available" ? "Connect Required" : "Coming Soon"}
											</span>
										</div>
									))}
								</div>
							</section>

							<section className="automation-detail-card">
								<div className="automation-detail-card-header">
									<div className="automation-section-title">
										<h2>Run History</h2>
										<span className="automation-section-count">{draftAutomation.history.length} recent runs</span>
									</div>
								</div>
								<div className="automation-history-list">
									{draftAutomation.history.map((entry) => (
										<button
											key={`${entry.timestamp}-${entry.status}`}
											type="button"
											className="automation-history-item is-clickable"
											onClick={() => handleHistoryClick(entry.sampleRunId)}
										>
											<div className="automation-history-item-left">
												{entry.status === "success" ? <Check size={15} /> : <X size={15} />}
												<span>{formatHistoryTimestamp(entry.timestamp)}</span>
											</div>
											<span className={`automation-history-status ${entry.status}`}>{entry.status === "success" ? "Success" : "Skipped"}</span>
										</button>
									))}
								</div>
							</section>

						</div>

						<aside className="automation-settings-card">
							<div className="automation-detail-card-header automation-settings-header">
								<h2>Delivery Settings</h2>
								{!isEditingSchedule && (
									<button type="button" className="automation-edit-trigger" onClick={() => setIsEditingSchedule(true)}>
										<Pencil size={15} />
									</button>
								)}
							</div>

							{isEditingSchedule ? (
								<div className="automation-settings-form">
									<label className="automation-field">
										<span>Frequency</span>
										<select value={draftAutomation.frequency} onChange={(event) => updateFrequency(event.target.value as AutomationFrequency)}>
											<option value="daily">Daily</option>
											<option value="weekly">Weekly</option>
											<option value="monthly">Monthly</option>
										</select>
									</label>

									{draftAutomation.frequency === "weekly" && (
										<label className="automation-field">
											<span>Day</span>
											<select value={draftAutomation.delivery.day || "Monday"} onChange={(event) => updateDraftDelivery({ day: event.target.value as AutomationDefinition["delivery"]["day"] })}>
												{AUTOMATION_WEEKDAYS.map((weekday) => (
													<option key={weekday} value={weekday}>
														{weekday}
													</option>
												))}
											</select>
										</label>
									)}

									{draftAutomation.frequency === "monthly" && (
										<label className="automation-field">
											<span>Date</span>
											<select value={draftAutomation.delivery.date || 1} onChange={(event) => updateDraftDelivery({ date: Number(event.target.value) })}>
												{AUTOMATION_MONTH_DATES.map((dateValue) => (
													<option key={dateValue} value={dateValue}>
														{dateValue}
													</option>
												))}
											</select>
										</label>
									)}

									<label className="automation-field">
										<span>Deliver Time</span>
										<input type="time" value={draftAutomation.delivery.time} onChange={(event) => updateDraftDelivery({ time: event.target.value })} />
									</label>

									<div className="automation-settings-actions">
										<button type="button" className="automation-primary-action" onClick={handleSaveChanges} disabled={isSaving || isConnectingRequired}>
											<Save size={15} />
											<span>{isSaving ? "Saving..." : "Save Changes"}</span>
										</button>
									</div>
								</div>
							) : (
								<div className="automation-settings-summary">
									{getDeliverySummary(draftAutomation).map((item) => (
										<div key={item.label} className="automation-settings-summary-row">
											<span className="automation-settings-summary-label">{item.label}</span>
											<span className="automation-settings-summary-value">{item.value}</span>
										</div>
									))}
								</div>
							)}
						</aside>
					</div>
				</div>

				{activationRequest && (
					<div className="automation-modal-backdrop" onClick={() => (isConnectingRequired ? undefined : setActivationRequest(null))}>
						<div className="automation-modal" onClick={(event) => event.stopPropagation()}>
							<div className="automation-modal-header">
								<div className="automation-modal-icon">
									<AlertTriangle size={18} />
								</div>
								<div className="automation-modal-copy">
									<h2>
										{activationRequest.blockedIntegrations.length > 0 ? "Required integrations are not ready yet" : "Connect required integrations?"}
									</h2>
									<p>
										{activationRequest.blockedIntegrations.length > 0
											? `${activationRequest.automation.name} cannot be activated until all required integrations are available.`
											: `${activationRequest.automation.name} needs the following workspace integrations connected before it can run.`}
									</p>
								</div>
								<button type="button" className="automation-modal-close" onClick={() => setActivationRequest(null)} disabled={isConnectingRequired}>
									<X size={16} />
								</button>
							</div>

							<div className="automation-modal-body">
								{activationRequest.missingIntegrations.length > 0 && (
									<div className="automation-modal-section">
										<h3>Will be connected now</h3>
										<div className="automation-modal-integration-list">{activationRequest.missingIntegrations.map((integration) => <div key={integration.id}>{integration.name}</div>)}</div>
									</div>
								)}

								{activationRequest.blockedIntegrations.length > 0 && (
									<div className="automation-modal-section blocked">
										<h3>Not available yet</h3>
										<div className="automation-modal-integration-list">
											{activationRequest.blockedIntegrations.map((integration) => (
												<div key={integration.id}>{integration.name}</div>
											))}
										</div>
									</div>
								)}
							</div>

							<div className="automation-modal-actions">
								<button type="button" className="automation-modal-secondary" onClick={() => setActivationRequest(null)} disabled={isConnectingRequired}>
									Cancel
								</button>
								{activationRequest.blockedIntegrations.length === 0 && (
									<button type="button" className="automation-modal-primary" onClick={handleConfirmActivation} disabled={isConnectingRequired}>
										{isConnectingRequired ? "Connecting..." : "Connect & Activate"}
									</button>
								)}
							</div>
						</div>
					</div>
				)}

				{toastMessage && (
					<div className="toast-notification">
						<ShieldCheck size={16} />
						<span>{toastMessage}</span>
					</div>
				)}
			</div>
		);
	}

		return (
			<div className="automations-page">
				<div className="automations-page-shell">
				<div className="automations-page-header">
					<div className="automations-page-copy">
						<h1>Automations</h1>
						<p>Automations are shared across the workspace. Configure recurring tasks, delivery schedules, and required integrations here.</p>
					</div>
					<label className="workspace-search" aria-label="Search automations">
						<Search size={18} />
						<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search automations..." />
					</label>
				</div>

				<div className="automations-grid">
					{filteredAutomations.map((automation) => (
						<button key={automation.id} type="button" className="automation-card" onClick={() => openAutomation(automation.id)}>
							<div className="automation-card-top">
								<div className="automation-card-title-row">
									<div className="automation-card-title">{automation.name}</div>
									<div className={`automation-status-pill ${automation.status}`}>
										<span className="automation-status-dot" />
										{automation.status === "active" ? "Active" : "Inactive"}
									</div>
								</div>
							</div>
							<div className="automation-card-content">
								<p>{automation.description}</p>
							</div>
							<div className="automation-card-footer">
								<div className="automation-card-integrations">{renderIntegrationIcons(automation)}</div>
								<div className="automation-card-schedule">
									<Clock3 size={14} />
									<span>{formatAutomationSchedule(automation)}</span>
								</div>
							</div>
						</button>
					))}
				</div>

				{filteredAutomations.length === 0 && (
					<div className="integrations-empty-state">
						<p>No automations match your search yet.</p>
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

export default AutomationsPage;
