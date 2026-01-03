import React, { useEffect, useState } from "react";
import { Brand, Ad } from "../../types";
import { ArrowLeft, UserPlus, UserCheck, ExternalLink } from "lucide-react";
import AdCard from "./AdCard";

interface BrandDetailsProps {
	brandId: string;
	onBack: () => void;
}

const BrandDetails: React.FC<BrandDetailsProps> = ({ brandId, onBack }) => {
	const [brand, setBrand] = useState<Brand | null>(null);
	const [ads, setAds] = useState<Ad[]>([]);
	const [loading, setLoading] = useState(true);

	const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3001" : "";

	useEffect(() => {
		const loadData = async () => {
			try {
				const brandsRes = await fetch(`${baseUrl}/api/brands`);
				const brandsData: Brand[] = await brandsRes.json();
				const foundBrand = brandsData.find((b) => b.id === brandId);
				setBrand(foundBrand || null);

				const adsRes = await fetch(`${baseUrl}/api/inspirations/discovery`);
				const adsData: Ad[] = await adsRes.json();
				setAds(adsData.filter((a) => a.brand_id === brandId || (foundBrand && a.brand_name === foundBrand.name)));
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, [brandId, baseUrl]);

	const toggleFollow = async () => {
		if (!brand) return;
		try {
			const res = await fetch(`${baseUrl}/api/brands/${brand.id}/follow`, { method: "POST" });
			if (res.ok) {
				const updated = await res.json();
				setBrand(updated);
			}
		} catch (err) {
			console.error(err);
		}
	};

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

	// Calculate metrics
	const liveAdsCount = ads.filter((a) => a.status === "active").length;
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const newAdsCount = ads.filter((a) => new Date(a.start_date) >= thirtyDaysAgo).length;

	if (loading) return <div>Loading...</div>;
	if (!brand) return <div>Brand not found</div>;

	return (
		<div className="brand-details-container">
			<button className="back-btn" onClick={onBack}>
				<ArrowLeft size={20} /> Back to Inspirations
			</button>

			<div className="brand-hero">
				<img src={brand.logo} alt={brand.name} className="brand-hero-logo" />
				<div className="brand-hero-info">
					<h1>{brand.name}</h1>
					<div className="brand-hero-meta">
						<span>{brand.category}</span>
						<span>•</span>
						<a href={brand.website} target="_blank" rel="noreferrer" style={{ color: "inherit", display: "flex", alignItems: "center", gap: "4px" }}>
							{brand.website.replace("https://www.", "")} <ExternalLink size={14} />
						</a>
					</div>
					<div className="brand-metrics">
						<div className="metric-item">
							<span className="metric-value">{liveAdsCount}</span>
							<span className="metric-label">Live Ads</span>
						</div>
						<div className="metric-item">
							<span className="metric-value">{newAdsCount}</span>
							<span className="metric-label">New Last 30 Days</span>
						</div>
					</div>

					<div style={{ marginTop: "20px" }}>
						<button className={`follow-btn ${brand.is_followed ? "active" : ""}`} onClick={toggleFollow}>
							{brand.is_followed ? (
								<>
									<UserCheck size={18} /> Following
								</>
							) : (
								<>
									<UserPlus size={18} /> Follow Brand
								</>
							)}
						</button>
					</div>
				</div>
			</div>

			<h2 className="section-title" style={{ textAlign: "left" }}>
				Ad Library
			</h2>

			<div className="discovery-grid">
				{ads.map((ad) => (
					<AdCard key={ad.id} ad={ad} onBookmarkToggle={toggleBookmark} showRunningTime={true} />
				))}
			</div>
		</div>
	);
};

export default BrandDetails;
