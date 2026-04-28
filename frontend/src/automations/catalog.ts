import automationCatalog from "./catalog.json";

export type AutomationFrequency = "daily" | "weekly" | "monthly";
export type AutomationStatus = "active" | "inactive";
export type AutomationRunStatus = "success" | "failed";
export type AutomationWeekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export interface AutomationDelivery {
	time: string;
	day?: AutomationWeekday;
	date?: number;
}

export interface AutomationHistoryEntry {
	timestamp: string;
	status: AutomationRunStatus;
	sampleRunId?: string;
}

export interface AutomationDefinition {
	id: string;
	name: string;
	description: string;
	prompt: string;
	frequency: AutomationFrequency;
	delivery: AutomationDelivery;
	status: AutomationStatus;
	integrations: string[];
	history: AutomationHistoryEntry[];
}

export const AUTOMATION_STATE_STORAGE_KEY = "raya.automation.catalog.state";

export const AUTOMATION_WEEKDAYS: AutomationWeekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const AUTOMATION_MONTH_DATES = Array.from({ length: 28 }, (_, index) => index + 1);

const rawAutomationCatalog = automationCatalog as AutomationDefinition[];

const cloneAutomation = (automation: AutomationDefinition): AutomationDefinition => ({
	...automation,
	delivery: { ...automation.delivery },
	integrations: [...(automation.integrations ?? [])],
	history: automation.history.map((entry) => ({ ...entry })),
});

const mergeAutomationHistory = (
	catalogHistory: AutomationHistoryEntry[],
	persistedHistory: AutomationHistoryEntry[]
): AutomationHistoryEntry[] => {
	const persistedByTimestamp = new Map(persistedHistory.map((entry) => [entry.timestamp, { ...entry }]));

	const mergedHistory = catalogHistory.map((catalogEntry) => {
		const persistedEntry = persistedByTimestamp.get(catalogEntry.timestamp);
		if (!persistedEntry) {
			return { ...catalogEntry };
		}

		return {
			...catalogEntry,
			status: persistedEntry.status,
			sampleRunId: catalogEntry.sampleRunId ?? persistedEntry.sampleRunId,
		};
	});

	persistedHistory.forEach((persistedEntry) => {
		if (!catalogHistory.some((catalogEntry) => catalogEntry.timestamp === persistedEntry.timestamp)) {
			mergedHistory.push({ ...persistedEntry });
		}
	});

	return mergedHistory;
};

export const getInitialAutomations = (): AutomationDefinition[] => rawAutomationCatalog.map(cloneAutomation);

export const mergePersistedAutomations = (persistedAutomations: AutomationDefinition[]): AutomationDefinition[] => {
	const persistedById = new Map(persistedAutomations.map((automation) => [automation.id, cloneAutomation(automation)]));

	const mergedAutomations = rawAutomationCatalog.map((catalogAutomation) => {
		const persistedAutomation = persistedById.get(catalogAutomation.id);
		if (!persistedAutomation) {
			return cloneAutomation(catalogAutomation);
		}

		return {
			...cloneAutomation(catalogAutomation),
			frequency: persistedAutomation.frequency,
			delivery: { ...persistedAutomation.delivery },
			status: persistedAutomation.status,
			history: persistedAutomation.status === "inactive" ? [] : mergeAutomationHistory(catalogAutomation.history, persistedAutomation.history),
		};
	});

	persistedAutomations.forEach((automation) => {
		if (!rawAutomationCatalog.some((catalogAutomation) => catalogAutomation.id === automation.id)) {
			mergedAutomations.push(cloneAutomation(automation));
		}
	});

	return mergedAutomations;
};

export const filterAutomations = (automations: AutomationDefinition[], query: string) => {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return automations;
	}

	return automations.filter((automation) => {
		const haystack = [automation.name, automation.description, automation.prompt, automation.frequency, ...automation.integrations].join(" ").toLowerCase();
		return haystack.includes(normalized);
	});
};

export const formatAutomationSchedule = (automation: Pick<AutomationDefinition, "frequency" | "delivery">) => {
	const { frequency, delivery } = automation;
	switch (frequency) {
		case "daily":
			return `Daily at ${formatDisplayTime(delivery.time)}`;
		case "weekly":
			return `Weekly on ${delivery.day || "Monday"} at ${formatDisplayTime(delivery.time)}`;
		case "monthly":
			return `Monthly on the ${formatOrdinal(delivery.date || 1)} at ${formatDisplayTime(delivery.time)}`;
		default:
			return "";
	}
};

export const getDefaultDeliveryForFrequency = (frequency: AutomationFrequency, currentTime = "09:00"): AutomationDelivery => {
	switch (frequency) {
		case "daily":
			return { time: currentTime };
		case "weekly":
			return { day: "Monday", time: currentTime };
		case "monthly":
			return { date: 1, time: currentTime };
		default:
			return { time: currentTime };
	}
};

export const formatHistoryTimestamp = (timestamp: string) => {
	const parsed = new Date(timestamp);
	if (Number.isNaN(parsed.getTime())) {
		return timestamp;
	}

	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(parsed);
};

const formatDisplayTime = (time: string) => {
	const [hoursText = "09", minutesText = "00"] = time.split(":");
	const hours = Number(hoursText);
	const minutes = Number(minutesText);

	if (Number.isNaN(hours) || Number.isNaN(minutes)) {
		return time;
	}

	const date = new Date();
	date.setHours(hours, minutes, 0, 0);

	return new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
};

const formatOrdinal = (value: number) => {
	const remainder = value % 10;
	const remainderHundreds = value % 100;

	if (remainder === 1 && remainderHundreds !== 11) {
		return `${value}st`;
	}

	if (remainder === 2 && remainderHundreds !== 12) {
		return `${value}nd`;
	}

	if (remainder === 3 && remainderHundreds !== 13) {
		return `${value}rd`;
	}

	return `${value}th`;
};
