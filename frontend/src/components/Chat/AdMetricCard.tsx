import React from 'react';
import { FocusedItemCard } from '../../types';
import { ImageIcon } from 'lucide-react';

interface AdMetricCardProps {
    item: FocusedItemCard;
}

const formatNumber = (value: number | undefined): string => {
    if (value === undefined || value === null) return 'N/A';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(2);
};

const formatCurrency = (value: number | undefined): string => {
    if (value === undefined || value === null) return 'N/A';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
};

const formatPercentage = (value: number | undefined): string => {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(2)}%`;
};

const AdMetricCard: React.FC<AdMetricCardProps> = ({ item }) => {
    return (
        <div className="ad-metric-card">
            <div className="ad-metric-card-thumbnail">
                {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.name} />
                ) : (
                    <div className="ad-metric-card-placeholder">
                        <ImageIcon size={24} />
                    </div>
                )}
            </div>
            <div className="ad-metric-card-name" title={item.name}>
                {item.name}
            </div>
            <div className="ad-metric-card-metrics">
                {item.metrics.roas !== undefined && (
                    <div className="ad-metric-pill roas">
                        <span className="metric-label">ROAS</span>
                        <span className="metric-value">{formatNumber(item.metrics.roas)}</span>
                    </div>
                )}
                {item.metrics.spend !== undefined && (
                    <div className="ad-metric-pill spend">
                        <span className="metric-label">Spend</span>
                        <span className="metric-value">{formatCurrency(item.metrics.spend)}</span>
                    </div>
                )}
                {item.metrics.ctr !== undefined && (
                    <div className="ad-metric-pill ctr">
                        <span className="metric-label">CTR</span>
                        <span className="metric-value">{formatPercentage(item.metrics.ctr)}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdMetricCard;

