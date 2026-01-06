import React, { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { Channel, Brand } from "../../types";

interface ContextSelectorProps {
	type: "channel" | "brand";
	selectedIds: string[];
	onSelect: (ids: string[]) => void;
	onClose: () => void;
}

const ContextSelector: React.FC<ContextSelectorProps> = ({ type, selectedIds, onSelect, onClose }) => {
	const [items, setItems] = useState<(Channel | Brand)[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
	const [loading, setLoading] = useState(true);

	const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3002" : "";

	useEffect(() => {
		const fetchItems = async () => {
			try {
				if (type === "channel") {
					const res = await fetch(`${baseUrl}/api/own-analytics`);
					const data = await res.json();
					setItems(data.channels || []);
				} else {
					const res = await fetch(`${baseUrl}/api/brands`);
					const data: Brand[] = await res.json();
					// Only show followed brands
					setItems(data.filter((b) => b.is_followed));
				}
			} catch (err) {
				console.error("Error fetching items:", err);
			} finally {
				setLoading(false);
			}
		};
		fetchItems();
	}, [type, baseUrl]);

	const toggleItem = (id: string) => {
		if (type === "channel") {
			// Single select for channels - select and close immediately
			onSelect([id]);
			onClose();
		} else {
			// Multi-select for brands
			const newSelected = new Set(selected);
			if (newSelected.has(id)) {
				newSelected.delete(id);
			} else {
				newSelected.add(id);
			}
			setSelected(newSelected);
		}
	};

	const handleDone = () => {
		onSelect(Array.from(selected));
		onClose();
	};

	const isChannel = (item: Channel | Brand): item is Channel => {
		return "platform" in item;
	};

	return (
		<div className="context-selector-overlay" onClick={onClose}>
			<div className="context-selector-popup" onClick={(e) => e.stopPropagation()}>
				<div className="context-selector-header">
					<h3>{type === "channel" ? "Select Ad Account" : "Select Brands"}</h3>
					<button className="close-btn" onClick={onClose}>
						<X size={18} />
					</button>
				</div>

				<div className="context-selector-list">
					{loading ? (
						<div className="context-selector-loading">Loading...</div>
					) : items.length === 0 ? (
						<div className="context-selector-empty">{type === "channel" ? "No ad accounts found" : "No followed brands"}</div>
					) : (
						items.map((item) => (
							<div key={item.id} className={`context-selector-item ${selected.has(item.id) ? "selected" : ""}`} onClick={() => toggleItem(item.id)}>
								<div className="item-checkbox">{selected.has(item.id) && <Check size={14} />}</div>
								{isChannel(item) ? (
									<div className="context-item-info">
										<span className="context-item-name">{item.name}</span>
										<span className="context-item-meta">{item.platform}</span>
									</div>
								) : (
									<div className="context-item-info">
										<img src={item.logo} alt={item.name} className="context-item-logo" />
										<span className="context-item-name">{item.name}</span>
									</div>
								)}
							</div>
						))
					)}
				</div>

				{type === "brand" && (
					<div className="context-selector-footer">
						<button className="cancel-btn" onClick={onClose}>
							Cancel
						</button>
						<button className="done-btn" onClick={handleDone}>
							Done ({selected.size})
						</button>
					</div>
				)}
			</div>
		</div>
	);
};

export default ContextSelector;
