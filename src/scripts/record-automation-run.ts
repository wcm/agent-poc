import fs from "fs";
import path from "path";
import { Agent } from "../agent";
import { FocusedItemCard, FrontendIntegrationInfo, ImageConcept, PlanTask, SSEEvent, VideoConcept } from "../types";

interface AutomationCatalogEntry {
    id: string;
    prompt: string;
    integrations: string[];
}

type CapturedStatus = "success" | "failed";

interface CapturedTextSection {
    type: "text";
    content: string;
}

interface CapturedPlanSection {
    type: "plan";
    planId: string;
    agentName: string;
    title: string;
    tasks: PlanTask[];
}

interface CapturedReportSection {
    type: "report";
    reportType: "performance" | "creative" | "common";
    reportId: string;
    title: string;
    content: string;
    itemId?: string;
    itemName?: string;
    itemData?: {
        thumbnail?: string;
        displayFormat?: "image" | "video";
        videoLength?: string;
        metrics: {
            roas?: number;
            spend?: number;
            ctr?: number;
            impressions?: number;
            cost_per_lead?: number;
        };
    };
}

interface CapturedIntegrationSection {
    type: "integration_result";
    resultId: string;
    integrationId: string;
    integrationName: string;
    title: string;
    status: "connected" | "available" | "coming_soon" | "unknown";
    mode: "data" | "instruction";
    content: string;
}

interface CapturedFocusedItemsSection {
    type: "focused_items";
    items: FocusedItemCard[];
}

interface CapturedImageConceptsSection {
    type: "image_concepts";
    itemId: string;
    itemName: string;
    concepts: ImageConcept[];
}

interface CapturedVideoConceptsSection {
    type: "video_concepts";
    itemId: string;
    itemName: string;
    concepts: VideoConcept[];
}

type CapturedSection =
    | CapturedTextSection
    | CapturedPlanSection
    | CapturedReportSection
    | CapturedIntegrationSection
    | CapturedFocusedItemsSection
    | CapturedImageConceptsSection
    | CapturedVideoConceptsSection;

interface CapturedMessage {
    role: "user" | "assistant";
    content: string;
    sections?: CapturedSection[];
}

interface CapturedRun {
    id: string;
    automationId: string;
    timestamp: string;
    status: CapturedStatus;
    messages: CapturedMessage[];
}

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const FRONTEND_AUTOMATIONS_DIR = path.join(ROOT_DIR, "frontend", "src", "automations");
const AUTOMATIONS_CATALOG_PATH = path.join(FRONTEND_AUTOMATIONS_DIR, "catalog.json");
const MOCK_RUNS_DATA_PATH = path.join(FRONTEND_AUTOMATIONS_DIR, "mockRuns.data.ts");

const parseArgs = () => {
    const [automationId, ...flags] = process.argv.slice(2);

    if (!automationId) {
        throw new Error("Usage: ts-node src/scripts/record-automation-run.ts <automation-id> [--timestamp=ISO8601] [--channel-id=channel_1]");
    }

    let timestamp = new Date().toISOString();
    let channelId = "channel_1";

    flags.forEach((flag) => {
        if (flag.startsWith("--timestamp=")) {
            timestamp = flag.slice("--timestamp=".length);
        } else if (flag.startsWith("--channel-id=")) {
            channelId = flag.slice("--channel-id=".length);
        }
    });

    return { automationId, timestamp, channelId };
};

const loadAutomationCatalog = (): AutomationCatalogEntry[] => {
    const file = fs.readFileSync(AUTOMATIONS_CATALOG_PATH, "utf-8");
    return JSON.parse(file) as AutomationCatalogEntry[];
};

const loadExistingRuns = (): CapturedRun[] => {
    if (!fs.existsSync(MOCK_RUNS_DATA_PATH)) {
        return [];
    }

    const resolvedPath = require.resolve(MOCK_RUNS_DATA_PATH);
    delete require.cache[resolvedPath];
    const mod = require(resolvedPath) as { AUTOMATION_MOCK_RUNS_DATA?: CapturedRun[] };
    return Array.isArray(mod.AUTOMATION_MOCK_RUNS_DATA) ? mod.AUTOMATION_MOCK_RUNS_DATA : [];
};

const buildRunId = (automationId: string, timestamp: string) => {
    const datePart = timestamp.slice(0, 10);
    return `${automationId}-run-${datePart}`;
};

const buildConnectedIntegrations = (integrationIds: string[]): FrontendIntegrationInfo[] => {
    return integrationIds.map((integrationId) => ({
        id: integrationId,
        name: integrationId
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" "),
        status: "connected",
    }));
};

const createRunAssembler = (automationId: string, prompt: string, timestamp: string) => {
    let status: CapturedStatus = "success";
    const streamingSections: CapturedSection[] = [];
    const planTaskStates = new Map<string, PlanTask[]>();
    const messages: CapturedMessage[] = [{ role: "user", content: prompt }];

    const applyEvent = (event: SSEEvent) => {
        switch (event.type) {
            case "text":
                streamingSections.push({ type: "text", content: event.content });
                break;

            case "plan":
                streamingSections.push({
                    type: "plan",
                    planId: event.planId,
                    agentName: event.agentName,
                    title: event.title,
                    tasks: event.tasks.map((task) => ({ ...task })),
                });
                planTaskStates.set(
                    event.planId,
                    event.tasks.map((task) => ({ ...task }))
                );
                break;

            case "plan_status": {
                const currentTasks = planTaskStates.get(event.planId);
                if (!currentTasks) {
                    break;
                }

                const updatedTasks = currentTasks.map((task) =>
                    task.id === event.taskId ? { ...task, status: event.status } : task
                );
                planTaskStates.set(event.planId, updatedTasks);

                const planSection = streamingSections.find(
                    (section): section is CapturedPlanSection => section.type === "plan" && section.planId === event.planId
                );
                if (planSection) {
                    planSection.tasks = updatedTasks.map((task) => ({ ...task }));
                }

                if (event.status === "failed") {
                    status = "failed";
                }
                break;
            }

            case "report":
                streamingSections.push({
                    type: "report",
                    reportType: event.reportType,
                    reportId: event.reportId,
                    title: event.title,
                    content: event.content,
                    itemId: event.itemId,
                    itemName: event.itemName,
                    itemData: event.itemData,
                });
                break;

            case "integration_result":
                streamingSections.push({
                    type: "integration_result",
                    resultId: event.resultId,
                    integrationId: event.integrationId,
                    integrationName: event.integrationName,
                    title: event.title,
                    status: event.status,
                    mode: event.mode,
                    content: event.content,
                });
                if (event.status !== "connected" && event.mode === "instruction") {
                    status = "failed";
                }
                break;

            case "focused_items":
                streamingSections.push({
                    type: "focused_items",
                    items: event.items,
                });
                break;

            case "image_concepts": {
                const existingIndex = streamingSections.findIndex(
                    (section) => section.type === "image_concepts" && section.itemId === event.itemId
                );
                const nextSection: CapturedImageConceptsSection = {
                    type: "image_concepts",
                    itemId: event.itemId,
                    itemName: event.itemName,
                    concepts: event.concepts,
                };

                if (existingIndex >= 0) {
                    streamingSections[existingIndex] = nextSection;
                } else {
                    streamingSections.push(nextSection);
                }
                break;
            }

            case "image_concept_update":
                streamingSections.forEach((section) => {
                    if (section.type === "image_concepts" && section.itemId === event.itemId) {
                        section.concepts = section.concepts.map((concept, index) =>
                            index === event.conceptIndex
                                ? { ...concept, imageDataUrl: event.imageDataUrl, status: event.status }
                                : concept
                        );
                    }
                });
                if (event.status === "failed") {
                    status = "failed";
                }
                break;

            case "video_concepts":
                streamingSections.push({
                    type: "video_concepts",
                    itemId: event.itemId,
                    itemName: event.itemName,
                    concepts: event.concepts,
                });
                break;

            case "context_update":
                break;

            case "error":
                status = "failed";
                streamingSections.push({
                    type: "text",
                    content: `⚠️ Error: ${event.message}`,
                });
                break;

            case "done": {
                const plainContent = streamingSections
                    .filter((section): section is CapturedTextSection => section.type === "text")
                    .map((section) => section.content)
                    .join("\n\n");

                messages.push({
                    role: "assistant",
                    content: plainContent || "Analysis complete.",
                    sections: streamingSections.map((section) => JSON.parse(JSON.stringify(section)) as CapturedSection),
                });
                break;
            }
        }
    };

    return {
        applyEvent,
        finalize: (): CapturedRun => ({
            id: buildRunId(automationId, timestamp),
            automationId,
            timestamp,
            status,
            messages,
        }),
    };
};

const writeRunsFile = (runs: CapturedRun[]) => {
    const sortedRuns = [...runs].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    const fileContents = `export const AUTOMATION_MOCK_RUNS_DATA = ${JSON.stringify(sortedRuns, null, 2)};\n`;
    fs.writeFileSync(MOCK_RUNS_DATA_PATH, fileContents, "utf-8");
};

async function main() {
    const { automationId, timestamp, channelId } = parseArgs();
    const automations = loadAutomationCatalog();
    const automation = automations.find((entry) => entry.id === automationId);

    if (!automation) {
        throw new Error(`Automation not found: ${automationId}`);
    }

    const recorder = createRunAssembler(automation.id, automation.prompt, timestamp);
    const agent = new Agent();

    agent.on("stream", (event: SSEEvent) => {
        recorder.applyEvent(event);
    });

    await agent.handleRequest(automation.prompt, channelId, {
        integrations: buildConnectedIntegrations(automation.integrations),
    });

    const capturedRun = recorder.finalize();
    const existingRuns = loadExistingRuns().filter((run) => run.id !== capturedRun.id);
    writeRunsFile([capturedRun, ...existingRuns]);

    console.log(`Recorded automation run: ${capturedRun.id}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
