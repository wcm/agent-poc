import React from "react";
import { FocusedItemCard } from "../../types";
import AdMetricCard from "./AdMetricCard";

interface FocusedItemsGridProps {
	title?: string;
	items: FocusedItemCard[];
}

const FocusedItemsGrid: React.FC<FocusedItemsGridProps> = ({ title, items }) => {
	if (!items || items.length === 0) {
		return null;
	}

	return (
		<div className="focused-items-grid">
			{items.map((item) => (
				<AdMetricCard key={item.id} item={item} />
			))}
		</div>
	);
};

export default FocusedItemsGrid;
