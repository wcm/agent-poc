import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, Paperclip } from 'lucide-react';
import { Message, StepUpdate } from '../../types';
import AgentProcessDisplay from './AgentProcessDisplay';
import { MessageContent } from '../../MessageContent';

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  currentProcessSteps: StepUpdate[];
  onSendMessage: (message: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isLoading,
  currentProcessSteps,
  onSendMessage
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentProcessSteps]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
  };

  const handleSuggestedClick = (text: string) => {
    onSendMessage(text);
  };

  return (
    <div className="chat-interface">

      <div className="chat-messages-area">
        {messages.length === 0 && (
          <div className="empty-state-container">
             {/* Center branding could go here if in reference (Reference has 'Atria' big in center) */}
             <h2 className="center-brand">Atria</h2>

            <div className="suggested-questions-container">
               {/* 
                 Updated structure to match the reference image: 
                 Grid of cards, maybe 2x2. 
               */}
              <div className="cards-grid">
                <button
                    className="suggested-card"
                    onClick={() => handleSuggestedClick("Based on my current performance, which ads should I experiment more with, and why?")}
                >
                    <span className="card-title">Analyze my ad performance</span>
                    <span className="card-subtitle">Which ads need more experimentation?</span>
                </button>
                <button
                    className="suggested-card"
                    onClick={() => handleSuggestedClick("Clone competitor's top performing ads")}
                >
                    <span className="card-title">Clone competitor's top performing ads</span>
                    <span className="card-subtitle">Why are my best ads performing well?</span>
                </button>
                <button
                    className="suggested-card"
                    onClick={() => handleSuggestedClick("Learn from my poor performing ads")}
                >
                    <span className="card-title">Learn from my poor performing ads</span>
                    <span className="card-subtitle">Which ads need more experimentation?</span>
                </button>
                 <button
                    className="suggested-card"
                    onClick={() => handleSuggestedClick("Scale my winning ads to new products")}
                >
                    <span className="card-title">Scale my winning ads to new products</span>
                    <span className="card-subtitle">What are the top 3 key actions to take?</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <React.Fragment key={index}>
            {msg.steps && msg.steps.length > 0 && <AgentProcessDisplay steps={msg.steps} isComplete={true} />}
            <div className={`message ${msg.role}`}>
              {msg.role === 'user' ? (
                <div className="message-content">{msg.content}</div>
              ) : (
                <MessageContent content={msg.content} dataPool={msg.dataPool} />
              )}
            </div>
          </React.Fragment>
        ))}

        {isLoading && currentProcessSteps.length > 0 && <AgentProcessDisplay steps={currentProcessSteps} isComplete={false} />}
        
        <div ref={messagesEndRef} />
      </div>

       {/* Floating Input Area as per reference image */}
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
