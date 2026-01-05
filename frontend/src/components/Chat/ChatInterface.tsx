import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ArrowUp, Paperclip } from 'lucide-react';
import { Message, StreamedSection, PlanTask } from '../../types';
import StreamingMessage from './StreamingMessage';
import PlanTimeline from './PlanTimeline';
import { MessageContent } from '../../MessageContent';

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
    streamingSections: StreamedSection[];
    planStates: Map<string, PlanTask[]>;
  onSendMessage: (message: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isLoading,
    streamingSections,
    planStates,
  onSendMessage
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Extract current plan from streaming sections
  const currentPlan = useMemo(() => {
    const planSection = streamingSections.find(s => s.type === 'plan');
    if (!planSection || planSection.type !== 'plan') return null;
    
    // Get the latest task states for this plan
    const tasks = planStates.get(planSection.planId) || planSection.tasks;
    return {
      planId: planSection.planId,
      agentName: planSection.agentName,
      title: planSection.title,
      tasks
    };
  }, [streamingSections, planStates]);

  // Filter out plan sections for inline rendering (plan is shown sticky)
  const nonPlanSections = useMemo(() => {
    return streamingSections.filter(s => s.type !== 'plan');
  }, [streamingSections]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    }, [messages, streamingSections]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
  };

  const handleSuggestedClick = (text: string) => {
    onSendMessage(text);
  };

    const renderMessage = (msg: Message, index: number) => {
        if (msg.role === 'user') {
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
                    <StreamingMessage 
                        sections={msg.sections} 
                        planStates={new Map()} // Completed messages don't need plan state updates
                        hidePlan={true} // Don't show plan inline for completed messages
                    />
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

  // Determine if we should show the sticky plan
  const showStickyPlan = isLoading && currentPlan && currentPlan.tasks.length > 0;

  return (
    <div className={`chat-interface ${showStickyPlan ? 'with-sticky-plan' : ''}`}>
      {/* Sticky Plan Sidebar */}
      {showStickyPlan && (
        <PlanTimeline
          planId={currentPlan.planId}
          agentName={currentPlan.agentName}
          title={currentPlan.title}
          tasks={currentPlan.tasks}
          isSticky={true}
          isVisible={isLoading}
        />
      )}
      
      <div className="chat-messages-area">
                {messages.length === 0 && !isLoading && (
          <div className="empty-state-container">
             <h2 className="center-brand">Atria</h2>

            <div className="suggested-questions-container">
              <div className="cards-grid">
                <button
                    className="suggested-card"
                    onClick={() => handleSuggestedClick("Compare my top spend and top ROAS ads and formulate a winning formula")}
                >
                    <span className="card-title">Compare top performers</span>
                    <span className="card-subtitle">Find winning patterns across metrics</span>
                </button>
                <button
                    className="suggested-card"
                                    onClick={() => handleSuggestedClick("Why is my top ad performing so well? Deep dive into the creative.")}
                >
                                    <span className="card-title">Deep dive into top performers</span>
                    <span className="card-subtitle">Why are my best ads performing well?</span>
                </button>
                <button
                    className="suggested-card"
                                    onClick={() => handleSuggestedClick("Compare my top 3 and worst 3 ads and create insights")}
                >
                                    <span className="card-title">Top vs Bottom analysis</span>
                                    <span className="card-subtitle">What makes winners different from losers?</span>
                </button>
                 <button
                    className="suggested-card"
                                    onClick={() => handleSuggestedClick("Show me my video ad performance")}
                >
                                    <span className="card-title">Video ad analysis</span>
                                    <span className="card-subtitle">How are my video ads doing?</span>
                </button>
              </div>
            </div>
          </div>
        )}

                {/* Render completed messages */}
                {messages.map((msg, index) => renderMessage(msg, index))}

                {/* Render streaming sections during loading (without plan, shown sticky) */}
                {isLoading && nonPlanSections.length > 0 && (
                    <div className="assistant-response streaming">
                        <StreamingMessage 
                            sections={nonPlanSections} 
                            planStates={planStates}
                            hidePlan={true}
                        />
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

            {/* Floating Input Area */}
       <div className="chat-input-area">
          <div className="input-actions-bar">
             <button className="tag-btn">+ Ad Account</button>
             <button className="tag-btn">+ Brand</button>
             <button className="tag-btn">+ Following Brand</button>
             <span className="attach-icon"><Paperclip size={16}/></span>
          </div>
          <form onSubmit={handleSubmit} className="input-wrapper">
            <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Ask me to do anything..." 
                disabled={isLoading} 
            />
            <button type="submit" disabled={isLoading || !input.trim()} className="send-btn">
                <ArrowUp size={18} color="white" />
            </button>
          </form>
       </div>
    </div>
  );
};

export default ChatInterface;
