import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { Agent } from './agent';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Store agent instances per session for isolation
const agents = new Map<string, Agent>();

function getAgent(sessionId: string): Agent {
    if (!agents.has(sessionId)) {
        logger.session(sessionId, 'CREATE');
        agents.set(sessionId, new Agent());
    } else {
        logger.session(sessionId, 'ACCESS');
    }
    return agents.get(sessionId)!;
}

// Helper to read/write data
const DATA_DIR = path.join(process.cwd(), 'src', 'data');

const readJson = async (filename: string) => {
    const data = await fs.promises.readFile(path.join(DATA_DIR, filename), 'utf-8');
    return JSON.parse(data);
};

const writeJson = async (filename: string, data: any) => {
    await fs.promises.writeFile(path.join(DATA_DIR, filename), JSON.stringify(data, null, 4), 'utf-8');
};


app.get('/api/stream', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const message = req.query.message as string;
    const channelId = (req.query.channelId as string) || 'channel_1';
    const sessionId = (req.query.sessionId as string) || 'default';
    
    // Parse user-provided context (channels and brands)
    let userContext: { channels?: any[]; brands?: any[] } | undefined;
    if (req.query.context) {
        try {
            userContext = JSON.parse(req.query.context as string);
        } catch (e) {
            logger.log('WARN', { component: 'Server', action: 'PARSE_CONTEXT' }, 'Failed to parse context');
        }
    }

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
        await agent.handleRequest(message, channelId, userContext);
    } catch (error: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } finally {
        // Clean up listener to avoid leaks
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
    }
    res.json({ message: 'Session cleared' });
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

// Get own analytics data (channels and ads with metrics)
// Supports query params:
// - channel: filter by channel_id (default: all channels)
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
        const channel = req.query.channel as string | undefined;
        const groupBy = (req.query.groupBy as string) || 'ad_name';
        const displayFormat = req.query.display_format as string | undefined;
        const status = req.query.status as string | undefined;
        const startDateFrom = req.query.start_date_from as string | undefined;
        const startDateTo = req.query.start_date_to as string | undefined;

        // Filter by channel
        if (channel) {
            ads = ads.filter((ad: any) => ad.channel_id === channel);
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
            res.json({ channels: analytics.channels, ads: result, groupBy: groupByField });
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
                channel_id: firstAd.channel_id,
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

        res.json({ channels: analytics.channels, ads: aggregatedAds, groupBy: groupByField });
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

// Connect a channel
app.post('/api/channels/:id/connect', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const analytics = await readJson('own-analytics.json');
        const channel = analytics.channels.find((c: any) => c.id === id);
        if (channel) {
            channel.is_connected = true;
            await writeJson('own-analytics.json', analytics);
            res.json(channel);
        } else {
            res.status(404).json({ error: 'Channel not found' });
        }
    } catch (error) {
        console.error('Error connecting channel:', error);
        res.status(500).json({ error: 'Failed to connect channel' });
    }
});

// Anything that doesn't match the above, send back index.html
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
