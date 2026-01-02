import React, { useEffect, useState } from 'react';
import { Heart, Globe, Bookmark, MoreHorizontal } from 'lucide-react';

interface Ad {
  id: string;
  brand_name: string;
  brand_logo: string;
  image_url: string;
  headline: string;
  primary_text: string;
  cta: string;
  engagement_score: number;
  platform: string;
}

const DiscoveryFeed: React.FC = () => {
    const [ads, setAds] = useState<Ad[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAds = async () => {
            try {
                const apiUrl = window.location.hostname === "localhost" 
                    ? "http://localhost:3001/api/inspirations/discovery"
                    : "/api/inspirations/discovery";
                    
                console.log("Fetching ads from:", apiUrl);
                const response = await fetch(apiUrl);
                if (response.ok) {
                    const data = await response.json();
                    console.log("Ads fetched:", data);
                    setAds(data);
                } else {
                    console.error("Response not ok:", response.status, response.statusText);
                    setError(`Failed to load ads: ${response.status} ${response.statusText}`);
                }
            } catch (error: any) {
                console.error("Failed to fetch discovery ads:", error);
                setError(`Network error: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchAds();
    }, []);

    if (loading) {
        return <div className="discovery-loading">Loading Discovery Feed...</div>;
    }

    if (error) {
        return <div className="discovery-loading" style={{ color: 'red' }}>Error: {error}. Please ensure backend server is running.</div>;
    }

    if (ads.length === 0) {
        return <div className="discovery-loading">No ads found. Please check backend data source.</div>;
    }

    return (
        <div className="discovery-feed-container">
            <h2 className="section-title">Discover Trending Ads</h2>
            <div className="discovery-grid">
                {ads.map((ad) => (
                    <div key={ad.id} className="ad-card">
                        <div className="ad-header">
                            <img src={ad.brand_logo} alt={ad.brand_name} className="ad-brand-logo" />
                            <div className="ad-header-text">
                                <span className="ad-brand-name">{ad.brand_name}</span>
                                <span className="ad-platform">{ad.platform}</span>
                            </div>
                            <button className="ad-menu-btn"><MoreHorizontal size={16} /></button>
                        </div>
                        
                        <div className="ad-image-container">
                            <img src={ad.image_url} alt={ad.headline} className="ad-image" />
                            <div className="ad-overlay-score">{ad.engagement_score} Score</div>
                        </div>
                        
                        <div className="ad-content">
                            <div className="ad-headline">{ad.headline}</div>
                            <div className="ad-text">{ad.primary_text}</div>
                            <div className="ad-footer">
                                <button className="ad-cta-btn">{ad.cta}</button>
                                <div className="ad-actions">
                                    <button className="action-btn"><Heart size={18} /></button>
                                    <button className="action-btn"><Bookmark size={18} /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DiscoveryFeed;
