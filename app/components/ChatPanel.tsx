import React, { useState, useRef, useEffect } from "react";
import { BotIcon, UserIcon, SendIcon, SparklesIcon } from "./Icons";

export interface Citation {
  docId: string;
  docName: string;
  chunkSnippet: string;
  similarity: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  citations?: Citation[];
  timestamp: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  availableModels: string[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isGenerating,
  selectedModel,
  onModelChange,
  availableModels,
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inspectCitation, setInspectCitation] = useState<Citation | null>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    "Summarize this document",
    "Find key takeaways",
    "Explain cross-references",
  ];

  return (
    <div className="w-80 flex flex-col border-l border-zinc-800 bg-zinc-950/80 backdrop-blur-md select-none text-zinc-200">
      {/* AI Assistant Header */}
      <div className="p-4 border-b border-zinc-900 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BotIcon className="text-indigo-400" size={16} />
            <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
              AI Copilot
            </h2>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-indigo-950/40 border border-indigo-500/20 text-cyan-400">
            Server LLM
          </span>
        </div>

        {/* Model Selection Dropdown */}
        <div className="relative">
          <select
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full text-[11px] rounded-lg bg-zinc-900/50 border border-zinc-800 text-zinc-300 px-3 py-1.5 focus:outline-none focus:border-indigo-500/50 appearance-none font-mono cursor-pointer"
          >
            {availableModels.map((model) => (
              <option key={model} value={model} className="bg-zinc-950 text-zinc-300">
                {model}
              </option>
            ))}
          </select>
          <div className="absolute right-3.5 top-2.5 pointer-events-none h-2 w-2 border-b-2 border-r-2 border-zinc-500 transform rotate-45" />
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
              <BotIcon className="text-zinc-600" size={18} />
            </div>
            <p className="text-xs text-zinc-400 font-medium">Ask document questions</p>
            <p className="text-[10px] text-zinc-500 max-w-[180px] mt-1 leading-relaxed">
              The assistant retrieves relevant context from your vector store using semantic search.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                {/* Assistant Icon */}
                {!isUser && (
                  <div className="h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 shadow-lg">
                    <BotIcon className="text-indigo-400" size={14} />
                  </div>
                )}

                <div className="space-y-1.5 max-w-[80%] overflow-hidden">
                  <div
                    className={`p-3 rounded-xl text-xs leading-relaxed font-sans ${
                      isUser
                        ? "bg-gradient-to-br from-indigo-650 to-indigo-900 text-zinc-150 rounded-tr-none border border-indigo-700/30 shadow-[0_4px_12px_rgba(99,102,241,0.15)]"
                        : "bg-zinc-900/60 border border-zinc-850/80 text-zinc-300 rounded-tl-none"
                    }`}
                  >
                    {/* Preserve line breaks simply */}
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Semantic Source Citation chips */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-zinc-850 space-y-1.5">
                        <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-wide block">
                          Retrieved Sources
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {msg.citations.map((cite, i) => (
                            <button
                              key={i}
                              onClick={() => setInspectCitation(cite)}
                              className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-850 text-[9px] font-mono text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-all truncate max-w-[120px]"
                              title="Click to view parsed text excerpt"
                            >
                              {cite.docName} [{(cite.similarity * 100).toFixed(0)}%]
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className={`text-[8px] font-mono text-zinc-600 block ${isUser ? "text-right" : "text-left"}`}>
                    {msg.timestamp}
                  </span>
                </div>

                {/* User Icon */}
                {isUser && (
                  <div className="h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 shadow-lg">
                    <UserIcon className="text-cyan-400" size={14} />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Dynamic Typing/Generating indicator */}
        {isGenerating && (
          <div className="flex gap-3 items-start justify-start animate-pulse">
            <div className="h-7 w-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
              <BotIcon className="text-indigo-400" size={14} />
            </div>
            <div className="p-3 rounded-xl rounded-tl-none bg-zinc-900/40 border border-zinc-850/80 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Citation Inspector Popup Modal */}
      {inspectCitation && (
        <div className="absolute inset-x-0 bottom-40 z-30 mx-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-md shadow-2xl text-zinc-200 animate-slide-up">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2 select-none">
            <div className="flex items-center gap-1.5">
              <SparklesIcon className="text-cyan-400" size={12} />
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                Vector Source Inspect
              </span>
            </div>
            <button
              onClick={() => setInspectCitation(null)}
              className="text-[10px] font-mono text-rose-400 hover:underline hover:text-rose-300"
            >
              Close [X]
            </button>
          </div>
          <p className="text-[10px] font-semibold text-zinc-200 mb-1">{inspectCitation.docName}</p>
          <div className="flex items-center gap-2 mb-2 select-none">
            <span className="text-[9px] font-mono text-zinc-500">Similarity Match:</span>
            <span className="text-[9px] font-mono text-cyan-400">{(inspectCitation.similarity * 100).toFixed(1)}%</span>
          </div>
          <div className="text-[10px] leading-relaxed text-zinc-400 max-h-32 overflow-y-auto bg-zinc-950 p-2.5 rounded border border-zinc-900 font-mono italic">
            "{inspectCitation.chunkSnippet}"
          </div>
        </div>
      )}

      {/* Quick Prompts Chips */}
      {messages.length > 0 && !isGenerating && (
        <div className="px-4 py-2 border-t border-zinc-900 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setInput(prompt)}
              className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-850 hover:bg-zinc-850 text-[10px] text-zinc-400 hover:text-zinc-200 transition-all font-sans font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Prompt Form Input Area */}
      <div className="p-4 border-t border-zinc-900 space-y-2 select-none bg-zinc-950/90">
        <div className="relative flex items-end bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 focus-within:border-indigo-500/50 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI Copilot about documents..."
            rows={1}
            className="flex-1 bg-transparent text-xs text-zinc-150 placeholder-zinc-500 focus:outline-none resize-none max-h-20 leading-5 scrollbar-none font-sans"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${
              input.trim() && !isGenerating
                ? "bg-indigo-600 text-white hover:bg-indigo-500"
                : "text-zinc-600 cursor-not-allowed"
            }`}
          >
            <SendIcon size={12} />
          </button>
        </div>
        <p className="text-[8px] font-mono text-zinc-600 text-center uppercase tracking-wider">
          Offline Sandboxed AI • Content Never Leaves Local Device
        </p>
      </div>
    </div>
  );
};
