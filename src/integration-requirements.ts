import { generateId, GlobalContext } from './context';
import { findIntegrationByText } from './integrations';
import { IntegrationInfo, IntegrationResultMode, IntegrationResultRecord, WorkspaceIntegrationInfo } from './types';

export interface IntegrationRequirementOptions {
    integrationId?: string;
    integration?: WorkspaceIntegrationInfo | null;
    searchText?: string;
    fallbackIntegration?: IntegrationInfo;
    mode: IntegrationResultMode;
    query: string;
    purpose: string;
    unknownContent?: string;
}

export interface IntegrationRequirementResult {
    integration: WorkspaceIntegrationInfo | null;
    block: IntegrationResultRecord | null;
}

const getIntegrationById = (context: GlobalContext, integrationId?: string): WorkspaceIntegrationInfo | null => {
    if (!integrationId) {
        return null;
    }

    return context.integrations.find((integration) => integration.id === integrationId) || null;
};

const buildBlockingResult = (
    integration: WorkspaceIntegrationInfo,
    options: IntegrationRequirementOptions
): IntegrationResultRecord | null => {
    if (integration.status === 'connected') {
        return null;
    }

    const canConnect = integration.status === 'available';

    return {
        id: generateId(options.mode === 'action' ? 'integration_action' : 'integration'),
        integrationId: integration.id,
        integrationName: integration.name,
        title: canConnect ? `${integration.name} connection required` : `${integration.name} is not available`,
        status: integration.status,
        mode: options.mode,
        actionStatus: canConnect ? 'connection_required' : 'unavailable',
        isBlocking: true,
        canConnect,
        query: options.query,
        content: canConnect
            ? `${integration.name} needs to be connected before I can ${options.purpose}. Connect ${integration.name} to continue this task.`
            : `${integration.name} is not available yet, so I cannot ${options.purpose} right now.`,
        shouldContinue: false,
        timestamp: Date.now()
    };
};

const buildFallbackBlockingResult = (options: IntegrationRequirementOptions): IntegrationResultRecord => {
    const fallbackIntegration = options.fallbackIntegration;
    const integrationId = fallbackIntegration?.id || 'unknown';
    const integrationName = fallbackIntegration?.name || 'Unknown Integration';

    return {
        id: generateId(options.mode === 'action' ? 'integration_action' : 'integration'),
        integrationId,
        integrationName,
        title: `${integrationName} connection required`,
        status: 'unknown',
        mode: options.mode,
        actionStatus: 'unknown',
        isBlocking: true,
        canConnect: false,
        query: options.query,
        content: options.unknownContent || `I could not map this request to a supported integration yet.`,
        shouldContinue: false,
        timestamp: Date.now()
    };
};

export function requireIntegration(context: GlobalContext, options: IntegrationRequirementOptions): IntegrationRequirementResult {
    const integration =
        options.integration ||
        getIntegrationById(context, options.integrationId) ||
        (options.searchText ? findIntegrationByText(options.searchText, context.integrations) : null);

    if (integration) {
        if (options.fallbackIntegration?.id === integration.id && options.fallbackIntegration.is_connected) {
            return {
                integration,
                block: null
            };
        }

        return {
            integration,
            block: buildBlockingResult(integration, options)
        };
    }

    if (options.fallbackIntegration?.is_connected) {
        return {
            integration: null,
            block: null
        };
    }

    return {
        integration: null,
        block: buildFallbackBlockingResult(options)
    };
}
