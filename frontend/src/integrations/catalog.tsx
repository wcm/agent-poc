import React from "react";
import { Integration } from "../types";
import { ServiceLogoImage, TiledServiceLogo, ServiceLogoId } from "../components/icons/ServiceLogos";

export type IntegrationSectionId = "dataSources" | "communication" | "myConnections";
export type IntegrationAvailability = "available" | "coming_soon";
export type IntegrationStatus = "connected" | "available" | "coming_soon";
export type IntegrationState = Record<string, boolean>;
export type IntegrationLogoVariant = "default" | "bare";

export const BRAND_GUIDELINES_INTEGRATION_ID = "brand_guidelines";

export interface IntegrationDefinition {
	id: string;
	name: string;
	description: string;
	defaultConnectedAccountName?: string;
	section: IntegrationSectionId;
	availability: IntegrationAvailability;
	defaultConnected?: boolean;
	backendIntegrationIds?: string[];
	searchTerms?: string[];
	renderLogo: (size?: number, variant?: IntegrationLogoVariant) => React.ReactNode;
}

export interface ResolvedIntegration extends IntegrationDefinition {
	integration: Integration | null;
	connectedAccountName: string | null;
	isConnected: boolean;
	status: IntegrationStatus;
}

export const INTEGRATION_SECTIONS: Array<{ id: IntegrationSectionId; label: string }> = [
	{ id: "dataSources", label: "Data Sources" },
	{ id: "communication", label: "Communication" },
	{ id: "myConnections", label: "My Connections" },
];

export const INTEGRATIONS_PAGE_SECTIONS = INTEGRATION_SECTIONS.filter((section) => section.id !== "myConnections");

const createServiceLogoRenderer =
	(logoId: ServiceLogoId, alt: string) => (size = 24, variant: IntegrationLogoVariant = "default") =>
		variant === "bare" ? (
			<ServiceLogoImage logoId={logoId} alt={alt} size={size} />
		) : (
			<TiledServiceLogo logoId={logoId} alt={alt} size={size} />
		);

const renderBrandGuidelinesLogo = (size = 24, variant: IntegrationLogoVariant = "default") => {
	const markSize = variant === "bare" ? size : Math.round(size * 0.72);
	const mark = (
		<span
			aria-label="Brand Guidelines"
			role="img"
			style={{
				width: markSize,
				height: markSize,
				borderRadius: Math.max(6, Math.round(markSize * 0.28)),
				background: "#111827",
				color: "#ffffff",
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: Math.max(8, Math.round(markSize * 0.34)),
				fontWeight: 700,
				lineHeight: 1,
				letterSpacing: 0,
				flexShrink: 0,
			}}
		>
			BG
		</span>
	);

	if (variant === "bare") {
		return mark;
	}

	return (
		<span
			style={{
				width: size,
				height: size,
				borderRadius: Math.max(10, Math.round(size * 0.32)),
				background: "#ffffff",
				border: "1px solid #e2e8f0",
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				flexShrink: 0,
				overflow: "hidden",
			}}
		>
			{mark}
		</span>
	);
};

export const INTEGRATIONS: IntegrationDefinition[] = [
	{
		id: "meta_ads",
		name: "Meta Ads",
		description: "Access Meta campaigns and performance insights.",
		defaultConnectedAccountName: "NIKE Official Meta",
		section: "dataSources",
		availability: "available",
		backendIntegrationIds: ["meta_ads"],
		searchTerms: ["meta", "facebook", "instagram", "ads"],
		renderLogo: createServiceLogoRenderer("meta", "Meta Ads"),
	},
	{
		id: "tiktok_ads",
		name: "TikTok Ads",
		description: "Access TikTok campaigns and performance insights.",
		defaultConnectedAccountName: "NIKE TikTok",
		section: "dataSources",
		availability: "available",
		backendIntegrationIds: ["tiktok_ads"],
		searchTerms: ["tiktok", "ads", "paid"],
		renderLogo: createServiceLogoRenderer("tiktok", "TikTok Ads"),
	},
	{
		id: "google_ads",
		name: "Google Ads",
		description: "Access Google Ads campaigns, search terms, and performance insights.",
		defaultConnectedAccountName: "NIKE Google Ads US",
		section: "dataSources",
		availability: "available",
		searchTerms: ["google ads", "google", "search", "youtube", "paid"],
		renderLogo: createServiceLogoRenderer("google_ads", "Google Ads"),
	},
	{
		id: "google_analytics",
		name: "Google Analytics",
		description: "Access website analytics and audience insights.",
		defaultConnectedAccountName: "NIKE GA4 US",
		section: "dataSources",
		availability: "available",
		searchTerms: ["ga4", "analytics", "traffic", "website"],
		renderLogo: createServiceLogoRenderer("google_analytics", "Google Analytics"),
	},
	{
		id: "shopify",
		name: "Shopify",
		description: "Connect your Shopify store for sales analytics and product insights.",
		defaultConnectedAccountName: "NIKE DTC Store",
		section: "dataSources",
		availability: "available",
		searchTerms: ["shopify", "store", "sales", "commerce"],
		renderLogo: createServiceLogoRenderer("shopify", "Shopify"),
	},
	{
		id: "hubspot",
		name: "HubSpot",
		description: "Access your HubSpot CRM contacts, deals, and marketing data.",
		section: "dataSources",
		availability: "coming_soon",
		searchTerms: ["hubspot", "crm", "marketing", "sales"],
		renderLogo: createServiceLogoRenderer("hubspot", "HubSpot"),
	},
	{
		id: "salesforce",
		name: "Salesforce",
		description: "Connect your Salesforce data for pipeline and account insights.",
		section: "dataSources",
		availability: "coming_soon",
		searchTerms: ["salesforce", "crm", "pipeline"],
		renderLogo: createServiceLogoRenderer("salesforce", "Salesforce"),
	},
	{
		id: "slack",
		name: "Use Raya in Slack",
		description: "Bring Raya into Slack channels and threads for faster collaboration.",
		defaultConnectedAccountName: "#nike-marketing",
		section: "communication",
		availability: "available",
		searchTerms: ["slack", "communication", "chat", "workspace", "channel"],
		renderLogo: createServiceLogoRenderer("slack", "Slack"),
	},
	{
		id: BRAND_GUIDELINES_INTEGRATION_ID,
		name: "Brand Guidelines",
		description: "Connect brand rules, voice, visual style, and creative guardrails for generation tasks.",
		defaultConnectedAccountName: "Nike Brand Guidelines",
		section: "myConnections",
		availability: "available",
		searchTerms: ["brand guidelines", "brand guide", "style guide", "brand voice", "creative rules", "tone"],
		renderLogo: renderBrandGuidelinesLogo,
	},
	{
		id: "notion",
		name: "Notion",
		description: "Let Raya read, create, and update documents in Notion.",
		defaultConnectedAccountName: "Nike Notion Workspace",
		section: "myConnections",
		availability: "available",
		searchTerms: ["notion", "workspace", "docs", "wiki", "knowledge"],
		renderLogo: createServiceLogoRenderer("notion", "Notion"),
	},
	{
		id: "google_drive",
		name: "Google Drive",
		description: "Let Raya read, create, and update files in Google Drive.",
		defaultConnectedAccountName: "Nike Shared Drive",
		section: "myConnections",
		availability: "available",
		searchTerms: ["google drive", "drive", "documents", "files"],
		renderLogo: createServiceLogoRenderer("google_drive", "Google Drive"),
	},
	{
		id: "clickup",
		name: "ClickUp",
		description: "Let Raya read, create, and update tasks in ClickUp.",
		defaultConnectedAccountName: "Nike Creative Ops",
		section: "myConnections",
		availability: "available",
		searchTerms: ["clickup", "tasks", "project management", "workflow"],
		renderLogo: createServiceLogoRenderer("clickup", "ClickUp"),
	},
	{
		id: "asana",
		name: "Asana",
		description: "Let Raya read, create, and update tasks in Asana.",
		defaultConnectedAccountName: "Nike Campaign Planning",
		section: "myConnections",
		availability: "available",
		searchTerms: ["asana", "tasks", "project management", "workflow"],
		renderLogo: createServiceLogoRenderer("asana", "Asana"),
	},
];

const matchesIntegration = (definition: IntegrationDefinition, integration: Integration) => {
	if (!integration.is_connected) {
		return false;
	}

	return definition.backendIntegrationIds?.includes(integration.id) ?? false;
};

export const getInitialIntegrationState = (): IntegrationState =>
	INTEGRATIONS.reduce<IntegrationState>((accumulator, integration) => {
		if (integration.defaultConnected) {
			accumulator[integration.id] = true;
		}
		return accumulator;
	}, {});

export const resolveIntegrations = (integrations: Integration[], integrationState: IntegrationState = {}): ResolvedIntegration[] =>
	INTEGRATIONS.map((definition) => {
		const matchedIntegration = integrations.find((candidate) => matchesIntegration(definition, candidate)) ?? null;
		const isConnected = matchedIntegration ? true : Boolean(integrationState[definition.id] ?? definition.defaultConnected ?? false);
		const status: IntegrationStatus = isConnected ? "connected" : definition.availability === "available" ? "available" : "coming_soon";
		const connectedAccountName = matchedIntegration?.name ?? (isConnected ? definition.defaultConnectedAccountName ?? null : null);

		return {
			...definition,
			integration: matchedIntegration,
			connectedAccountName,
			isConnected,
			status,
		};
	});

export const getConnectableIntegrationId = (integration: IntegrationDefinition | ResolvedIntegration) => integration.backendIntegrationIds?.[0] ?? null;

export const getIntegrationDefinitionById = (integrationId: string) => INTEGRATIONS.find((integration) => integration.id === integrationId) ?? null;

export const getConnectedIntegrations = (integrations: Integration[], integrationState: IntegrationState = {}) =>
	resolveIntegrations(integrations, integrationState).filter((integration) => integration.isConnected);

export const QUICK_ADD_INTEGRATION_IDS = ["meta_ads", "tiktok_ads"] as const;

export const getQuickAddIntegrations = (integrations: Integration[], integrationState: IntegrationState = {}) =>
	resolveIntegrations(integrations, integrationState).filter((integration) => QUICK_ADD_INTEGRATION_IDS.includes(integration.id as (typeof QUICK_ADD_INTEGRATION_IDS)[number]));

export const filterIntegrations = (integrations: ResolvedIntegration[], query: string) => {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return integrations;
	}

	return integrations.filter((integration) => {
		const haystack = [integration.name, integration.description, integration.connectedAccountName ?? "", ...(integration.searchTerms ?? [])].join(" ").toLowerCase();
		return haystack.includes(normalized);
	});
};
