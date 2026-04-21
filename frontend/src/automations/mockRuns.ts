import { Message } from "../types";
import { AUTOMATION_MOCK_RUNS_DATA } from "./mockRuns.data";

export interface AutomationMockRun {
	id: string;
	automationId: string;
	timestamp: string;
	status: "success" | "failed";
	followUps: string[];
	messages: Message[];
}

export const AUTOMATION_MOCK_RUNS: AutomationMockRun[] = AUTOMATION_MOCK_RUNS_DATA as unknown as AutomationMockRun[];

export const getAutomationMockRunById = (mockRunId: string) => AUTOMATION_MOCK_RUNS.find((run) => run.id === mockRunId) ?? null;

export const getAutomationMockRunsByAutomationId = (automationId: string) => AUTOMATION_MOCK_RUNS.filter((run) => run.automationId === automationId);

export const getLatestAutomationMockRunByAutomationId = (automationId: string) =>
	getAutomationMockRunsByAutomationId(automationId)
		.sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0] ?? null;

export const getDefaultAutomationMockRun = () => AUTOMATION_MOCK_RUNS[0] ?? null;
