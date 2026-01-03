import React, { useEffect, useState } from 'react';
import { Brand, Ad } from '../../types';
import { ArrowRight, UserCheck, Play } from 'lucide-react';

interface FollowingBrandsProps {
    onViewDetails: (brandId: string) => void;
}

const FollowingBrands: React.FC<FollowingBrandsProps> = ({ onViewDetails }) => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [ads, setAds] = useState<Ad[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
             const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3001" : "";
             
             try {
                // Fetch Brands
                const brandsRes = await fetch(`${baseUrl}/api/brands`);
                const brandsData: Brand[] = await brandsRes.json();
                
                // Fetch All Ads (to preview latest)
                const adsRes = await fetch(`${baseUrl}/api/inspirations/discovery`);
                const adsData: Ad[] = await adsRes.json();
                
                setBrands(brandsData.filter(b => b.is_followed));
                setAds(adsData);
             } catch (err) {
                 console.error("Error fetching data", err);
             } finally {
                 setLoading(false);
             }
        };
        fetchData();
    }, []);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="discovery-feed-container">
            <h2 className="section-title">Following Brands</h2>
            <div className="brands-list">
                {brands.length === 0 ? (
                    <div className="no-results">You are not following any brands yet.</div>
                ) : (
                    brands.map(brand => {
                        const allBrandAds = ads.filter(a => a.brand_id === brand.id || a.brand_name === brand.name);
                        const brandAds = allBrandAds
                            .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
                            .slice(0, 4); // Top 4
                        
                        // Calculate metrics
                        const liveAdsCount = allBrandAds.filter(a => a.status === 'active').length;
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        const newAdsCount = allBrandAds.filter(a => new Date(a.start_date) >= thirtyDaysAgo).length;
                            
                        return (
                            <div key={brand.id} className="brand-row">
                                <div className="brand-info-col">
                                    <div className="brand-header-large">
                                        <img src={brand.logo} alt={brand.name} className="brand-logo-large" />
                                        <div>
                                            <h3 className="brand-name-large">{brand.name}</h3>
                                            <span className="brand-category">{brand.category}</span>
                                        </div>
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
                                    <div className="brand-actions">
                                        <button className="following-btn">
                                            <UserCheck size={16} /> Following
                                        </button>
                                        <button className="view-details-btn" onClick={() => onViewDetails(brand.id)}>
                                            View Details <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="brand-ads-preview">
                                    {brandAds.map(ad => (
                                        <div key={ad.id} className="mini-ad-card">
                                            <img src={ad.image_url} alt={ad.headline} />
                                            {ad.display_format === 'video' && (
                                                <div className="mini-video-badge">
                                                    <Play size={10} fill="white" color="white" />
                                                    <span>{ad.video_length}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {brandAds.length === 0 && <span className="no-ads-text">No active ads</span>}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default FollowingBrands;
