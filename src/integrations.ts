import { FrontendIntegrationInfo, IntegrationAvailability, IntegrationInfo } from './types';

interface IntegrationRegistryItem {
    id: string;
    name: string;
    availability: IntegrationAvailability;
    capabilities: string[];
    keywords: string[];
}

const INTEGRATION_REGISTRY: IntegrationRegistryItem[] = [
    {
        id: 'meta_ads',
        name: 'Meta Ads',
        availability: 'available',
        capabilities: ['read ad account context', 'campaign summaries', 'creative performance signals'],
        keywords: ['meta', 'facebook ads', 'instagram ads', 'meta ads']
    },
    {
        id: 'tiktok_ads',
        name: 'TikTok Ads',
        availability: 'available',
        capabilities: ['read ad account context', 'campaign summaries', 'creative performance signals'],
        keywords: ['tiktok', 'tik tok', 'tiktok ads']
    },
    {
        id: 'slack',
        name: 'Slack',
        availability: 'available',
        capabilities: ['read channel updates', 'draft message responses', 'posting summaries'],
        keywords: ['slack', 'slack channel', 'message slack', 'post to slack']
    },
    {
        id: 'notion',
        name: 'Notion',
        availability: 'available',
        capabilities: ['read pages', 'read briefs', 'read databases', 'workspace docs'],
        keywords: ['notion', 'notion doc', 'notion page', 'brief from notion']
    },
    {
        id: 'google_analytics',
        name: 'Google Analytics',
        availability: 'available',
        capabilities: ['read traffic trends', 'read conversion trends', 'website analytics'],
        keywords: ['google analytics', 'ga4', 'website analytics', 'traffic analytics']
    },
    {
        id: 'shopify',
        name: 'Shopify',
        availability: 'available',
        capabilities: ['read store sales signals', 'read top products', 'conversion summaries'],
        keywords: ['shopify', 'store sales', 'shopify sales', 'shopify products']
    },
    {
        id: 'google_drive',
        name: 'Google Drive',
        availability: 'available',
        capabilities: ['read files', 'read recent briefs', 'drive documents'],
        keywords: ['google drive', 'drive', 'shared drive', 'brief from drive']
    },
    {
        id: 'hubspot',
        name: 'HubSpot',
        availability: 'coming_soon',
        capabilities: ['crm insights', 'deal summaries', 'marketing contact context'],
        keywords: ['hubspot', 'hub spot']
    },
    {
        id: 'salesforce',
        name: 'Salesforce',
        availability: 'coming_soon',
        capabilities: ['crm insights', 'pipeline context', 'account summaries'],
        keywords: ['salesforce', 'sales force']
    }
];

export function resolveIntegrations(connectedIntegrations: FrontendIntegrationInfo[] = []): IntegrationInfo[] {
    const connectedIds = new Set(connectedIntegrations.map((integration) => integration.id));

    return INTEGRATION_REGISTRY.map((integration) => ({
        id: integration.id,
        name: integration.name,
        availability: integration.availability,
        status: connectedIds.has(integration.id)
            ? 'connected'
            : integration.availability === 'available'
                ? 'available'
                : 'coming_soon',
        capabilities: [...integration.capabilities]
    }));
}

export function getConnectedIntegrationInputs(integrations: IntegrationInfo[]): FrontendIntegrationInfo[] {
    return integrations
        .filter((integration) => integration.status === 'connected')
        .map((integration) => ({
            id: integration.id,
            name: integration.name,
            status: 'connected'
        }));
}

export function getIntegrationRegistryItem(id: string): IntegrationRegistryItem | null {
    return INTEGRATION_REGISTRY.find((integration) => integration.id === id) || null;
}

export function findIntegrationByText(text: string, integrations: IntegrationInfo[] = resolveIntegrations()): IntegrationInfo | null {
    const normalized = text.toLowerCase();

    return (
        integrations.find((integration) => {
            const registryItem = getIntegrationRegistryItem(integration.id);
            if (!registryItem) {
                return false;
            }

            return [integration.name, ...registryItem.keywords].some((term) => normalized.includes(term.toLowerCase()));
        }) || null
    );
}
