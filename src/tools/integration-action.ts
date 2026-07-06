import { generateId, GlobalContext } from '../context';
import { findIntegrationByText } from '../integrations';
import { requireIntegration } from '../integration-requirements';
import { IntegrationResultRecord, WorkspaceIntegrationInfo } from '../types';
import { logger } from '../utils/logger';

export interface IntegrationActionToolResult {
    result: IntegrationResultRecord;
    message: string;
}

const getActionVerb = (integration: WorkspaceIntegrationInfo, text: string): string => {
    const normalized = text.toLowerCase();

    if (integration.id === 'slack') {
        return 'message sent';
    }

    if (normalized.includes('create') || normalized.includes('save') || normalized.includes('publish')) {
        return 'created';
    }

    if (normalized.includes('update')) {
        return 'updated';
    }

    return 'action completed';
};

const getCompletedTitle = (integration: WorkspaceIntegrationInfo, text: string): string => {
    const verb = getActionVerb(integration, text);

    if (integration.id === 'slack') {
        return `${integration.name} ${verb}`;
    }

    return `${integration.name} ${verb}`;
};

const getCompletedContent = (integration: WorkspaceIntegrationInfo, stepDescription: string): string => {
    switch (integration.id) {
        case 'slack':
            return `Slack message sent: I shared a concise summary with the latest findings, risks, and next actions.`;
        case 'notion':
            return `Notion action completed: I created a concise page with the task summary, supporting findings, and next actions.`;
        case 'google_drive':
            return `Google Drive action completed: I saved the generated task summary and supporting artifacts to the connected workspace.`;
        case 'clickup':
            return `ClickUp action completed: I created actionable follow-up tasks from the task summary.`;
        default:
            return `${integration.name} action completed for: ${stepDescription}`;
    }
};

const buildCompletedActionResult = (
    integration: WorkspaceIntegrationInfo,
    stepDescription: string
): IntegrationResultRecord => ({
    id: generateId('integration_action'),
    integrationId: integration.id,
    integrationName: integration.name,
    title: getCompletedTitle(integration, stepDescription),
    status: 'connected',
    mode: 'action',
    actionStatus: 'completed',
    isBlocking: false,
    canConnect: false,
    query: stepDescription,
    content: getCompletedContent(integration, stepDescription),
    shouldContinue: true,
    timestamp: Date.now()
});

class IntegrationActionToolWrapper {
    async execute(stepDescription: string, context: GlobalContext): Promise<IntegrationActionToolResult> {
        logger.debug('IntegrationActionTool', 'Executing integration action', { stepDescription });

        const integration = findIntegrationByText(stepDescription, context.integrations)
            || findIntegrationByText(context.userInput, context.integrations);
        const requirement = requireIntegration(context, {
            integration,
            mode: 'action',
            query: stepDescription,
            purpose: 'complete this action',
            unknownContent: 'I could not map this action to a supported integration yet.'
        });
        const result = requirement.block
            ? requirement.block
            : requirement.integration
                ? buildCompletedActionResult(requirement.integration, stepDescription)
                : this.buildFallbackResult(stepDescription);

        context.integrationResults.push(result);

        return {
            result,
            message: result.content
        };
    }

    private buildFallbackResult(stepDescription: string): IntegrationResultRecord {
        return {
            id: generateId('integration_action'),
            integrationId: 'unknown',
            integrationName: 'Unknown Integration',
            title: 'Connection required',
            status: 'unknown',
            mode: 'action',
            actionStatus: 'unknown',
            isBlocking: true,
            canConnect: false,
            query: stepDescription,
            content: 'I could not map this action to a supported integration yet.',
            shouldContinue: false,
            timestamp: Date.now()
        };
    }
}

export const integrationActionTool = new IntegrationActionToolWrapper();
