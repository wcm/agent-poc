import React, { useEffect, useState, useMemo } from "react";
import { Filter, ArrowUpDown } from "lucide-react";
import { Ad } from "../../types";
import AdCard from "./AdCard";

interface DiscoveryFeedProps {
	savedOnly?: boolean;
	onNavigateToBrand?: (brandId: string) => void;
}

const DiscoveryFeed: React.FC<DiscoveryFeedProps> = ({ savedOnly = false, onNavigateToBrand }) => {
	const [ads, setAds] = useState<Ad[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Filter & Sort State
	const [sortBy, setSortBy] = useState<"longest_running" | "latest">("latest");
	const [filterBrand, setFilterBrand] = useState<string>("all");
	const [filterFormat, setFilterFormat] = useState<string>("all");
	const [filterPlatform, setFilterPlatform] = useState<string>("all");
	const [filterStatus, setFilterStatus] = useState<string>("active");

	const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3002" : "";

	useEffect(() => {
		const fetchAds = async () => {
			try {
				const apiUrl = `${baseUrl}/api/inspirations/discovery`;

				const response = await fetch(apiUrl);
				if (response.ok) {
					const data = await response.json();
					setAds(data);
				} else {
					setError(`Failed to load ads: ${response.status} ${response.statusText}`);
				}
			} catch (error: any) {
				setError(`Network error: ${error.message}`);
			} finally {
				setLoading(false);
			}
		};

		fetchAds();
	}, [baseUrl]);

	const toggleBookmark = async (ad: Ad) => {
		try {
			// Optimistic update
			setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, is_bookmarked: !a.is_bookmarked } : a)));

			const res = await fetch(`${baseUrl}/api/ads/${ad.id}/bookmark`, { method: "POST" });
			if (!res.ok) {
				// Revert if failed
				setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, is_bookmarked: ad.is_bookmarked } : a)));
			}
		} catch (err) {
			console.error(err);
		}
	};

	// Derived State: Filtered & Sorted Ads
	const processedAds = useMemo(() => {
		let result = ads.filter((ad) => ad.brand_name !== "Nike"); // EXCLUDE OWN BRAND

		if (savedOnly) {
			result = result.filter((ad) => ad.is_bookmarked);
		}

		// 1. Filter
		if (filterBrand !== "all") {
			result = result.filter((ad) => ad.brand_name === filterBrand);
		}
		if (filterFormat !== "all") {
			result = result.filter((ad) => ad.display_format === filterFormat);
		}
		if (filterPlatform !== "all") {
			result = result.filter((ad) => ad.platforms.includes(filterPlatform));
		}
		if (filterStatus !== "all") {
			result = result.filter((ad) => ad.status === filterStatus);
		}

		// 2. Sort
		result.sort((a, b) => {
			if (sortBy === "latest") {
				return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
			} else if (sortBy === "longest_running") {
				return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
			}
			return 0;
		});

		return result;
	}, [ads, savedOnly, filterBrand, filterFormat, filterPlatform, filterStatus, sortBy]);

	// Unique options for dropdowns
	const brands = Array.from(new Set(ads.filter((a) => a.brand_name !== "Nike").map((a) => a.brand_name)));
	const platforms = Array.from(new Set(ads.flatMap((a) => a.platforms)));

	if (loading) return <div className="discovery-loading">Loading...</div>;
	if (error)
		return (
			<div className="discovery-loading" style={{ color: "red" }}>
				Error: {error}
			</div>
		);

	return (
		<div className="discovery-feed-container">
			<h2 className="section-title">{savedOnly ? "Saved Ads" : "Discover Trending Ads"}</h2>

			{/* Toolbar */}
			<div className="discovery-toolbar">
				<div className="toolbar-group">
					<div className="filter-item">
						<Filter size={14} />
						<select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}>
							<option value="all">All Brands</option>
							{brands.map((b) => (
								<option key={b} value={b}>
									{b}
								</option>
							))}
						</select>
					</div>
					<div className="filter-item">
						<select value={filterFormat} onChange={(e) => setFilterFormat(e.target.value)}>
							<option value="all">All Formats</option>
							<option value="image">Image</option>
							<option value="video">Video</option>
						</select>
					</div>
					<div className="filter-item">
						<select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
							<option value="all">All Status</option>
							<option value="active">Active</option>
							<option value="inactive">Inactive</option>
						</select>
					</div>
					<div className="filter-item">
						<select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}>
							<option value="all">All Platforms</option>
							{platforms.map((p) => (
								<option key={p} value={p}>
									{p.charAt(0).toUpperCase() + p.slice(1)}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="toolbar-group">
					<div className="sort-item">
						<ArrowUpDown size={14} />
						<select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
							<option value="latest">Latest</option>
							<option value="longest_running">Longest Running</option>
						</select>
					</div>
				</div>
			</div>

			<div className="discovery-grid">
				{processedAds.length === 0 ? (
					<div className="no-results">No ads match your filters.</div>
				) : (
					processedAds.map((ad) => <AdCard key={ad.id} ad={ad} onBookmarkToggle={toggleBookmark} onBrandClick={onNavigateToBrand} />)
				)}
			</div>
		</div>
	);
};

export default DiscoveryFeed;
