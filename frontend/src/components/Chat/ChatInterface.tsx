import React, { useRef, useEffect, useState } from "react";
import { ArrowUp, X } from "lucide-react";
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

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, streamingSections, planStates, onSendMessage }) => {
	const [input, setInput] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

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

	useEffect(() => {
		scrollToBottom();
	}, [messages, streamingSections]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;

		// Pass context with message
		const context = {
			channel: selectedChannels[0],
			brands: selectedBrands,
		};
		onSendMessage(input, context);
		setInput("");
	};

	const handleSuggestedClick = (text: string) => {
		const context = {
			channel: selectedChannels[0],
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

	const isEmptyState = messages.length === 0 && !isLoading;

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
						{selectedBrands.map((brand) => (
							<span key={brand.id} className="context-pill brand">
								{brand.name}
								<button onClick={() => removeBrand(brand.id)}>
									<X size={12} />
								</button>
							</span>
						))}
						{selectedChannels.length === 0 && (
							<button className="tag-btn" onClick={() => setShowChannelSelector(true)}>
								+ Channel
							</button>
						)}
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
			<div className="chat-messages-area">
				{isEmptyState && (
					<div className="empty-state-container">
						<h2 className="center-brand">Atria</h2>
						{/* Inline input for empty state */}
						{renderInputArea(true)}
						<div className="suggested-questions-container">
							<div className="cards-grid">
								<button className="suggested-card" onClick={() => handleSuggestedClick("Compare my top spend and top ROAS ads and formulate a winning formula")}>
									<span className="card-title">Compare top performers</span>
									<span className="card-subtitle">Find winning patterns across metrics</span>
								</button>
								<button className="suggested-card" onClick={() => handleSuggestedClick("Why is my top ad performing so well? Deep dive into the creative.")}>
									<span className="card-title">Deep dive into top performers</span>
									<span className="card-subtitle">Why are my best ads performing well?</span>
								</button>
								<button className="suggested-card" onClick={() => handleSuggestedClick("Compare my top 3 and worst 3 ads and create insights")}>
									<span className="card-title">Top vs Bottom analysis</span>
									<span className="card-subtitle">What makes winners different from losers?</span>
								</button>
								<button className="suggested-card" onClick={() => handleSuggestedClick("Show me my video ad performance")}>
									<span className="card-title">Video ad analysis</span>
									<span className="card-subtitle">How are my video ads doing?</span>
								</button>
							</div>
						</div>
					</div>
				)}

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
			</div>

			{/* Floating input for active chat */}
			{!isEmptyState && renderInputArea(false)}

			{/* Context Selector Popups */}
			{showChannelSelector && <ContextSelector type="channel" selectedIds={selectedChannels.map((c) => c.id)} onSelect={handleChannelSelect} onClose={() => setShowChannelSelector(false)} />}
			{showBrandSelector && <ContextSelector type="brand" selectedIds={selectedBrands.map((b) => b.id)} onSelect={handleBrandSelect} onClose={() => setShowBrandSelector(false)} />}
		</div>
	);
};

export default ChatInterface;
