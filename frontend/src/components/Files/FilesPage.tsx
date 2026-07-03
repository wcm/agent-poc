import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, ExternalLink, Image as ImageIcon, RefreshCw, Search, SlidersHorizontal, Sparkles, Tag, Users, X } from "lucide-react";
import { GeneratedImageAdFile, GeneratedImageAdsManifest } from "../../types";

interface FilesPageProps {
	baseUrl: string;
}

type StatusFilter = "all" | "done" | "failed";
type SortOption = "newest" | "source" | "roas";

const emptyManifest: GeneratedImageAdsManifest = {
	version: 1,
	updatedAt: null,
	images: [],
	runs: [],
};

const formatDateTime = (value?: string | null) => {
	if (!value) return "Not generated yet";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
};

const formatMetric = (label: string, value?: number) => {
	if (value === undefined || Number.isNaN(value)) return null;
	if (label === "spend") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
	if (label === "ctr") return `${value.toFixed(2)}%`;
	if (label === "roas") return `${value.toFixed(2)}x`;
	return value.toLocaleString();
};

const getAllTags = (file: GeneratedImageAdFile) => [
	...(file.concept.creative_tags.ad_angles || []),
	...(file.concept.creative_tags.emotion || []),
	...(file.concept.creative_tags.themes || []),
	...(file.concept.personas || []),
];

const getDisplayImageUrl = (baseUrl: string, imageUrl?: string) => {
	if (!imageUrl) return "";
	if (imageUrl.startsWith("/")) return `${baseUrl}${imageUrl}`;
	return imageUrl;
};

const getRawResponsePreview = (file: GeneratedImageAdFile) => {
	const raw = file.generation?.response;
	if (!raw) return "";

	const serialized = JSON.stringify(raw, null, 2);
	if (serialized.length <= 18000) return serialized;
	return `${serialized.slice(0, 18000)}\n\n... truncated for display. Full response is saved in the local manifest file.`;
};

const FilesPage: React.FC<FilesPageProps> = ({ baseUrl }) => {
	const [manifest, setManifest] = useState<GeneratedImageAdsManifest>(emptyManifest);
	const [isLoading, setIsLoading] = useState(true);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [sourceFilter, setSourceFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [tagFilter, setTagFilter] = useState("all");
	const [sortOption, setSortOption] = useState<SortOption>("newest");
	const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

	const fetchManifest = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const response = await fetch(`${baseUrl}/api/files/generated-image-ads`);
			if (!response.ok) {
				throw new Error(`Request failed with ${response.status}`);
			}
			const data = (await response.json()) as GeneratedImageAdsManifest;
			setManifest({ ...emptyManifest, ...data, images: data.images || [], runs: data.runs || [] });
		} catch (fetchError: any) {
			setError(fetchError.message || "Failed to load generated image files");
		} finally {
			setIsLoading(false);
		}
	}, [baseUrl]);

	useEffect(() => {
		fetchManifest();
	}, [fetchManifest]);

	const images = useMemo(() => manifest.images || [], [manifest.images]);
	const completedImages = images.filter((image) => image.status === "done");
	const latestRun = manifest.runs?.[0] || null;
	const selectedFile = selectedFileId ? images.find((image) => image.id === selectedFileId) || null : null;

	const sourceOptions = useMemo(
		() =>
			Array.from(new Set(images.map((image) => image.sourceAd.name).filter(Boolean))).sort((a, b) =>
				a.localeCompare(b)
			),
		[images]
	);

	const tagOptions = useMemo(
		() =>
			Array.from(new Set(images.flatMap(getAllTags).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
		[images]
	);

	const filteredImages = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		const normalizedTag = tagFilter.toLowerCase();

		return images
			.filter((image) => {
				if (statusFilter !== "all" && image.status !== statusFilter) return false;
				if (sourceFilter !== "all" && image.sourceAd.name !== sourceFilter) return false;
				if (tagFilter !== "all" && !getAllTags(image).some((tag) => tag.toLowerCase() === normalizedTag)) return false;
				if (!normalizedQuery) return true;

				const haystack = [
					image.concept.concept_name,
					image.concept.concept_description,
					image.concept.concept_summary,
					image.sourceAd.name,
					image.sourceAd.headline,
					image.sourceAd.adCopy,
					...getAllTags(image),
				]
					.filter(Boolean)
					.join(" ")
					.toLowerCase();

				return haystack.includes(normalizedQuery);
			})
			.sort((a, b) => {
				if (sortOption === "source") return a.sourceAd.name.localeCompare(b.sourceAd.name);
				if (sortOption === "roas") return (b.sourceAd.metrics?.roas || 0) - (a.sourceAd.metrics?.roas || 0);
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			});
	}, [images, query, sourceFilter, statusFilter, tagFilter, sortOption]);

	const handleGenerate = async () => {
		setIsGenerating(true);
		setError(null);
		try {
			const response = await fetch(`${baseUrl}/api/files/generated-image-ads/generate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ count: 12, conceptsPerSource: 4, integrationId: "meta_ads" }),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.error || `Generation failed with ${response.status}`);
			}

			await fetchManifest();
			const firstGeneratedId = data?.images?.[0]?.id;
			if (firstGeneratedId) {
				setSelectedFileId(firstGeneratedId);
			}
		} catch (generateError: any) {
			setError(generateError.message || "Failed to generate image variations");
		} finally {
			setIsGenerating(false);
		}
	};

	const rawResponsePreview = selectedFile ? getRawResponsePreview(selectedFile) : "";

	return (
		<div className={`files-page ${selectedFile ? "has-detail" : ""}`}>
			<section className="files-main">
				<div className="files-hero">
					<div>
						<span className="files-eyebrow">
							<ImageIcon size={14} />
							Files
						</span>
						<h1>Generated Image Ads</h1>
						<p>Saved image ad variations generated from current Meta image ads, with direct URLs and raw backend responses preserved locally.</p>
					</div>
					<div className="files-actions">
						<button type="button" className="files-secondary-btn" onClick={fetchManifest} disabled={isLoading || isGenerating}>
							<RefreshCw size={16} />
							Refresh
						</button>
						<button type="button" className="files-primary-btn" onClick={handleGenerate} disabled={isGenerating}>
							<Sparkles size={16} />
							{isGenerating ? "Generating..." : "Generate 12"}
						</button>
					</div>
				</div>

				<div className="files-stats-row">
					<div className="files-stat-card">
						<strong>{completedImages.length}</strong>
						<span>Generated images</span>
					</div>
					<div className="files-stat-card">
						<strong>{manifest.runs?.length || 0}</strong>
						<span>Generation runs</span>
					</div>
					<div className="files-stat-card wide">
						<strong>{latestRun ? formatDateTime(latestRun.completedAt || latestRun.createdAt) : "No runs yet"}</strong>
						<span>Latest run</span>
					</div>
				</div>

				<div className="files-filter-bar">
					<div className="files-search">
						<Search size={16} />
						<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search concepts, source ads, tags..." />
					</div>
					<label className="files-filter-control">
						<span>Source</span>
						<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
							<option value="all">All source ads</option>
							{sourceOptions.map((source) => (
								<option key={source} value={source}>
									{source}
								</option>
							))}
						</select>
					</label>
					<label className="files-filter-control">
						<span>Status</span>
						<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
							<option value="all">All</option>
							<option value="done">Done</option>
							<option value="failed">Failed</option>
						</select>
					</label>
					<label className="files-filter-control">
						<span>Tag</span>
						<select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
							<option value="all">All tags</option>
							{tagOptions.map((tag) => (
								<option key={tag} value={tag}>
									{tag}
								</option>
							))}
						</select>
					</label>
					<label className="files-filter-control compact">
						<span>Sort</span>
						<select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)}>
							<option value="newest">Newest</option>
							<option value="source">Source</option>
							<option value="roas">ROAS</option>
						</select>
					</label>
				</div>

				{error && (
					<div className="files-alert">
						<AlertCircle size={16} />
						<span>{error}</span>
					</div>
				)}

				{isLoading ? (
					<div className="files-loading">Loading generated image files...</div>
				) : filteredImages.length === 0 ? (
					<div className="files-empty-state">
						<SlidersHorizontal size={22} />
						<h3>{images.length === 0 ? "No generated images yet" : "No images match these filters"}</h3>
						<p>{images.length === 0 ? "Generate a first batch from active image ads to populate Files." : "Try clearing search, source, status, or tag filters."}</p>
						{images.length === 0 && (
							<button type="button" className="files-primary-btn" onClick={handleGenerate} disabled={isGenerating}>
								<Sparkles size={16} />
								Generate 12 images
							</button>
						)}
					</div>
				) : (
					<div className="files-grid">
						{filteredImages.map((file) => {
							const imageUrl = getDisplayImageUrl(baseUrl, file.imageUrl);
							const tags = getAllTags(file).slice(0, 3);
							return (
								<button
									type="button"
									key={file.id}
									className={`files-card ${selectedFileId === file.id ? "is-selected" : ""}`}
									onClick={() => setSelectedFileId(file.id)}
								>
									<div className="files-card-image-wrap">
										{file.status === "done" && imageUrl ? (
											<img src={imageUrl} alt={file.concept.concept_name || file.itemName} />
										) : (
											<div className="files-card-image-failed">No image</div>
										)}
										<span className={`files-card-status ${file.status}`}>{file.status}</span>
									</div>
									<div className="files-card-body">
										<h3>{file.concept.concept_name || `Variation ${file.conceptIndex + 1}`}</h3>
										<p>{file.concept.concept_summary || file.concept.concept_description}</p>
										<span className="files-card-source">{file.sourceAd.name}</span>
										<div className="files-card-tags">
											{tags.map((tag) => (
												<span key={tag}>{tag}</span>
											))}
										</div>
									</div>
								</button>
							);
						})}
					</div>
				)}
			</section>

			{selectedFile && (
				<aside className="files-detail-panel">
					<div className="files-detail-surface">
						<div className="files-detail-header">
							<div>
								<span className="files-eyebrow">
									<ImageIcon size={14} />
									Image Variation
								</span>
								<h2>{selectedFile.concept.concept_name || "Untitled variation"}</h2>
								<span>{selectedFile.sourceAd.name}</span>
							</div>
							<button type="button" onClick={() => setSelectedFileId(null)} aria-label="Close details">
								<X size={18} />
							</button>
						</div>
						<div className="files-detail-body">
							<div className="files-detail-preview">
								{selectedFile.imageUrl ? <img src={getDisplayImageUrl(baseUrl, selectedFile.imageUrl)} alt={selectedFile.concept.concept_name} /> : <div>No generated preview</div>}
							</div>

							<div className="files-detail-section">
								<h4>
									<ExternalLink size={14} />
									Generated Image URL
								</h4>
								<a href={getDisplayImageUrl(baseUrl, selectedFile.imageUrl)} target="_blank" rel="noreferrer" className="files-url-pill">
									{getDisplayImageUrl(baseUrl, selectedFile.imageUrl)}
								</a>
								{selectedFile.localPath && <span className="files-local-path">Saved locally at {selectedFile.localPath}</span>}
							</div>

							<div className="files-detail-section">
								<h4>Concept Detail</h4>
								<p className="files-detail-summary">{selectedFile.concept.concept_summary}</p>
								<pre>{selectedFile.concept.concept_detail}</pre>
							</div>

							<div className="files-detail-section">
								<h4>
									<Users size={14} />
									Personas
								</h4>
								<div className="files-detail-tags">
									{selectedFile.concept.personas.map((persona) => (
										<span key={persona}>{persona}</span>
									))}
								</div>
							</div>

							<div className="files-detail-section">
								<h4>
									<Tag size={14} />
									Creative Tags
								</h4>
								<div className="files-detail-tags">
									{getAllTags(selectedFile).map((tag) => (
										<span key={tag}>{tag}</span>
									))}
								</div>
							</div>

							<div className="files-source-card">
								{selectedFile.sourceAd.imageUrl && <img src={selectedFile.sourceAd.imageUrl} alt={selectedFile.sourceAd.name} />}
								<div>
									<span>Source ad</span>
									<strong>{selectedFile.sourceAd.name}</strong>
									<p>{selectedFile.sourceAd.headline}</p>
									<div className="files-source-metrics">
										{(["roas", "spend", "ctr"] as const).map((metric) => {
											const formatted = formatMetric(metric, selectedFile.sourceAd.metrics?.[metric]);
											return formatted ? <span key={metric}>{metric.toUpperCase()}: {formatted}</span> : null;
										})}
									</div>
								</div>
							</div>

							<div className="files-detail-section">
								<h4>
									<Clock3 size={14} />
									Response Metadata
								</h4>
								<div className="files-metadata-list">
									<span>Created {formatDateTime(selectedFile.createdAt)}</span>
									<span>Run {selectedFile.runId}</span>
									<span>Model {selectedFile.generation?.model || selectedFile.generation?.request?.model || "Unknown"}</span>
								</div>
								{rawResponsePreview && (
									<details className="files-raw-response">
										<summary>Raw backend response preview</summary>
										<pre>{rawResponsePreview}</pre>
									</details>
								)}
								{!rawResponsePreview && manifest.manifestPath && (
									<span className="files-local-path">Full raw provider responses are saved in {manifest.manifestPath}</span>
								)}
							</div>
						</div>
					</div>
				</aside>
			)}
		</div>
	);
};

export default FilesPage;
