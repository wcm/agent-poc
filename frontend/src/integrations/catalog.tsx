import React from "react";
import { Channel } from "../types";
import { TiledServiceLogo } from "../components/icons/ServiceLogos";

export type IntegrationSectionId = "recommended" | "comingSoon";
export type IntegrationAvailability = "available" | "coming_soon";
export type IntegrationStatus = "connected" | "available" | "coming_soon";
export type IntegrationConnectionState = Record<string, boolean>;

export interface IntegrationDefinition {
	id: string;
	name: string;
	description: string;
	section: IntegrationSectionId;
	availability: IntegrationAvailability;
	defaultConnected?: boolean;
	backendChannelIds?: string[];
	searchTerms?: string[];
	renderLogo: (size?: number) => React.ReactNode;
}

export interface ResolvedIntegration extends IntegrationDefinition {
	channel: Channel | null;
	isConnected: boolean;
	status: IntegrationStatus;
}

export const INTEGRATION_SECTIONS: Array<{ id: IntegrationSectionId; label: string }> = [
	{ id: "recommended", label: "Recommended" },
	{ id: "comingSoon", label: "Coming Soon" },
];

export const INTEGRATION_STATE_STORAGE_KEY = "raya.integration.connection.state";

export const INTEGRATIONS: IntegrationDefinition[] = [
	{
		id: "meta_ads",
		name: "Meta Ads",
		description: "Access your ad accounts, campaigns, and performance insights.",
		section: "recommended",
		availability: "available",
		backendChannelIds: ["channel_1"],
		searchTerms: ["meta", "facebook", "instagram", "ads"],
		renderLogo: (size = 24) => <TiledServiceLogo logoId="meta" alt="Meta Ads" size={size} />,
	},
	{
		id: "tiktok_ads",
		name: "TikTok Ads",
		description: "Access your TikTok ad accounts and campaign performance.",
		section: "recommended",
		availability: "available",
		backendChannelIds: ["channel_2"],
		searchTerms: ["tiktok", "ads", "paid"],
		renderLogo: (size = 24) => <TiledServiceLogo logoId="tiktok" alt="TikTok Ads" size={size} />,
	},
	{
		id: "slack",
		name: "Slack",
		description: "Send messages to channels and users in your Slack workspace.",
		section: "recommended",
		availability: "available",
		defaultConnected: true,
		searchTerms: ["slack", "workspace", "messages"],
		renderLogo: (size = 24) => <TiledServiceLogo logoId="slack" alt="Slack" size={size} />,
	},
	{
		id: "notion",
		name: "Notion",
		description: "Sync pages and databases from your Notion workspace.",
		section: "recommended",
		availability: "available",
		searchTerms: ["notion", "docs", "database", "wiki"],
		renderLogo: (size = 24) => <TiledServiceLogo logoId="notion" alt="Notion" size={size} />,
	},
	{
		id: "google_analytics",
		name: "Google Analytics",
		description: "Access website analytics and audience insights.",
		section: "recommended",
		availability: "available",
		searchTerms: ["ga4", "analytics", "traffic", "website"],
		renderLogo: (size = 24) => <TiledServiceLogo logoId="google_analytics" alt="Google Analytics" size={size} />,
	},
	{
		id: "shopify",
		name: "Shopify",
		description: "Connect your Shopify store for sales analytics and product insights.",
		section: "recommended",
		availability: "available",
		searchTerms: ["shopify", "store", "sales", "commerce"],
		renderLogo: (size = 24) => <TiledServiceLogo logoId="shopify" alt="Shopify" size={size} />,
	},
	{
		id: "google_drive",
		name: "Google Drive",
		description: "Access briefs, reports, and creative assets from your shared drives.",
		section: "recommended",
		availability: "available",
		searchTerms: ["drive", "google drive", "files", "docs"],
		renderLogo: (size = 24) => <TiledServiceLogo logoId="google_drive" alt="Google Drive" size={size} />,
	},
	{
		id: "hubspot",
		name: "HubSpot",
		description: "Access your HubSpot CRM contacts, deals, and marketing data.",
		section: "comingSoon",
		availability: "coming_soon",
		searchTerms: ["hubspot", "crm", "marketing", "sales"],
		renderLogo: (size = 24) => <TiledServiceLogo logoId="hubspot" alt="HubSpot" size={size} />,
	},
	{
		id: "salesforce",
		name: "Salesforce",
		description: "Connect your Salesforce data for pipeline and account insights.",
		section: "comingSoon",
		availability: "coming_soon",
		searchTerms: ["salesforce", "crm", "pipeline"],
		renderLogo: (size = 24) => <TiledServiceLogo logoId="salesforce" alt="Salesforce" size={size} />,
	},
];

const matchesChannel = (integration: IntegrationDefinition, channel: Channel) => {
	if (!channel.is_connected) {
		return false;
	}

	return integration.backendChannelIds?.includes(channel.id) ?? false;
};

export const getInitialIntegrationConnectionState = (): IntegrationConnectionState =>
	INTEGRATIONS.reduce<IntegrationConnectionState>((accumulator, integration) => {
		if (integration.defaultConnected) {
			accumulator[integration.id] = true;
		}
		return accumulator;
	}, {});

export const resolveIntegrations = (channels: Channel[], connectionState: IntegrationConnectionState = {}): ResolvedIntegration[] =>
	INTEGRATIONS.map((integration) => {
		const channel = channels.find((candidate) => matchesChannel(integration, candidate)) ?? null;
		const isConnected = channel ? true : Boolean(connectionState[integration.id] ?? integration.defaultConnected ?? false);
		const status: IntegrationStatus = isConnected ? "connected" : integration.availability === "available" ? "available" : "coming_soon";

		return {
			...integration,
			channel,
			isConnected,
			status,
		};
	});

export const getConnectableChannelId = (integration: IntegrationDefinition | ResolvedIntegration) => integration.backendChannelIds?.[0] ?? null;

export const getIntegrationDefinitionById = (integrationId: string) => INTEGRATIONS.find((integration) => integration.id === integrationId) ?? null;

export const getConnectedIntegrations = (channels: Channel[], connectionState: IntegrationConnectionState = {}) =>
	resolveIntegrations(channels, connectionState).filter((integration) => integration.isConnected);

export const QUICK_ADD_INTEGRATION_IDS = ["meta_ads", "tiktok_ads"] as const;

export const getQuickAddIntegrations = (channels: Channel[], connectionState: IntegrationConnectionState = {}) =>
	resolveIntegrations(channels, connectionState).filter((integration) => QUICK_ADD_INTEGRATION_IDS.includes(integration.id as (typeof QUICK_ADD_INTEGRATION_IDS)[number]));

export const filterIntegrations = (integrations: ResolvedIntegration[], query: string) => {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return integrations;
	}

	return integrations.filter((integration) => {
		const haystack = [integration.name, integration.description, ...(integration.searchTerms ?? [])].join(" ").toLowerCase();
		return haystack.includes(normalized);
	});
};
