import React, { useState, useEffect } from "react";
import { Document } from "./Sidebar";
import { EditIcon, SparklesIcon, CheckIcon } from "./Icons";

interface EditorProps {
  document: Document | null;
  onUpdateDocument: (id: string, updates: Partial<Document>) => void;
  onReindex: (id: string) => void;
}

export const Editor: React.FC<EditorProps> = ({
  document,
  onUpdateDocument,
  onReindex,
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Synchronize state when the active document changes
  useEffect(() => {
    if (document) {
      setTitle(document.name);
      setContent(document.content || "");
    } else {
      setTitle("");
      setContent("");
    }
    setIsEditingTitle(false);
  }, [document?.id]); // depend specifically on document.id to avoid cursor resets during typing

  if (!document) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950/20 text-center select-none">
        <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 shadow-xl">
          <EditIcon className="text-zinc-600" size={24} />
        </div>
        <h3 className="text-sm font-semibold text-zinc-300">No active document</h3>
        <p className="text-xs text-zinc-500 max-w-sm mt-1.5 leading-relaxed">
          Select an existing file from the document catalog or upload a new one to unlock local offline indexing and editor options.
        </p>
      </div>
    );
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    onUpdateDocument(document.id, { content: val });
  };

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (title.trim() && title !== document.name) {
      onUpdateDocument(document.id, { name: title.trim() });
    } else {
      setTitle(document.name);
    }
  };

  const wordCount = (content || "").trim() ? (content || "").trim().split(/\s+/).length : 0;
  const charCount = (content || "").length;

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden text-zinc-200">
      {/* Editor Header Workspace */}
      <div className="px-6 py-4 border-b border-zinc-900 flex items-center justify-between select-none">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              autoFocus
              className="text-sm font-medium bg-zinc-900 border border-indigo-500/50 rounded px-2.5 py-1 text-zinc-100 focus:outline-none max-w-sm flex-1 font-sans"
            />
          ) : (
            <div 
              onClick={() => setIsEditingTitle(true)}
              className="flex items-center gap-2 cursor-pointer group max-w-sm overflow-hidden"
              title="Click to rename"
            >
              <h2 className="text-sm font-medium text-zinc-100 truncate group-hover:text-cyan-400 transition-colors">
                {document.name}
              </h2>
              <EditIcon className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" size={12} />
            </div>
          )}
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 uppercase">
            {document.type}
          </span>
        </div>

        {/* Index and Status Control */}
        <div className="flex items-center gap-3">
          {/* Index Button */}
          <button
            onClick={() => onReindex(document.id)}
            disabled={document.status === "indexing"}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide border transition-all ${
              document.status === "indexing"
                ? "bg-amber-950/20 border-amber-500/30 text-amber-400 cursor-not-allowed"
                : "bg-indigo-950/40 border-indigo-500/30 text-indigo-300 hover:bg-indigo-900/40 hover:text-white"
            }`}
          >
            {document.status === "indexing" ? (
              <>
                <SparklesIcon className="text-amber-400 animate-spin" size={12} />
                <span>Re-indexing Chunks...</span>
              </>
            ) : (
              <>
                <SparklesIcon className="text-indigo-400" size={12} />
                <span>Save & Embed</span>
              </>
            )}
          </button>

          {/* Inline status chip */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80">
            <div className={`h-1.5 w-1.5 rounded-full ${
              document.status === "indexed" 
                ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" 
                : document.status === "indexing" 
                ? "bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" 
                : "bg-zinc-600"
            }`} />
            <span className="text-[10px] font-mono text-zinc-400">
              {document.status === "indexed" ? "Synced" : document.status === "indexing" ? "Indexing" : "Draft"}
            </span>
          </div>
        </div>
      </div>

      {/* Statistics info bar */}
      <div className="px-6 py-2 bg-zinc-950 border-b border-zinc-900/60 flex items-center justify-between text-[10px] font-mono text-zinc-500 select-none">
        <div className="flex items-center gap-3">
          <span>Words: {wordCount}</span>
          <span>Chars: {charCount}</span>
          <span>Chunks: {document.chunksCount}</span>
        </div>
        <div>
          <span>Last modified: {document.createdAt}</span>
        </div>
      </div>

      {/* Plaintext Textarea Panel */}
      <div className="flex-1 p-6 overflow-y-auto flex bg-radial from-zinc-900/10 to-zinc-950">
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Compose markdown or paste plain text here. Ollama will index any paragraph structure automatically on save..."
          className="w-full flex-1 resize-none bg-transparent text-sm leading-7 text-zinc-300 placeholder-zinc-600 focus:outline-none font-mono scrollbar-thin"
        />
      </div>
    </div>
  );
};
