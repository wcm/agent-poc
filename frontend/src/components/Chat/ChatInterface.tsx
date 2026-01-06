import React, { useRef, useEffect, useState, useCallback } from "react";
import { ArrowUp, X, BarChart3, Sparkles, Eye, Compass, LucideIcon } from "lucide-react";
import { Message, StreamedSection, PlanTask, Channel, Brand } from "../../types";
import StreamingMessage from "./StreamingMessage";
import ContextSelector from "./ContextSelector";
import { MessageContent } from "../../MessageContent";

interface ChatInterfaceProps {
	messages: Message[];
	isLoading: boolean;
	streamingSections: StreamedSection[];
	planStates: Map<string, PlanTask[]>;
	onSendMessage: (message: string, context?: { channel?: Channel; brands: Brand[] }) => void;
}

// Question categories with detailed prompts
const SUGGESTED_QUESTIONS: Record<string, { title: string; icon: LucideIcon; questions: { title: string; summary: string; question: string }[] }> = {
	ownPerformance: {
		title: "Own Performance",
		icon: BarChart3,
		questions: [
			{
				title: "Top Performers",
				summary: "See your best ads by ROAS",
				question: "Show me my top performing ads sorted by ROAS. Include key metrics like spend, CTR, and impressions.",
			},
			{
				title: "Video vs Image",
				summary: "Compare ad format performance",
				question: "Compare my video ads vs image ads performance. Which format drives better ROAS and engagement?",
			},
			{
				title: "Winners vs Losers",
				summary: "What separates best from worst",
				question: "Compare my top 3 and worst 3 performing ads. Analyze what makes the winners successful and losers underperform.",
			},
			{
				title: "Winning Formula",
				summary: "Find patterns in top ads",
				question: "Analyze my top spend ads vs top ROAS ads, deep dive into their creatives, and formulate a winning creative formula.",
			},
		],
	},
	creativeAnalysis: {
		title: "Creative Analysis",
		icon: Sparkles,
		questions: [
			{
				title: "Best Creative",
				summary: "Analyze your top ad creative",
				question: "Analyze the creative of my best performing ad. What visual and copy elements make it work?",
			},
			{
				title: "Success Patterns",
				summary: "What makes top ads work",
				question: "Analyze the creative patterns across my top 5 performing ads. What do they have in common?",
			},
			{
				title: "Video Deep Dive",
				summary: "Break down video ad hooks",
				question: "Deep dive into my top video ad creatives. Analyze the hooks, messaging, and visual elements that drive engagement.",
			},
			{
				title: "Creative Template",
				summary: "Build a template from winners",
				question: "Break down the creative elements of my top 3 performers and create a repeatable creative template I can use.",
			},
		],
	},
	competitorIntel: {
		title: "Competitor Intel",
		icon: Eye,
		questions: [
			{
				title: "Top Competitors",
				summary: "See trending competitor ads",
				question: "Show me top competitor ads that are currently active. Analyze their key themes and strategies.",
			},
			{
				title: "Brand Spotlight",
				summary: "Analyze a specific brand",
				question: "What campaigns is Adidas currently running? Analyze their creative approach and messaging.",
			},
			{
				title: "Video Strategies",
				summary: "Learn from competitor videos",
				question: "Analyze competitor video ad strategies. What hooks and formats are they using that we can learn from?",
			},
			{
				title: "Evergreen Ads",
				summary: "Find long-running campaigns",
				question: "Find the longest-running competitor campaigns and analyze why they've been successful over time.",
			},
		],
	},
	strategicInsights: {
		title: "Strategic Insights",
		icon: Compass,
		questions: [
			{
				title: "Quick Compare",
				summary: "How do I stack up",
				question: "Give me a quick comparison of how my ads perform vs what competitors are running.",
			},
			{
				title: "Gap Analysis",
				summary: "What am I missing",
				question: "Analyze competitor ads and identify creative approaches or formats I'm not currently using.",
			},
			{
				title: "Beat Competition",
				summary: "Learn from the best",
				question: "Compare my top ads with Adidas' approach. Identify what they do better and opportunities for me.",
			},
			{
				title: "Growth Strategy",
				summary: "Full strategic roadmap",
				question: "Based on my top performers and competitor insights, create a winning creative strategy with specific recommendations.",
			},
		],
	},
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, streamingSections, planStates, onSendMessage }) => {
	const [input, setInput] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Callback ref that scrolls to top when empty state mounts
	const emptyStateRef = useCallback((node: HTMLDivElement | null) => {
		if (node) {
			node.scrollTo({ top: 0, behavior: "auto" });
		}
	}, []);

	// Context selection state
	const [selectedChannels, setSelectedChannels] = useState<Channel[]>([]);
	const [selectedBrands, setSelectedBrands] = useState<Brand[]>([]);
	const [showChannelSelector, setShowChannelSelector] = useState(false);
	const [showBrandSelector, setShowBrandSelector] = useState(false);

	// Cache for channel/brand data
	const [channelsCache, setChannelsCache] = useState<Channel[]>([]);
	const [brandsCache, setBrandsCache] = useState<Brand[]>([]);

	const baseUrl = window.location.hostname === "localhost" ? "http://localhost:3002" : "";

	// Fetch channels and brands for cache on mount
	useEffect(() => {
		const fetchData = async () => {
			try {
				const [channelsRes, brandsRes] = await Promise.all([fetch(`${baseUrl}/api/own-analytics`), fetch(`${baseUrl}/api/brands`)]);
				const channelsData = await channelsRes.json();
				const brandsData: Brand[] = await brandsRes.json();
				setChannelsCache(channelsData.channels || []);
				setBrandsCache(brandsData.filter((b) => b.is_followed));
			} catch (err) {
				console.error("Error fetching context data:", err);
			}
		};
		fetchData();
	}, [baseUrl]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	const isEmptyState = messages.length === 0 && !isLoading;

	useEffect(() => {
		if (!isEmptyState) {
			scrollToBottom();
		}
	}, [messages, streamingSections, isEmptyState]);

	// Get effective channel - use selected or first from cache as default
	const getEffectiveChannel = () => {
		return selectedChannels[0] || channelsCache[0] || undefined;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;

		// Pass context with message - use default channel if none selected
		const context = {
			channel: getEffectiveChannel(),
			brands: selectedBrands,
		};
		onSendMessage(input, context);
		setInput("");
	};

	const handleSuggestedClick = (text: string) => {
		const context = {
			channel: getEffectiveChannel(),
			brands: selectedBrands,
		};
		onSendMessage(text, context);
	};

	const handleChannelSelect = (ids: string[]) => {
		const channels = channelsCache.filter((c) => ids.includes(c.id));
		setSelectedChannels(channels);
	};

	const handleBrandSelect = (ids: string[]) => {
		const brands = brandsCache.filter((b) => ids.includes(b.id));
		setSelectedBrands(brands);
	};

	const removeChannel = (id: string) => {
		setSelectedChannels((prev) => prev.filter((c) => c.id !== id));
	};

	const removeBrand = (id: string) => {
		setSelectedBrands((prev) => prev.filter((b) => b.id !== id));
	};

	const renderMessage = (msg: Message, index: number) => {
		if (msg.role === "user") {
			return (
				<div key={index} className="message user">
					<div className="message-content">{msg.content}</div>
				</div>
			);
		}

		// Assistant message with new streaming sections format
		if (msg.sections && msg.sections.length > 0) {
			return (
				<div key={index} className="assistant-response">
					<StreamingMessage sections={msg.sections} planStates={new Map()} hidePlan={false} />
				</div>
			);
		}

		// Fallback to legacy format (plain text)
		return (
			<div key={index} className="message assistant">
				<MessageContent content={msg.content} dataPool={undefined} />
			</div>
		);
	};

	// Input area component (reusable)
	const renderInputArea = (isInline: boolean) => (
		<div className={`chat-input-area ${isInline ? "inline" : "floating"}`}>
			{isInline && (
				<>
					<div className="input-actions-bar">
						{selectedChannels.map((channel) => (
							<span key={channel.id} className="context-pill channel">
								{channel.name}
								<button onClick={() => removeChannel(channel.id)}>
									<X size={12} />
								</button>
							</span>
						))}
						{selectedChannels.length === 0 && (
							<button className="tag-btn" onClick={() => setShowChannelSelector(true)}>
								+ Channel
							</button>
						)}
						{selectedBrands.map((brand) => (
							<span key={brand.id} className="context-pill brand">
								{brand.name}
								<button onClick={() => removeBrand(brand.id)}>
									<X size={12} />
								</button>
							</span>
						))}
						<button className="tag-btn" onClick={() => setShowBrandSelector(true)}>
							+ Following Brand
						</button>
					</div>
				</>
			)}
			<form onSubmit={handleSubmit} className="input-wrapper">
				<input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask me to do anything..." disabled={isLoading} />
				<button type="submit" disabled={isLoading || !input.trim()} className="send-btn">
					<ArrowUp size={18} color="white" />
				</button>
			</form>
		</div>
	);

	return (
		<div className="chat-interface">
			{isEmptyState ? (
				<div className="empty-state-container" ref={emptyStateRef}>
					<h2 className="center-brand">Atria</h2>
					{/* Inline input for empty state */}
					{renderInputArea(true)}
					<div className="suggested-questions-container">
						{Object.values(SUGGESTED_QUESTIONS).map((category) => {
							const IconComponent = category.icon;
							return (
								<div key={category.title} className="question-category">
									<h3 className="category-title">
										<IconComponent size={20} className="category-icon" />
										{category.title}
									</h3>
									<div className="cards-grid">
										{category.questions.map((q) => (
											<button key={q.title} className="suggested-card" onClick={() => handleSuggestedClick(q.question)}>
												<span className="card-title">{q.title}</span>
												<span className="card-subtitle">{q.summary}</span>
											</button>
										))}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			) : (
				<div className="chat-messages-area">
					{/* Render completed messages */}
					{messages.map((msg, index) => renderMessage(msg, index))}

					{/* Render streaming sections during loading */}
					{isLoading && streamingSections.length > 0 && (
						<div className="assistant-response streaming">
							<StreamingMessage sections={streamingSections} planStates={planStates} hidePlan={false} />
						</div>
					)}

					{/* Loading indicator when no sections yet */}
					{isLoading && streamingSections.length === 0 && (
						<div className="loading-indicator">
							<span className="loading-text">Thinking...</span>
						</div>
					)}

					<div ref={messagesEndRef} />
					{/* Floating input for active chat */}
					{renderInputArea(false)}
				</div>
			)}
			{/* Context Selector Popups */}
			{showChannelSelector && <ContextSelector type="channel" selectedIds={selectedChannels.map((c) => c.id)} onSelect={handleChannelSelect} onClose={() => setShowChannelSelector(false)} />}
			{showBrandSelector && <ContextSelector type="brand" selectedIds={selectedBrands.map((b) => b.id)} onSelect={handleBrandSelect} onClose={() => setShowBrandSelector(false)} />}
		</div>
	);
};

export default ChatInterface;
