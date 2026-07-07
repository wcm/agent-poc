import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { Agent } from './agent';
import { AdData, CreativeReport, UserContext, createEmptyContext, generateId } from './context';
import { FocusedItemCard, IntegrationInfo, StreamEmitter } from './types';
import { imageGenerationTool } from './tools/image-generation';
import {
    GeneratedImageFileRecord,
    GeneratedImageRun,
    GeneratedImageSourceAd,
    GENERATED_IMAGE_ASSETS_ROUTE,
    getGeneratedImageAssetsDir,
    getGeneratedImageManifestPath,
    persistGeneratedImagePayload,
    readGeneratedImageManifest,
    writeGeneratedImageManifest
} from './generated-image-files';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Store agent instances per session for isolation
const agents = new Map<string, Agent>();
const streamContexts = new Map<string, UserContext | undefined>();
const STREAM_CONTEXT_TTL_MS = 10 * 60 * 1000;

function getAgent(sessionId: string): Agent {
    if (!agents.has(sessionId)) {
        logger.session(sessionId, 'CREATE');
        agents.set(sessionId, new Agent());
    } else {
        logger.session(sessionId, 'ACCESS');
    }
    return agents.get(sessionId)!;
}

function getStreamContextId(req: Request): string | undefined {
    return typeof req.query.contextId === 'string' ? req.query.contextId : undefined;
}

function scheduleStreamContextCleanup(contextId: string): void {
    const timeout = setTimeout(() => {
        streamContexts.delete(contextId);
    }, STREAM_CONTEXT_TTL_MS);
    timeout.unref?.();
}

function getUserContextFromRequest(req: Request, action: string): UserContext | undefined {
    const contextId = getStreamContextId(req);
    if (contextId) {
        if (!streamContexts.has(contextId)) {
            logger.log('WARN', { component: 'Server', action }, `Stream context not found: ${contextId}`);
            return undefined;
        }
        return streamContexts.get(contextId);
    }

    if (!req.query.context) {
        return undefined;
    }

    try {
        return JSON.parse(req.query.context as string);
    } catch (e) {
        logger.log('WARN', { component: 'Server', action }, 'Failed to parse context');
        return undefined;
    }
}

// Helper to read/write data
const DATA_DIR = path.join(process.cwd(), 'src', 'data');

app.use(GENERATED_IMAGE_ASSETS_ROUTE, express.static(getGeneratedImageAssetsDir(DATA_DIR)));

const readJson = async (filename: string) => {
    const data = await fs.promises.readFile(path.join(DATA_DIR, filename), 'utf-8');
    return JSON.parse(data);
};

const writeJson = async (filename: string, data: any) => {
    await fs.promises.writeFile(path.join(DATA_DIR, filename), JSON.stringify(data, null, 4), 'utf-8');
};

const parseBoundedInt = (value: unknown, fallback: number, min: number, max: number): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, Math.floor(parsed)));
};

const getAdName = (ad: Partial<AdData>): string =>
    ad.ad_name || ad.group_value || ad.creative_name || ad.headline || 'Untitled ad';

const toGeneratedImageSourceAd = (ad: AdData): GeneratedImageSourceAd => ({
    id: ad.id,
    name: getAdName(ad),
    creativeName: ad.creative_name,
    headline: ad.headline,
    adCopy: ad.ad_copy,
    imageUrl: ad.image_url,
    integrationId: ad.integration_id,
    status: ad.status,
    startDate: (ad as any).start_date,
    endDate: (ad as any).end_date,
    metrics: ad.metrics ? { ...ad.metrics } : undefined
});

const toFocusedItemCard = (ad: AdData): FocusedItemCard => ({
    id: ad.id,
    name: getAdName(ad),
    thumbnail: ad.image_url,
    type: 'ad',
    displayFormat: 'image',
    metrics: {
        roas: ad.metrics?.roas,
        spend: ad.metrics?.spend,
        ctr: ad.metrics?.ctr,
        impressions: ad.metrics?.impressions,
        cpc: ad.metrics?.cpc
    }
});

const buildBatchCreativeReport = (ad: AdData): CreativeReport => {
    const metrics = ad.metrics || ({} as AdData['metrics']);
    const sourceName = getAdName(ad);

    return {
        id: generateId('batch-creative-report'),
        focusSetId: 'files-batch-generation',
        itemId: ad.id,
        itemName: sourceName,
        timestamp: Date.now(),
        content: `### Creative Profile

| Attribute | Tags |
|-----------|------|
| **Target Persona** | runners, sneaker buyers, sport lifestyle |
| **Core Desire** | performance, identity, confidence |
| **USP** | Nike product design, recognizable style |
| **Theme** | movement, aspiration, product hero |
| **Key Message** | ${ad.headline || 'Nike performance story'} |
| **Emotion** | momentum, confidence, desire |
| **Visual Hook** | product-led footwear image |
| **Offer Type** | ${ad.ad_copy?.toLowerCase().includes('limited') ? 'limited stock' : 'shop now'} |

### Source Ad
- Name: ${sourceName}
- Creative: ${ad.creative_name || 'Unknown'}
- Headline: ${ad.headline || 'N/A'}
- Copy: ${ad.ad_copy || 'N/A'}
- ROAS: ${metrics.roas ?? 'N/A'}
- Spend: ${metrics.spend ? `$${metrics.spend.toFixed(0)}` : 'N/A'}
- CTR: ${metrics.ctr !== undefined ? `${metrics.ctr.toFixed(2)}%` : 'N/A'}

### Recommendations
- Keep the product unmistakably central while making each variation explore a distinct shopper motivation.
- Preserve the Nike performance tone, but vary the setting, offer framing, and emotional hook.
- Create clean square image ads that can work as Meta feed placements.`
    };
};

const stripGeneratedImageRecordForClient = (record: GeneratedImageFileRecord): GeneratedImageFileRecord => ({
    ...record,
    originalGeneratedImageUrl: record.isLocal ? undefined : record.originalGeneratedImageUrl,
    generation: {
        ...record.generation,
        request: record.generation.request
            ? {
                url: record.generation.request.url,
                model: record.generation.request.model,
                prompt: record.generation.request.prompt,
                originalImageUrl: record.generation.request.originalImageUrl,
                logoUrl: record.generation.request.logoUrl
            }
            : undefined,
        response: undefined,
        providerImage: undefined
    }
});

const getGeneratedImageManifestForClient = (manifest: Awaited<ReturnType<typeof readGeneratedImageManifest>>, includeRaw: boolean) =>
    includeRaw
        ? manifest
        : {
            ...manifest,
            images: manifest.images.map(stripGeneratedImageRecordForClient)
        };

app.post('/api/stream/context', (req: Request, res: Response) => {
    const contextId = generateId('stream-context');
    streamContexts.set(contextId, req.body?.context as UserContext | undefined);
    scheduleStreamContextCleanup(contextId);
    res.json({ contextId });
});

app.get('/api/stream', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const message = req.query.message as string;
    const integrationId = (req.query.integrationId as string) || 'meta_ads';
    const sessionId = (req.query.sessionId as string) || 'default';
    
    const contextId = getStreamContextId(req);
    const userContext = getUserContextFromRequest(req, 'PARSE_CONTEXT');

    if (!message) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: "Message required" })}\n\n`);
        res.end();
        return;
    }

    // Get or create agent for this session
    const agent = getAgent(sessionId);

    // Listen for stream events from the agent and forward them to the client
    const onStream = (event: any) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    agent.on('stream', onStream);

    try {
        // handleRequest streams events and returns void
        await agent.handleRequest(message, integrationId, userContext);
    } catch (error: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } finally {
        if (contextId) {
            streamContexts.delete(contextId);
        }
        // Clean up listener to avoid leaks
        agent.off('stream', onStream);
        res.end();
    }
});

app.get('/api/stream/resume', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sessionId = (req.query.sessionId as string) || 'default';
    const integrationId = req.query.integrationId as string;

    const contextId = getStreamContextId(req);
    const userContext = getUserContextFromRequest(req, 'PARSE_RESUME_CONTEXT');

    if (!integrationId) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: "Integration required" })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
        return;
    }

    const agent = getAgent(sessionId);

    const onStream = (event: any) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    agent.on('stream', onStream);

    try {
        await agent.resumeAfterConnection(integrationId, userContext);
    } catch (error: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } finally {
        if (contextId) {
            streamContexts.delete(contextId);
        }
        agent.off('stream', onStream);
        res.end();
    }
});

app.post('/api/clear', (req: Request, res: Response) => {
    const sessionId = req.body?.sessionId;
    if (sessionId && agents.has(sessionId)) {
        agents.get(sessionId)?.clearHistory();
        agents.delete(sessionId);
        logger.session(sessionId, 'DELETE');
        res.json({ message: 'Session cleared' });
        return;
    }

    if (!sessionId) {
        agents.forEach((agent, id) => {
            agent.clearHistory();
            logger.session(id, 'DELETE');
        });
        agents.clear();
        res.json({ message: 'All sessions cleared' });
        return;
    }

    res.json({ message: 'Session not found' });
});

// --- Generated Files Endpoints ---

app.get('/api/files/generated-image-ads', async (req: Request, res: Response) => {
    try {
        const manifest = await readGeneratedImageManifest(DATA_DIR);
        const includeRaw = req.query.includeRaw === 'true' || req.query.includeRaw === '1';
        res.json({
            ...getGeneratedImageManifestForClient(manifest, includeRaw),
            manifestPath: path.relative(process.cwd(), getGeneratedImageManifestPath(DATA_DIR))
        });
    } catch (error: any) {
        console.error('Error loading generated image ads:', error);
        res.status(500).json({ error: 'Failed to load generated image ads' });
    }
});

app.post('/api/files/generated-image-ads/generate', async (req: Request, res: Response) => {
    const requestedCount = parseBoundedInt(req.body?.count ?? req.query.count, 12, 1, 24);
    const conceptsPerSource = parseBoundedInt(req.body?.conceptsPerSource ?? req.query.conceptsPerSource, 4, 1, 6);
    const integrationId = String(req.body?.integrationId ?? req.query.integrationId ?? 'meta_ads');
    const requestIntegrations = Array.isArray(req.body?.integrations) ? req.body.integrations : [];
    const hasBrandGuidelinesConnection =
        Boolean(req.body?.brandGuidelinesConnected) ||
        requestIntegrations.some((integration: any) =>
            typeof integration === 'string'
                ? integration === 'brand_guidelines'
                : integration?.id === 'brand_guidelines' && integration?.status === 'connected'
        );
    const includeInactive = Boolean(req.body?.includeInactive ?? req.query.includeInactive);
    const runId = generateId('image-run');
    const createdAt = new Date().toISOString();
    const newRecords: GeneratedImageFileRecord[] = [];
    const errors: GeneratedImageRun['errors'] = [];

    if (!hasBrandGuidelinesConnection) {
        res.status(428).json({
            error: 'Brand Guidelines connection required before generating image variations.',
            integrationId: 'brand_guidelines',
            integrationName: 'Brand Guidelines'
        });
        return;
    }

    try {
        const analytics = await readJson('own-analytics.json');
        const ownBrands = await readJson('own-brands.json').catch(() => []);
        const integrations = (analytics.integrations || []) as IntegrationInfo[];
        const integration = integrations.find((item) => item.id === integrationId) || integrations[0] || {
            id: integrationId,
            name: integrationId,
            platform: 'unknown',
            account_id: '',
            is_connected: false
        };

        const imageAds = ((analytics.ads || []) as AdData[])
            .filter((ad) => ad.display_format === 'image')
            .filter((ad) => !integrationId || ad.integration_id === integrationId)
            .filter((ad) => includeInactive || ad.status === 'active')
            .sort((a, b) => {
                const roasDelta = (b.metrics?.roas || 0) - (a.metrics?.roas || 0);
                if (roasDelta !== 0) return roasDelta;
                return (b.metrics?.spend || 0) - (a.metrics?.spend || 0);
            });

        if (imageAds.length === 0) {
            res.status(400).json({ error: 'No image ads available for generation' });
            return;
        }

        const sourceCount = Math.min(imageAds.length, Math.ceil(requestedCount / conceptsPerSource));
        const selectedAds = imageAds.slice(0, sourceCount);
        const sourceAds = selectedAds.map(toGeneratedImageSourceAd);
        const generationContext = createEmptyContext(integration, `Generate ${requestedCount} image ad variations for the Files library`, {
            brands: ownBrands.map((brand: any) => ({
                ...brand,
                is_followed: brand.is_followed ?? true
            }))
        });
        const noopStream: StreamEmitter = () => undefined;

        for (const ad of selectedAds) {
            const remaining = requestedCount - newRecords.length;
            if (remaining <= 0) {
                break;
            }

            const conceptsForAd = Math.min(conceptsPerSource, remaining);
            const item = toFocusedItemCard(ad);
            const report = buildBatchCreativeReport(ad);
            const sourceAd = toGeneratedImageSourceAd(ad);

            try {
                const result = await imageGenerationTool.execute(
                    item,
                    report,
                    generationContext,
                    noopStream,
                    conceptsForAd,
                    {
                        persistImage: async (input) =>
                            persistGeneratedImagePayload(
                                DATA_DIR,
                                `${runId}-${input.item.id}-${input.conceptIndex + 1}`,
                                input.imageUrl
                            )
                    }
                );

                result.concepts.forEach((concept, conceptIndex) => {
                    const imageResponse = result.metadata?.imageResponses?.[conceptIndex];
                    const recordId = generateId('image-file');
                    newRecords.push({
                        id: recordId,
                        runId,
                        kind: 'image_ad_variation',
                        status: concept.status === 'done' ? 'done' : 'failed',
                        createdAt: new Date().toISOString(),
                        itemId: item.id,
                        itemName: item.name,
                        sourceAd,
                        conceptIndex,
                        imageUrl: concept.imageDataUrl,
                        generatedImageUrl: concept.imageDataUrl,
                        originalGeneratedImageUrl: imageResponse?.originalImageUrl,
                        localPath: imageResponse?.localPath,
                        isLocal: imageResponse?.isLocal,
                        concept,
                        generation: {
                            model: imageResponse?.request?.model,
                            request: imageResponse?.request,
                            response: imageResponse?.response,
                            providerImage: imageResponse?.providerImage,
                            error: imageResponse?.error
                        }
                    });
                });
            } catch (error: any) {
                errors.push({
                    sourceAdId: ad.id,
                    message: error.message
                });
            }
        }

        const generatedCount = newRecords.filter((record) => record.status === 'done').length;
        const run: GeneratedImageRun = {
            id: runId,
            createdAt,
            completedAt: new Date().toISOString(),
            status: generatedCount === 0 ? 'failed' : errors.length > 0 || generatedCount < requestedCount ? 'completed_with_errors' : 'completed',
            requestedCount,
            generatedCount,
            conceptsPerSource,
            integrationId,
            selectionStrategy: 'Top active image ads by ROAS, then spend',
            sourceAds,
            errors
        };

        const manifest = await readGeneratedImageManifest(DATA_DIR);
        const nextManifest = {
            ...manifest,
            images: [...newRecords, ...manifest.images],
            runs: [run, ...manifest.runs]
        };
        await writeGeneratedImageManifest(DATA_DIR, nextManifest);

        res.json({
            run,
            images: newRecords.map(stripGeneratedImageRecordForClient),
            manifestPath: path.relative(process.cwd(), getGeneratedImageManifestPath(DATA_DIR))
        });
    } catch (error: any) {
        console.error('Error generating image ad variations:', error);
        const manifest = await readGeneratedImageManifest(DATA_DIR).catch(() => null);
        const run: GeneratedImageRun = {
            id: runId,
            createdAt,
            completedAt: new Date().toISOString(),
            status: 'failed',
            requestedCount,
            generatedCount: 0,
            conceptsPerSource,
            integrationId,
            selectionStrategy: 'Top active image ads by ROAS, then spend',
            sourceAds: [],
            errors: [{ message: error.message }]
        };

        if (manifest) {
            await writeGeneratedImageManifest(DATA_DIR, {
                ...manifest,
                runs: [run, ...manifest.runs]
            }).catch(() => undefined);
        }

        res.status(500).json({ error: 'Failed to generate image ad variations', run });
    }
});

// --- Brand & Discovery Data Endpoints ---

// Get all brands
// Get own brands (user's brands)
app.get('/api/own-brands', async (req: Request, res: Response) => {
    try {
        const brands = await readJson('own-brands.json');
        res.json(brands);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load own brands' });
    }
});

// Get own analytics data (integrations and ads with metrics)
// Supports query params:
// - integration: filter by integration id (default: all integrations)
// - groupBy: ad_name (default), creative_name, headline, ad_copy
// - display_format: filter by 'video' or 'image'
// - status: filter by 'active' or 'inactive'
// - start_date_from: filter ads starting from this date (ISO string)
// - start_date_to: filter ads starting up to this date (ISO string)
app.get('/api/own-analytics', async (req: Request, res: Response) => {
    try {
        const analytics = await readJson('own-analytics.json');
        let ads = analytics.ads as any[];

        // Extract query params
        const integration = req.query.integration as string | undefined;
        const groupBy = (req.query.groupBy as string) || 'ad_name';
        const displayFormat = req.query.display_format as string | undefined;
        const status = req.query.status as string | undefined;
        const startDateFrom = req.query.start_date_from as string | undefined;
        const startDateTo = req.query.start_date_to as string | undefined;

        // Filter by integration
        if (integration) {
            ads = ads.filter((ad: any) => ad.integration_id === integration);
        }

        // Filter by display_format
        if (displayFormat && (displayFormat === 'video' || displayFormat === 'image')) {
            ads = ads.filter((ad: any) => ad.display_format === displayFormat);
        }

        // Filter by status
        if (status && (status === 'active' || status === 'inactive')) {
            ads = ads.filter((ad: any) => ad.status === status);
        }

        // Filter by start_date range
        if (startDateFrom) {
            const fromDate = new Date(startDateFrom);
            ads = ads.filter((ad: any) => new Date(ad.start_date) >= fromDate);
        }
        if (startDateTo) {
            const toDate = new Date(startDateTo);
            ads = ads.filter((ad: any) => new Date(ad.start_date) <= toDate);
        }

        // Group by the specified field
        const validGroupByFields = ['ad_name', 'creative_name', 'headline', 'ad_copy'];
        const groupByField = validGroupByFields.includes(groupBy) ? groupBy : 'ad_name';

        // If groupBy is ad_name, no aggregation needed - each ad is unique
        if (groupByField === 'ad_name') {
            // Return ads with ad_count = 1
            const result = ads.map((ad: any) => ({
                ...ad,
                ad_count: 1
            }));
            const integrations = analytics.integrations;
            res.json({ integrations, ads: result, groupBy: groupByField });
            return;
        }

        // Group and aggregate ads by the specified field
        const groupedMap = new Map<string, { ads: any[], groupValue: string }>();

        for (const ad of ads) {
            const groupValue = ad[groupByField] || 'Unknown';
            if (!groupedMap.has(groupValue)) {
                groupedMap.set(groupValue, { ads: [], groupValue });
            }
            groupedMap.get(groupValue)!.ads.push(ad);
        }

        // Aggregate metrics for each group
        const aggregatedAds = Array.from(groupedMap.values()).map(({ ads: groupAds, groupValue }) => {
            // Use the first ad as template for non-metric fields
            const firstAd = groupAds[0];
            const adCount = groupAds.length;

            // Sum up all metrics
            const aggregatedMetrics = {
                spend: 0,
                cost_per_lead: 0,
                roas: 0,
                cpa: 0,
                aov: 0,
                purchase_value: 0,
                ctr: 0,
                cpc: 0,
                impressions: 0,
                clicks: 0,
                click_to_atc: 0,
                atc_to_purchase: 0
            };

            for (const ad of groupAds) {
                const m = ad.metrics;
                aggregatedMetrics.spend += m.spend || 0;
                aggregatedMetrics.cost_per_lead += m.cost_per_lead || 0;
                aggregatedMetrics.roas += m.roas || 0;
                aggregatedMetrics.cpa += m.cpa || 0;
                aggregatedMetrics.aov += m.aov || 0;
                aggregatedMetrics.purchase_value += m.purchase_value || 0;
                aggregatedMetrics.ctr += m.ctr || 0;
                aggregatedMetrics.cpc += m.cpc || 0;
                aggregatedMetrics.impressions += m.impressions || 0;
                aggregatedMetrics.clicks += m.clicks || 0;
                aggregatedMetrics.click_to_atc += m.click_to_atc || 0;
                aggregatedMetrics.atc_to_purchase += m.atc_to_purchase || 0;
            }

            // For ratio/rate metrics, calculate weighted average based on impressions/clicks
            // For simplicity, we'll average them
            if (adCount > 1) {
                aggregatedMetrics.cost_per_lead /= adCount;
                aggregatedMetrics.roas /= adCount;
                aggregatedMetrics.cpa /= adCount;
                aggregatedMetrics.aov /= adCount;
                aggregatedMetrics.ctr /= adCount;
                aggregatedMetrics.cpc /= adCount;
                aggregatedMetrics.click_to_atc /= adCount;
                aggregatedMetrics.atc_to_purchase /= adCount;
            }

            // Create aggregated ad entry
            return {
                id: `grouped_${groupByField}_${groupValue.replace(/\s+/g, '_').toLowerCase()}`,
                integration_id: firstAd.integration_id,
                ad_name: groupByField === 'ad_name' ? groupValue : `${groupValue} (${adCount} ads)`,
                creative_name: groupByField === 'creative_name' ? groupValue : firstAd.creative_name,
                headline: groupByField === 'headline' ? groupValue : firstAd.headline,
                ad_copy: groupByField === 'ad_copy' ? groupValue : firstAd.ad_copy,
                image_url: firstAd.image_url,
                display_format: groupAds.some((a: any) => a.display_format === 'video') ? 'video' : 'image',
                video_length: firstAd.video_length,
                status: groupAds.every((a: any) => a.status === 'active') ? 'active' : 'mixed',
                start_date: groupAds.reduce((earliest: string, a: any) => 
                    a.start_date < earliest ? a.start_date : earliest, groupAds[0].start_date),
                end_date: null,
                metrics: aggregatedMetrics,
                ad_count: adCount,
                group_value: groupValue
            };
        });

        const integrations = analytics.integrations;
        res.json({ integrations, ads: aggregatedAds, groupBy: groupByField });
    } catch (error) {
        console.error('Error loading analytics:', error);
        res.status(500).json({ error: 'Failed to load analytics data' });
    }
});

// Get other brands (competitors)
app.get('/api/brands', async (req: Request, res: Response) => {
    try {
        const brands = await readJson('other-brands.json');
        res.json(brands);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load brands' });
    }
});

// Toggle Follow Brand
app.post('/api/brands/:id/follow', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const brands = await readJson('other-brands.json');
        const brand = brands.find((b: any) => b.id === id);
        if (brand) {
            brand.is_followed = !brand.is_followed;
            await writeJson('other-brands.json', brands);
            res.json(brand);
        } else {
            res.status(404).json({ error: 'Brand not found' });
        }
    } catch (error) {
        console.error('Error updating brand:', error);
        res.status(500).json({ error: 'Failed to update brand' });
    }
});

// Get Discovery Ads - Join with brand info from other-brands.json
// Supports query params:
// - brand: filter by brand name
// - display_format: filter by 'video' or 'image'
// - status: filter by 'active' or 'inactive'
// - platform: filter by platform name (instagram, facebook, tiktok, youtube)
// - sort: 'latest' (default) or 'longest_running'
// - limit: number of results to return (default: all)
app.get('/api/inspirations/discovery', async (req: Request, res: Response) => {
    try {
        const [ads, brands] = await Promise.all([
            readJson('discovery.json'),
            readJson('other-brands.json')
        ]);
        
        // Create a brand lookup map with proper typing
        const brandMap = new Map<string, { id: string; name: string; logo: string }>(
            brands.map((b: any) => [b.id, b])
        );
        
        // Join brand info into each ad
        let enrichedAds = ads.map((ad: any) => {
            const brand = brandMap.get(ad.brand_id);
            return {
                ...ad,
                brand_name: brand?.name || 'Unknown',
                brand_logo: brand?.logo || ''
            };
        });

        // Extract query params
        const brandFilter = req.query.brand as string | undefined;
        const displayFormat = req.query.display_format as string | undefined;
        const status = req.query.status as string | undefined;
        const platform = req.query.platform as string | undefined;
        const sort = (req.query.sort as string) || 'latest';
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

        // Apply filters
        if (brandFilter && brandFilter !== 'all') {
            enrichedAds = enrichedAds.filter((ad: any) => ad.brand_name === brandFilter);
        }
        if (displayFormat && displayFormat !== 'all') {
            enrichedAds = enrichedAds.filter((ad: any) => ad.display_format === displayFormat);
        }
        if (status && status !== 'all') {
            enrichedAds = enrichedAds.filter((ad: any) => ad.status === status);
        }
        if (platform && platform !== 'all') {
            enrichedAds = enrichedAds.filter((ad: any) => 
                ad.platforms && ad.platforms.includes(platform.toLowerCase())
            );
        }

        // Apply sorting
        if (sort === 'longest_running') {
            // Calculate running days: from start_date to end_date (or today if still active)
            const today = new Date();
            enrichedAds = enrichedAds.sort((a: any, b: any) => {
                const aStart = new Date(a.start_date);
                const aEnd = a.end_date ? new Date(a.end_date) : today;
                const aDays = Math.floor((aEnd.getTime() - aStart.getTime()) / (1000 * 60 * 60 * 24));
                
                const bStart = new Date(b.start_date);
                const bEnd = b.end_date ? new Date(b.end_date) : today;
                const bDays = Math.floor((bEnd.getTime() - bStart.getTime()) / (1000 * 60 * 60 * 24));
                
                return bDays - aDays; // Longest running first
            });
        } else {
            // 'latest' - most recent first
            enrichedAds = enrichedAds.sort((a: any, b: any) => 
                new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
            );
        }

        // Apply limit
        if (limit && limit > 0) {
            enrichedAds = enrichedAds.slice(0, limit);
        }
        
        res.json(enrichedAds);
    } catch (error) {
        console.error('Error loading ads:', error);
        res.status(500).json({ error: 'Failed to load discovery data' });
    }
});

// Toggle Bookmark Ad
app.post('/api/ads/:id/bookmark', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const ads = await readJson('discovery.json');
        const ad = ads.find((a: any) => a.id === id);
        if (ad) {
            ad.is_bookmarked = !ad.is_bookmarked;
            await writeJson('discovery.json', ads);
            res.json(ad);
        } else {
            res.status(404).json({ error: 'Ad not found' });
        }
    } catch (error) {
        console.error('Error updating ad:', error);
        res.status(500).json({ error: 'Failed to update ad' });
    }
});

const connectIntegration = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const analytics = await readJson('own-analytics.json');
        const integrations = analytics.integrations;
        const integration = integrations.find((c: any) => c.id === id);
        if (integration) {
            res.json({ ...integration, is_connected: true });
        } else {
            res.status(404).json({ error: 'Data source not found' });
        }
    } catch (error) {
        console.error('Error connecting integration:', error);
        res.status(500).json({ error: 'Failed to connect integration' });
    }
};

const disconnectIntegration = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const analytics = await readJson('own-analytics.json');
        const integrations = analytics.integrations;
        const integration = integrations.find((c: any) => c.id === id);
        if (integration) {
            res.json({ ...integration, is_connected: false });
        } else {
            res.status(404).json({ error: 'Data source not found' });
        }
    } catch (error) {
        console.error('Error disconnecting integration:', error);
        res.status(500).json({ error: 'Failed to disconnect integration' });
    }
};

// Connect a integration.
app.post('/api/integrations/:id/connect', connectIntegration);
app.post('/api/integrations/:id/disconnect', disconnectIntegration);

// Anything that doesn't match the above, send back index.html
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
