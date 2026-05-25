import React, { useRef, useState } from "react";
import { 
  SearchIcon, 
  FileTextIcon, 
  UploadIcon, 
  TrashIcon, 
  SparklesIcon, 
  CheckIcon 
} from "./Icons";

export interface Document {
  id: string;
  name: string;
  type: "pdf" | "md" | "txt";
  size: string;
  chunksCount: number;
  status: "indexed" | "indexing" | "idle";
  content: string;
  createdAt: string;
}

interface SidebarProps {
  documents: Document[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onUploadDocument: (name: string, content: string, type: "pdf" | "md" | "txt") => void;
  onDeleteDocument: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchMode: "keyword" | "semantic";
  onSearchModeToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  documents,
  activeDocumentId,
  onSelectDocument,
  onUploadDocument,
  onDeleteDocument,
  searchQuery,
  onSearchChange,
  searchMode,
  onSearchModeToggle,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingName, setUploadingName] = useState<string>("");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "txt", "md"].includes(extension || "")) {
      alert("Please upload a PDF, TXT, or MD file.");
      return;
    }

    setUploadingName(file.name);
    setUploadProgress(0);

    // Simulate clean, fluid upload and local chunking/indexing progress bar
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          // Read local content or supply dummy text
          const reader = new FileReader();
          reader.onload = (e) => {
            const fileContent = (e.target?.result as string) || "";
            onUploadDocument(
              file.name,
              fileContent,
              (extension === "pdf" ? "pdf" : extension === "md" ? "md" : "txt") as "pdf" | "md" | "txt"
            );
            setUploadProgress(null);
            setUploadingName("");
          };
          if (extension === "pdf") {
            reader.readAsDataURL(file);
          } else {
            reader.readAsText(file);
          }
        }, 300);
      }
    }, 120);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-80 flex flex-col border-r border-zinc-800 bg-zinc-950/80 backdrop-blur-md select-none text-zinc-200">
      {/* Brand Header */}
      <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-zinc-950">
              <SparklesIcon className="text-cyan-400 animate-pulse" size={18} />
            </div>
          </div>
          <div>
            <h1 className="font-semibold text-zinc-100 tracking-wide text-sm">MyPersonalAI</h1>
            <span className="text-[10px] text-zinc-500 font-mono tracking-wider">Gemini Powered</span>
          </div>
        </div>
        <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse" title="System Local & Ready" />
      </div>

      {/* Dual Vector/Keyword Search Bar */}
      <div className="p-4 border-b border-zinc-900 space-y-3">
        <div className="relative">
          <input
            type="text"
            placeholder={searchMode === "semantic" ? "Semantic vector query..." : "Filter documents..."}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg bg-zinc-900/50 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-sans"
          />
          <SearchIcon className="absolute left-3.5 top-2.5 text-zinc-500" size={14} />
        </div>

        <button
          onClick={onSearchModeToggle}
          className={`w-full flex items-center justify-center gap-2 py-1.5 rounded-md text-[11px] font-medium border transition-all ${
            searchMode === "semantic"
              ? "bg-indigo-950/40 text-cyan-400 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.1)]"
              : "bg-zinc-900/30 text-zinc-400 border-zinc-800/80 hover:bg-zinc-900/60"
          }`}
        >
          <SparklesIcon className={searchMode === "semantic" ? "text-cyan-400" : "text-zinc-500"} size={12} />
          <span>Search Engine: {searchMode === "semantic" ? "Semantic Vector" : "Keyword Filter"}</span>
        </button>
      </div>

      {/* Document Ingestion Zone */}
      <div className="p-4 border-b border-zinc-900">
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            isDragActive 
              ? "border-cyan-500 bg-cyan-950/10 text-zinc-100" 
              : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/20 hover:bg-zinc-900/40 text-zinc-400"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            className="hidden"
            accept=".pdf,.txt,.md"
          />
          <UploadIcon className={`${isDragActive ? "text-cyan-400 scale-110" : "text-zinc-500"} transition-all duration-300 mb-2`} size={18} />
          <p className="text-[11px] font-medium">Drag & drop document here</p>
          <p className="text-[9px] text-zinc-500 mt-1">Supports PDF, MD, TXT (Offline Parse)</p>

          {/* Loader Overlay */}
          {uploadProgress !== null && (
            <div className="absolute inset-0 bg-zinc-950/90 rounded-xl flex flex-col items-center justify-center p-3">
              <span className="text-[10px] font-mono text-cyan-400 animate-pulse mb-1">
                Uploading & Parsing...
              </span>
              <span className="text-[9px] text-zinc-500 max-w-[180px] truncate mb-2">{uploadingName}</span>
              <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-150" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-zinc-400 mt-1">{uploadProgress}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Document Library List */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 scrollbar-thin">
        <h3 className="px-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 font-mono">
          Documents ({filteredDocs.length})
        </h3>
        
        {filteredDocs.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs">
            No local documents found
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isActive = doc.id === activeDocumentId;
            return (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  isActive
                    ? "bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    : "border border-transparent hover:bg-zinc-900/40 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {/* Active left indicator glow */}
                {isActive && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-cyan-400" />
                )}

                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`p-2 rounded-lg ${isActive ? "bg-zinc-950 text-indigo-400" : "bg-zinc-900/50 group-hover:bg-zinc-900"}`}>
                    <FileTextIcon size={14} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium truncate pr-2">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-mono text-zinc-500 uppercase">{doc.type}</span>
                      <span className="text-[9px] font-mono text-zinc-500">•</span>
                      <span className="text-[9px] font-mono text-zinc-500">{doc.size}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 z-10">
                  {/* Status Indicator */}
                  {doc.status === "indexed" && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-950/30" title="Indexed & Embedded">
                      <CheckIcon className="text-emerald-500" size={10} />
                    </div>
                  )}
                  {doc.status === "indexing" && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-950/30 animate-spin" title="Embedding chunks...">
                      <SparklesIcon className="text-amber-400" size={10} />
                    </div>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDocument(doc.id);
                    }}
                    className="p-1 rounded-md text-zinc-600 hover:text-rose-400 hover:bg-rose-950/20 transition-all opacity-0 group-hover:opacity-100"
                    title="Remove Document"
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
