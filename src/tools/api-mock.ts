// Mock Data Generator
interface QueryObject {
    groupBy?: string;
    filters?: Array<{ field: string; operator: string; value: string }>;
    metrics?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export async function callAPI(query: QueryObject): Promise<any[]> {
    console.log("[CallAPI] Generating mock data for query:", JSON.stringify(query));
    
    const mockData = [];
    const count = 10;
    
    // Helper to generate random value based on metric name
    const generateValue = (metric: string): number | string => {
        if (metric.includes('spend')) return parseFloat((Math.random() * 5000).toFixed(2));
        if (metric.includes('roas')) return parseFloat((Math.random() * 5 + 1).toFixed(2));
        if (metric.includes('cpm')) return parseFloat((Math.random() * 20 + 5).toFixed(2));
        if (metric.includes('ctr')) return parseFloat((Math.random() * 0.05).toFixed(4));
        if (metric.includes('clicks')) return Math.floor(Math.random() * 1000);
        if (metric.includes('impressions')) return Math.floor(Math.random() * 50000);
        if (metric === 'ad_id') return `ad_${Math.floor(Math.random() * 10000)}`;
        if (metric === 'ad_name') return `Ad_Creative_${Math.floor(Math.random() * 100)}`;
        return 0;
    };

    for (let i = 0; i < count; i++) {
        const row: any = {};
        
        // Handle GroupBy
        if (query.groupBy) {
             if (query.groupBy === 'ad_format') {
                 const formats = ['VIDEO', 'IMAGE', 'CAROUSEL'];
                 row[query.groupBy] = formats[Math.floor(Math.random() * formats.length)];
             } else if (query.groupBy === 'campaign_objective') {
                 const objs = ['SALES', 'LEADS', 'TRAFFIC'];
                 row[query.groupBy] = objs[Math.floor(Math.random() * objs.length)];
             } else {
                 row[query.groupBy] = `${query.groupBy}_${i + 1}`;
             }
        }

        // Handle Metrics
        if (query.metrics) {
            query.metrics.forEach(metric => {
                row[metric] = generateValue(metric);
            });
        }
        
        // Ensure ad_id is present if requested (it usually is forced)
        if (!row.ad_id && query.metrics?.includes('ad_id')) {
            row.ad_id = `ad_${Math.floor(Math.random() * 90000) + 10000}`;
        }

        mockData.push(row);
    }

    // Apply Sorting (Simple)
    if (query.sortBy) {
        mockData.sort((a, b) => {
            const sortBy = query.sortBy as string;
            const valA = a[sortBy] || 0;
            const valB = b[sortBy] || 0;
            return query.sortOrder === 'desc' ? valB - valA : valA - valB;
        });
    }

    return mockData;
}

