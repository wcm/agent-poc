import { IntegrationAvailability, FrontendIntegrationInfo, WorkspaceIntegrationInfo } from './types';

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
        capabilities: ['read integration context', 'campaign summaries', 'creative performance signals'],
        keywords: ['meta', 'facebook ads', 'instagram ads', 'meta ads']
    },
    {
        id: 'tiktok_ads',
        name: 'TikTok Ads',
        availability: 'available',
        capabilities: ['read integration context', 'campaign summaries', 'creative performance signals'],
        keywords: ['tiktok', 'tik tok', 'tiktok ads']
    },
    {
        id: 'google_ads',
        name: 'Google Ads',
        availability: 'available',
        capabilities: ['read search campaigns', 'read YouTube campaign signals', 'performance insights'],
        keywords: ['google ads', 'google search', 'youtube ads']
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
        id: 'brand_guidelines',
        name: 'Brand Guidelines',
        availability: 'available',
        capabilities: ['read brand rules', 'read tone of voice', 'support brand-safe creative generation'],
        keywords: ['brand guidelines', 'brand guide', 'style guide', 'brand rules', 'brand voice', 'creative guidelines']
    },
    {
        id: 'slack',
        name: 'Slack',
        availability: 'available',
        capabilities: ['send summary messages', 'publish updates to channels', 'share task results'],
        keywords: ['slack', 'slack message', 'channel', 'workspace update', 'send summary']
    },
    {
        id: 'notion',
        name: 'Notion',
        availability: 'available',
        capabilities: ['create pages', 'update documents', 'publish task summaries'],
        keywords: ['notion', 'notion page', 'workspace doc', 'document']
    },
    {
        id: 'google_drive',
        name: 'Google Drive',
        availability: 'available',
        capabilities: ['create files', 'update documents', 'save generated reports'],
        keywords: ['google drive', 'drive', 'docs', 'document', 'file']
    },
    {
        id: 'clickup',
        name: 'ClickUp',
        availability: 'available',
        capabilities: ['create tasks', 'update tasks', 'publish action items'],
        keywords: ['clickup', 'click up', 'task', 'project management']
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

export function resolveIntegrations(connectedIntegrations: FrontendIntegrationInfo[] = []): WorkspaceIntegrationInfo[] {
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

export function getConnectedIntegrationInputs(integrations: WorkspaceIntegrationInfo[]): FrontendIntegrationInfo[] {
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

export function findIntegrationByText(text: string, integrations: WorkspaceIntegrationInfo[] = resolveIntegrations()): WorkspaceIntegrationInfo | null {
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
