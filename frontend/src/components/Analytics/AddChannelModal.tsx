import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { Channel } from "../Sidebar/Sidebar";

interface AddChannelModalProps {
	isOpen: boolean;
	onClose: () => void;
	channels: Channel[];
	onChannelSelect: (channelId: string) => void;
	onChannelConnect: (channelId: string) => Promise<void>;
	onRefreshChannels: () => void;
}

// Platform Icons
const MetaIcon = () => <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQoqP_1QDPvtErnUpBxJrxH33nx7zB9-7m2-w&s" alt="Meta" width="20" height="20" style={{ objectFit: "contain" }} />;

const TikTokIcon = () => <img src="https://i.pinimg.com/1200x/40/21/63/4021636b5d203c1aba86e2643a30b87c.jpg" alt="TikTok" width="20" height="20" style={{ objectFit: "contain" }} />;

const GoogleIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24">
		<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
		<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
		<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
		<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
	</svg>
);

const LinkedInIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2">
		<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
	</svg>
);

const FacebookIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
		<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
	</svg>
);

const InstagramIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="url(#instagram-gradient)">
		<defs>
			<linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
				<stop offset="0%" stopColor="#FFDC80" />
				<stop offset="25%" stopColor="#F77737" />
				<stop offset="50%" stopColor="#E1306C" />
				<stop offset="75%" stopColor="#C13584" />
				<stop offset="100%" stopColor="#833AB4" />
			</linearGradient>
		</defs>
		<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
	</svg>
);

const YouTubeIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000">
		<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
	</svg>
);

const XIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="#000000">
		<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
	</svg>
);

const RedditIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="#FF4500">
		<path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
	</svg>
);

const HubSpotIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="#FF7A59">
		<path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.198 2.198 0 0017.235.839h-.067a2.198 2.198 0 00-2.195 2.195v.066c0 .87.51 1.62 1.244 1.974v2.865a6.252 6.252 0 00-2.932 1.49l-7.74-6.015a2.424 2.424 0 00.058-.523A2.42 2.42 0 103.18 5.31a2.4 2.4 0 001.477-.506l7.633 5.932a6.27 6.27 0 00-.927 3.285 6.272 6.272 0 001.09 3.527l-2.412 2.413a2.09 2.09 0 00-.603-.094 2.108 2.108 0 102.108 2.108c0-.2-.03-.393-.083-.576l2.455-2.455a6.28 6.28 0 003.246.901 6.291 6.291 0 006.282-6.282 6.29 6.29 0 00-5.282-6.203zm-.012 9.58a3.377 3.377 0 01-3.374-3.373 3.377 3.377 0 013.374-3.374 3.377 3.377 0 013.374 3.374 3.377 3.377 0 01-3.374 3.374z" />
	</svg>
);

const SalesforceIcon = () => (
	<img src="https://cdn.iconscout.com/icon/free/png-256/free-salesforce-icon-svg-download-png-282298.png?f=webp" alt="Salesforce" width="20" height="20" style={{ objectFit: "contain" }} />
);

const SnowflakeIcon = () => (
	<img src="https://cdn-1.webcatalog.io/catalog/snowflake/snowflake-icon-filled-256.png?v=1714775899998" alt="Snowflake" width="20" height="20" style={{ objectFit: "contain" }} />
);

const AffiliateIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
		<circle cx="9" cy="7" r="4" />
		<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
		<path d="M16 3.13a4 4 0 0 1 0 7.75" />
	</svg>
);

const AIIcon = () => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
	</svg>
);

// Icon mapping
const CHANNEL_ICONS: Record<string, React.ReactNode> = {
	meta_ads: <MetaIcon />,
	tiktok_ads: <TikTokIcon />,
	google_ads: <GoogleIcon />,
	linkedin_ads: <LinkedInIcon />,
	facebook: <FacebookIcon />,
	instagram: <InstagramIcon />,
	tiktok: <TikTokIcon />,
	youtube: <YouTubeIcon />,
	x: <XIcon />,
	linkedin: <LinkedInIcon />,
	reddit: <RedditIcon />,
	google_analytics: <GoogleIcon />,
	google_search_console: <GoogleIcon />,
	hubspot: <HubSpotIcon />,
	salesforce: <SalesforceIcon />,
	snowflake: <SnowflakeIcon />,
	affiliate: <AffiliateIcon />,
	ai_presence: <AIIcon />,
};

// Channel data organized by category
// channelId maps to the backend channel id for available channels
const CHANNEL_CATEGORIES = [
	{
		name: "Paid Ads",
		channels: [
			{ id: "meta_ads", name: "Meta Ads", available: true, channelId: "channel_1", platform: "meta" },
			{ id: "tiktok_ads", name: "TikTok Ads", available: true, channelId: "channel_2", platform: "tiktok" },
			{ id: "google_ads", name: "Google Ads", available: false },
			{ id: "linkedin_ads", name: "LinkedIn Ads", available: false },
		],
	},
	{
		name: "Social Media",
		channels: [
			{ id: "facebook", name: "Facebook", available: false },
			{ id: "instagram", name: "Instagram", available: false },
			{ id: "tiktok", name: "TikTok", available: false },
			{ id: "youtube", name: "YouTube", available: false },
			{ id: "x", name: "X (Twitter)", available: false },
			{ id: "linkedin", name: "LinkedIn", available: false },
			{ id: "reddit", name: "Reddit", available: false },
		],
	},
	{
		name: "SEO & Analytics",
		channels: [
			{ id: "google_analytics", name: "Google Analytics", available: false },
			{ id: "google_search_console", name: "Search Console", available: false },
		],
	},
	{
		name: "CRM & Data",
		channels: [
			{ id: "hubspot", name: "HubSpot", available: false },
			{ id: "salesforce", name: "Salesforce", available: false },
			{ id: "snowflake", name: "Snowflake", available: false },
		],
	},
	{
		name: "Others",
		channels: [
			{ id: "affiliate", name: "Affiliate & KOLs", available: false },
			{ id: "ai_presence", name: "AI Presence", available: false },
		],
	},
];

const AddChannelModal: React.FC<AddChannelModalProps> = ({ isOpen, onClose, channels, onChannelSelect, onChannelConnect, onRefreshChannels }) => {
	const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
	const [connecting, setConnecting] = useState<string | null>(null);

	if (!isOpen) return null;

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	const showToast = (message: string) => {
		setToast({ message, visible: true });
		setTimeout(() => setToast({ message: "", visible: false }), 3000);
	};

	const isChannelConnected = (channelId?: string) => {
		if (!channelId) return false;
		const channel = channels.find((c) => c.id === channelId);
		return channel?.is_connected || false;
	};

	const handleChannelClick = async (channel: { id: string; name: string; available: boolean; channelId?: string }) => {
		if (!channel.available) {
			// Coming soon channels - no effect
			return;
		}

		if (!channel.channelId) return;

		if (isChannelConnected(channel.channelId)) {
			// Already connected - navigate to dashboard
			onChannelSelect(channel.channelId);
			onClose();
		} else {
			// Not connected - connect first, then navigate
			setConnecting(channel.id);
			try {
				await onChannelConnect(channel.channelId);
				onRefreshChannels();
				showToast(`${channel.name} connected successfully!`);
				// Wait a moment for the toast to show, then navigate
				setTimeout(() => {
					onChannelSelect(channel.channelId!);
					onClose();
				}, 1500);
			} catch (error) {
				console.error("Failed to connect channel:", error);
				showToast("Failed to connect channel. Please try again.");
			} finally {
				setConnecting(null);
			}
		}
	};

	return (
		<div className="add-channel-backdrop" onClick={handleBackdropClick}>
			<div className="add-channel-modal">
				<div className="add-channel-header">
					<h2>Add Channel</h2>
					<button className="close-btn" onClick={onClose}>
						<X size={20} />
					</button>
				</div>
				<p className="add-channel-subtitle">Connect your marketing channels to unlock insights</p>

				<div className="channel-categories">
					{CHANNEL_CATEGORIES.map((category) => (
						<div key={category.name} className="channel-category">
							<div className="category-name">{category.name}</div>
							<div className="channel-chips">
								{category.channels.map((channel) => {
									const isConnecting = connecting === channel.id;
									return (
										<button key={channel.id} className={`channel-chip ${isConnecting ? "connecting" : ""}`} onClick={() => handleChannelClick(channel)}>
											<span className="chip-icon">{CHANNEL_ICONS[channel.id]}</span>
											<span className="chip-name">{channel.name}</span>
											{!channel.available && <span className="chip-badge">Soon</span>}
											{isConnecting && <span className="chip-connecting">...</span>}
										</button>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Toast notification */}
			{toast.visible && (
				<div className="toast-notification">
					<Check size={16} />
					<span>{toast.message}</span>
				</div>
			)}
		</div>
	);
};

export default AddChannelModal;
