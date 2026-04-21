import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, Compass, Eye, Search, Sparkles, Wand2, X, LucideIcon } from "lucide-react";
import { getGroupedPromptLibrary, PromptLibraryIconKey, PromptLibraryItem, PROMPT_LIBRARY_ITEMS } from "./promptLibrary";

interface PromptLibraryModalProps {
	open: boolean;
	onClose: () => void;
	onPromptSelect: (item: PromptLibraryItem) => void;
	preferredCategoryId?: string | null;
}

const ICONS: Record<PromptLibraryIconKey, LucideIcon> = {
	wand2: Wand2,
	barChart3: BarChart3,
	sparkles: Sparkles,
	eye: Eye,
	compass: Compass,
};

const PromptLibraryModal: React.FC<PromptLibraryModalProps> = ({ open, onClose, onPromptSelect, preferredCategoryId }) => {
	const groupedPrompts = useMemo(() => getGroupedPromptLibrary(), []);
	const [keyword, setKeyword] = useState("");
	const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(groupedPrompts[0]?.id ?? null);

	const filteredPrompts = useMemo(() => {
		const normalized = keyword.trim().toLowerCase();
		if (!normalized) {
			return PROMPT_LIBRARY_ITEMS;
		}

		return PROMPT_LIBRARY_ITEMS.filter((item) =>
			[item.title, item.summary, item.prompt].some((field) => field.toLowerCase().includes(normalized))
		);
	}, [keyword]);

	const promptsByCategory = useMemo(
		() =>
			new Map(
				groupedPrompts.map((group) => [group.id, filteredPrompts.filter((item) => item.categoryId === group.id)])
			),
		[groupedPrompts, filteredPrompts]
	);

	const visibleCategoryIds = useMemo(
		() => groupedPrompts.map((group) => group.id).filter((categoryId) => (promptsByCategory.get(categoryId) ?? []).length > 0),
		[groupedPrompts, promptsByCategory]
	);

	useEffect(() => {
		if (!open) {
			setKeyword("");
			return;
		}

		if (preferredCategoryId && visibleCategoryIds.includes(preferredCategoryId)) {
			setSelectedCategoryId(preferredCategoryId);
			return;
		}

		setSelectedCategoryId(visibleCategoryIds[0] ?? groupedPrompts[0]?.id ?? null);
	}, [open, preferredCategoryId, visibleCategoryIds, groupedPrompts]);

	useEffect(() => {
		if (!open) {
			return;
		}

		if (!selectedCategoryId || !visibleCategoryIds.includes(selectedCategoryId)) {
			setSelectedCategoryId(visibleCategoryIds[0] ?? null);
		}
	}, [open, selectedCategoryId, visibleCategoryIds]);

	if (!open) {
		return null;
	}

	const selectedPrompts = selectedCategoryId ? promptsByCategory.get(selectedCategoryId) ?? [] : [];

	return (
		<div className="prompt-library-modal-backdrop" onClick={onClose}>
			<div className="prompt-library-modal" onClick={(event) => event.stopPropagation()}>
				<div className="prompt-library-modal-header">
					<div>
						<h3>Prompt Library</h3>
						<p>Browse saved starting points and drop one straight into the composer.</p>
					</div>
					<button type="button" className="prompt-library-close-btn" onClick={onClose} aria-label="Close prompt library">
						<X size={18} />
					</button>
				</div>

				<label className="prompt-library-search" aria-label="Search prompt library">
					<Search size={16} />
					<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search prompts" />
				</label>

				<div className="prompt-library-modal-body">
					<div className="prompt-library-category-list">
						{groupedPrompts.map((group) => {
							const Icon = ICONS[group.icon];
							const hasResults = (promptsByCategory.get(group.id) ?? []).length > 0;
							return (
								<button
									key={group.id}
									type="button"
									className={`prompt-library-category-item ${selectedCategoryId === group.id ? "is-selected" : ""}`}
									disabled={!hasResults}
									onClick={() => setSelectedCategoryId(group.id)}
								>
									<Icon size={16} />
									<span>{group.label}</span>
								</button>
							);
						})}
					</div>

					<div className="prompt-library-results">
						{selectedPrompts.length === 0 ? (
							<div className="prompt-library-empty-state">No prompts match your search.</div>
						) : (
							selectedPrompts.map((item) => (
								<button
									key={item.id}
									type="button"
									className="prompt-library-result-item"
									onClick={() => {
										onPromptSelect(item);
										onClose();
									}}
								>
									<div className="prompt-library-result-copy">
										<span className="prompt-library-result-title">{item.title}</span>
										<span className="prompt-library-result-summary">{item.summary}</span>
									</div>
									<ArrowUpRight size={16} />
								</button>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default PromptLibraryModal;
