import React from 'react';
import { FocusedItemCard } from '../../types';
import AdMetricCard from './AdMetricCard';

interface FocusedItemsGridProps {
    title?: string;
    items: FocusedItemCard[];
}

const FocusedItemsGrid: React.FC<FocusedItemsGridProps> = ({ title, items }) => {
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <div className="focused-items-grid-container">
            {title && <h3 className="focused-items-grid-title">{title}</h3>}
            <div className="focused-items-grid">
                {items.map((item) => (
                    <AdMetricCard key={item.id} item={item} />
                ))}
            </div>
        </div>
    );
};

export default FocusedItemsGrid;
