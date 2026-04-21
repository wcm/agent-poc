import React, { useEffect, useState } from "react";
import rayaThinking from "../../assets/raya-thinking.gif";

export type AssistantStreamingPhase = "reasoning" | "writing";

const REASONING_PHASE_LINES = ["Gathering signals...", "Scanning trends...", "Finding angles...", "Reading the market..."];

const WRITING_PHASE_LINES = ["Drafting insights...", "Polishing copy...", "Framing recommendations...", "Sharpening takeaways..."];

interface AssistantStreamingIndicatorProps {
	phase: AssistantStreamingPhase;
}

const AssistantStreamingIndicator: React.FC<AssistantStreamingIndicatorProps> = ({ phase }) => {
	const lines = phase === "reasoning" ? REASONING_PHASE_LINES : WRITING_PHASE_LINES;
	const [lineIndex, setLineIndex] = useState(0);

	useEffect(() => {
		setLineIndex(0);
		const intervalId = window.setInterval(() => {
			setLineIndex((current) => (current + 1) % lines.length);
		}, 3500);

		return () => window.clearInterval(intervalId);
	}, [phase, lines.length]);

	return (
		<div className="assistant-streaming-indicator">
			<div className="assistant-streaming-avatar">
				<img src={rayaThinking} alt="Raya thinking" className="assistant-streaming-avatar-image" />
			</div>
			<div className="assistant-streaming-copy">
				<span className="assistant-streaming-phase">{phase === "reasoning" ? "Analyzing" : "Writing"}</span>
				<span key={`${phase}-${lineIndex}`} className="assistant-streaming-line">
					{lines[lineIndex]}
				</span>
			</div>
		</div>
	);
};

export default AssistantStreamingIndicator;
