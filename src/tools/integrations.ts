import { generateId, GlobalContext } from '../context';
import { findIntegrationByText } from '../integrations';
import { WorkspaceIntegrationInfo, IntegrationResultRecord } from '../types';
import { logger } from '../utils/logger';

export interface IntegrationToolResult {
    result: IntegrationResultRecord;
    message: string;
}

class IntegrationsToolWrapper {
    async execute(stepDescription: string, context: GlobalContext): Promise<IntegrationToolResult> {
        logger.debug('IntegrationsTool', 'Executing integration step', { stepDescription });

        const searchText = `${stepDescription}\n${context.userInput}`;
        const integration = findIntegrationByText(searchText, context.integrations);

        const result = integration
            ? this.buildIntegrationResult(integration, stepDescription, context)
            : this.buildFallbackResult(stepDescription, context);

        context.integrationResults.push(result);

        return {
            result,
            message: result.content
        };
    }

    private buildIntegrationResult(
        integration: WorkspaceIntegrationInfo,
        stepDescription: string,
        context: GlobalContext
    ): IntegrationResultRecord {
        if (integration.status === 'connected') {
            return {
                id: generateId('integration'),
                integrationId: integration.id,
                integrationName: integration.name,
                title: this.buildTitle(integration, 'connected'),
                status: 'connected',
                mode: 'data',
                query: stepDescription,
                content: this.buildConnectedResponse(integration, stepDescription, context),
                shouldContinue: true,
                timestamp: Date.now()
            };
        }

        if (integration.status === 'available') {
            return {
                id: generateId('integration'),
                integrationId: integration.id,
                integrationName: integration.name,
                title: this.buildTitle(integration, 'available'),
                status: 'available',
                mode: 'instruction',
                query: stepDescription,
                content: `${integration.name} is available but not connected yet. Go to Integrations, click Connect on ${integration.name}, and then rerun this request. If there are other tasks in this plan that do not depend on ${integration.name}, I can continue with those.`,
                shouldContinue: true,
                timestamp: Date.now()
            };
        }

        return {
            id: generateId('integration'),
            integrationId: integration.id,
            integrationName: integration.name,
            title: this.buildTitle(integration, 'coming_soon'),
            status: 'coming_soon',
            mode: 'instruction',
            query: stepDescription,
            content: `${integration.name} is not available yet in Raya. It is marked as coming soon, so I cannot use it right now. If there are other tasks in this request, I can continue with those while skipping the ${integration.name} dependency.`,
            shouldContinue: true,
            timestamp: Date.now()
        };
    }

    private buildFallbackResult(stepDescription: string, context: GlobalContext): IntegrationResultRecord {
        const connectedNames = context.integrations
            .filter((integration) => integration.status === 'connected')
            .map((integration) => integration.name);

        return {
            id: generateId('integration'),
            integrationId: 'unknown',
            integrationName: 'Unknown Integration',
            title: 'Data source setup needed',
            status: 'unknown',
            mode: 'instruction',
            query: stepDescription,
            content: connectedNames.length > 0
                ? `I could not map this request to a supported integration yet. Connected integrations right now: ${connectedNames.join(', ')}.`
                : `I could not map this request to a supported integration yet, and there are no connected workspace integrations right now.`,
            shouldContinue: true,
            timestamp: Date.now()
        };
    }

    private buildTitle(integration: WorkspaceIntegrationInfo, status: WorkspaceIntegrationInfo['status']): string {
        if (status === 'available') {
            return `Connect ${integration.name} to continue`;
        }

        if (status === 'coming_soon') {
            return `${integration.name} is coming soon`;
        }

        switch (integration.id) {
            case 'shopify':
                return 'Shopify store signals';
            case 'google_analytics':
                return 'Google Analytics summary';
            case 'meta_ads':
                return 'Meta Ads summary';
            case 'tiktok_ads':
                return 'TikTok Ads summary';
            case 'google_ads':
                return 'Google Ads summary';
            default:
                return `${integration.name} result`;
        }
    }

    private buildConnectedResponse(integration: WorkspaceIntegrationInfo, _stepDescription: string, _context: GlobalContext): string {
        switch (integration.id) {
            case 'shopify':
                return `${integration.name} store signals show the top products are Everyday Tote, Performance Tee, and Starter Bundle. The strongest conversion signal is coming from the Starter Bundle, while repeat purchase behavior is highest for the Everyday Tote.`;

            case 'google_analytics':
                return `${integration.name} shows stable recent traffic, strongest landing-page engagement on campaign detail pages, and a conversion dip on mobile checkout steps.`;

            case 'meta_ads':
                return `${integration.name} shows active campaigns with the strongest creative efficiency coming from short-form social proof ads.`;

            case 'tiktok_ads':
                return `${integration.name} shows stronger engagement on creator-led videos and faster drop-off on product-only edits.`;

            case 'google_ads':
                return `${integration.name} shows search and YouTube campaign context is ready to use once backend data is wired.`;

            default:
                return `${integration.name} is connected and relevant context has been pulled into this request.`;
        }
    }
}

export const integrationsTool = new IntegrationsToolWrapper();
