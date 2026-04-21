import React, { useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, Compass, Eye, Search, Sparkles, Wand2, X, LucideIcon } from "lucide-react";
import PromptLibraryModal from "./PromptLibraryModal";
import { getGroupedPromptLibrary, PromptLibraryIconKey, PromptLibraryItem } from "./promptLibrary";

interface PromptSuggestionsProps {
	onPromptSelect: (item: PromptLibraryItem) => void;
}

const ICONS: Record<PromptLibraryIconKey, LucideIcon> = {
	wand2: Wand2,
	barChart3: BarChart3,
	sparkles: Sparkles,
	eye: Eye,
	compass: Compass,
};

const PromptSuggestions: React.FC<PromptSuggestionsProps> = ({ onPromptSelect }) => {
	const groupedPrompts = useMemo(() => getGroupedPromptLibrary(), []);
	const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
	const [isLibraryOpen, setIsLibraryOpen] = useState(false);

	const activeCategory = groupedPrompts.find((group) => group.id === selectedCategoryId) || null;

	return (
		<>
			<div className="prompt-suggestions">
				<div className="prompt-suggestions-header">
					<div className="prompt-category-buttons">
						{groupedPrompts.map((group) => {
							const Icon = ICONS[group.icon];
							const isSelected = selectedCategoryId === group.id;
							return (
								<button
									key={group.id}
									type="button"
									className={`prompt-category-button ${isSelected ? "is-selected" : ""}`}
									onClick={() => setSelectedCategoryId((current) => (current === group.id ? null : group.id))}
								>
									{isSelected ? <X size={15} /> : <Icon size={15} />}
									<span>{group.label}</span>
								</button>
							);
						})}
					</div>

					<button type="button" className="prompt-library-open-btn" aria-label="Open prompt library" onClick={() => setIsLibraryOpen(true)}>
						<Search size={17} />
					</button>
				</div>

				{activeCategory && (
					<div className="prompt-category-panel">
						<div className="prompt-category-panel-inner">
							{activeCategory.prompts.map((item) => (
								<button key={item.id} type="button" className="prompt-category-item" onClick={() => onPromptSelect(item)}>
									<div className="prompt-category-item-copy">
										<span className="prompt-category-item-title">{item.title}</span>
										<span className="prompt-category-item-summary">{item.summary}</span>
									</div>
									<ArrowUpRight size={16} />
								</button>
							))}
						</div>
					</div>
				)}
			</div>

			<PromptLibraryModal
				open={isLibraryOpen}
				onClose={() => setIsLibraryOpen(false)}
				onPromptSelect={onPromptSelect}
				preferredCategoryId={selectedCategoryId}
			/>
		</>
	);
};

export default PromptSuggestions;
