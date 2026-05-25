"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Sidebar, Document } from "./components/Sidebar";
import { KnowledgeGraph, GraphNode, GraphLink } from "./components/KnowledgeGraph";
import { Editor } from "./components/Editor";
import { ChatPanel, ChatMessage, Citation } from "./components/ChatPanel";
import { GraphIcon, SparklesIcon, EditIcon } from "./components/Icons";

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic">("keyword");
  const [selectedModel, setSelectedModel] = useState("Gemini 2.5 Flash (Recommended)");
  const [isGenerating, setIsGenerating] = useState(false);

  // ---- RESPONSIVENESS STATE DRAWERS ----
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<"split" | "editor" | "graph">("split");

  const availableModels = [
    "Gemini 2.5 Flash (Recommended)",
    "Gemini 2.5 Pro",
    "Gemini 3.5 Flash",
    "Claude 3.5 Sonnet (Server)"
  ];

  // Seeding initial chat history
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Welcome to **Agentic Personal RAG**! I'm powered by **Gemini Flash** and use semantic search and local ReAct agent tools to explore and manage your document library.\n\nUpload a document, click **\"Save & Embed\"** in the editor to vectorize it, and ask me anything or tell me to rewrite it!",
      timestamp: "12:30 PM",
      citations: []
    }
  ]);

  // ---- 1. FETCH LIVE DOCUMENTS ----
  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
        
        // Auto-focus the first document on load if nothing is selected
        if (data.documents.length > 0 && !activeDocumentId) {
          setActiveDocumentId(data.documents[0].id);
        }
      }
    } catch (e) {
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Document selection selector
  const activeDocument = useMemo(() => {
    return documents.find((doc) => doc.id === activeDocumentId) || null;
  }, [documents, activeDocumentId]);

  // Handle active document selection
  const handleSelectDocument = (id: string) => {
    setActiveDocumentId(id);
  };

  // ---- 2. LIVE DOCUMENT INGESTION API ----
  const handleUploadDocument = async (name: string, content: string, type: "pdf" | "md" | "txt") => {
    // Generate temp ID for listing feedback
    const tempId = `temp-${Date.now()}`;
    const sizeKB = (content.length / 1024).toFixed(1);
    const sizeStr = `${sizeKB} KB`;

    const tempDoc: Document = {
      id: tempId,
      name,
      type,
      size: sizeStr,
      chunksCount: 0,
      status: "idle",
      createdAt: "Just parsed...",
      content
    };

    setDocuments((prev) => [...prev, tempDoc]);
    setActiveDocumentId(tempId);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content, type })
      });

      if (res.ok) {
        const data = await res.json();
        // Replace temp document with real saved state
        setDocuments((prev) =>
          prev.map((d) => (d.id === tempId ? data.document : d))
        );
        setActiveDocumentId(data.document.id);

        setMessages((prev) => [
          ...prev,
          {
            id: `system-ingest-${Date.now()}`,
            sender: "assistant",
            text: `[SYSTEM COGNITIVE ALERT]: Document "${name}" has been successfully uploaded and parsed. You can now view and edit its content. Click the "Save & Embed" button in the editor when you are ready to vectorize it.`,
            timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            citations: []
          }
        ]);
      } else {
        throw new Error("Ingest endpoint failed");
      }
    } catch (e) {
      // Revert temp document status to idle
      setDocuments((prev) =>
        prev.map((d) => (d.id === tempId ? { ...d, status: "idle" } : d))
      );
    }
  };

  // ---- 3. LIVE EDITOR SAVES & TITLE EDITING ----
  const handleUpdateDocument = async (id: string, updates: Partial<Document>) => {
    // Update local react state instantly for typing fluidity
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, ...updates, status: updates.content ? "idle" as const : doc.status } : doc))
    );

    // If saving content or renaming, propagate changes via PUT request to backend
    if (updates.name !== undefined || updates.content !== undefined) {
      const targetDoc = documents.find((doc) => doc.id === id);
      if (!targetDoc) return;

      const finalName = updates.name !== undefined ? updates.name : targetDoc.name;
      const finalContent = updates.content !== undefined ? updates.content : targetDoc.content;

      try {
        await fetch("/api/documents", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name: finalName, content: finalContent, reindex: false })
        });
      } catch (err) {
      }
    }
  };

  // ---- 4. DELETE DOCUMENT AND CORRESPONDING VECTORS ----
  const handleDeleteDocument = async (id: string) => {
    if (activeDocumentId === id) {
      setActiveDocumentId(null);
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id));

    try {
      await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    } catch (e) {
    }
  };

  // ---- 5. DYNAMIC SAVE & REINDEX API ----
  const handleReindex = async (id: string) => {
    const targetDoc = documents.find((d) => d.id === id);
    if (!targetDoc) return;

    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "indexing" as const } : d))
    );

    try {
      const res = await fetch("/api/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: targetDoc.name, content: targetDoc.content, reindex: true })
      });

      if (res.ok) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status: "indexed" as const } : d))
        );
      } else {
        throw new Error();
      }
    } catch (e) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "idle" as const } : d))
      );
    }
  };

  // ---- DYNAMIC PHYSICS GRAPH NODES GENERATION ----
  const { graphNodes, graphLinks } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const colors = {
      doc1: "rgb(99, 102, 241)",   // indigo
      doc2: "rgb(6, 182, 212)",    // cyan
      doc3: "rgb(168, 85, 247)",   // purple
      newDocs: "rgb(236, 72, 153)" // pink
    };

    documents.forEach((doc, idx) => {
      const docColor = idx === 0 
        ? colors.doc1 
        : idx === 1 
        ? colors.doc2 
        : idx === 2 
        ? colors.doc3 
        : colors.newDocs;

      const docNodeId = `node-${doc.id}`;
      nodes.push({
        id: docNodeId,
        label: doc.name,
        docId: doc.id,
        type: "document",
        size: 10,
        color: docColor,
        preview: doc.content ? doc.content.slice(0, 100) + "..." : ""
      });

      if (doc.status === "indexed") {
        for (let c = 0; c < doc.chunksCount; c++) {
          const chunkId = `chunk-${doc.id}-${c}`;
          nodes.push({
            id: chunkId,
            label: `chunk #${c + 1}`,
            docId: doc.id,
            type: "chunk",
            size: 6,
            color: "rgba(103, 232, 249, 0.7)",
            preview: doc.content ? doc.content.slice(c * 200, c * 200 + 120) + "..." : ""
          });

          links.push({
            source: docNodeId,
            target: chunkId,
            value: 0.95
          });
        }
      }
    });

    // Make semantic spring links between adjacent documents to form cohesive visual web structure
    if (documents.length >= 2) {
      for (let i = 0; i < documents.length - 1; i++) {
        if (documents[i].status === "indexed" && documents[i + 1].status === "indexed") {
          links.push({
            source: `node-${documents[i].id}`,
            target: `node-${documents[i + 1].id}`,
            value: 0.5
          });
        }
      }
    }

    return { graphNodes: nodes, graphLinks: links };
  }, [documents]);

  // ---- 6. OLLAMA CHAT API INTEGRATOR WITH CHUNKS READING STREAM ----
  const handleSendMessage = async (text: string) => {
    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit"
    });

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text,
      timestamp: timeStr
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);

    try {
      const history = [...messages, userMsg];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          activeDocumentId,
          model: selectedModel
        })
      });

      if (!res.ok) {
        throw new Error("Failed to connect to local streaming service");
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("ReadableStream is offline");
      }

      const streamId = `msg-stream-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: streamId,
          sender: "assistant",
          text: "",
          timestamp: timeStr,
          citations: []
        }
      ]);
      setIsGenerating(false);

      const decoder = new TextDecoder();
      let buffer = "";
      let currentText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse metadata prefixes
          if (line.startsWith("META:")) {
            const jsonStr = line.slice(5);
            try {
              const meta = JSON.parse(jsonStr);
              if (meta.citations) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === streamId ? { ...msg, citations: meta.citations } : msg
                  )
                );
              }
              // Dynamically reload documents list if the agent updated any file content
              if (meta.documentUpdated) {
                console.log("[Client Agent Alert] Document updated by AI agent. Reloading doc list...");
                fetchDocuments();
              }
            } catch (err) {
              // Ignore partial parse
            }
          } else if (line.startsWith("TEXT:")) {
            const rawText = line.slice(5).replace(/\\n/g, "\n");
            currentText += rawText;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamId ? { ...msg, text: currentText } : msg
              )
            );
          }
        }
      }

    } catch (e: any) {
      setIsGenerating(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: "assistant",
          text: `[SYSTEM ERROR]: Fails to stream answer. Please confirm your Google Gemini API key is configured correctly in \`.env.local\` and that the dev server has access to the internet. Check server terminal logs for more details.`,
          timestamp: timeStr,
          citations: []
        }
      ]);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 font-sans text-zinc-150 relative">
      {/* LEFT SIDE COLLAPSIBLE TOGGLE HANDLE */}
      <button
        onClick={() => setIsSidebarCollapsed((prev) => !prev)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 h-20 w-3 rounded-r-lg border border-l-0 border-zinc-800 bg-zinc-900/90 text-zinc-500 hover:text-cyan-400 hover:bg-zinc-850 flex items-center justify-center cursor-pointer shadow-2xl transition-all"
        title={isSidebarCollapsed ? "Expand Sidebar Library" : "Collapse Sidebar Library"}
      >
        <span className="text-[7px] font-mono select-none">
          {isSidebarCollapsed ? "▶" : "◀"}
        </span>
      </button>

      {/* RIGHT SIDE COLLAPSIBLE TOGGLE HANDLE */}
      <button
        onClick={() => setIsChatCollapsed((prev) => !prev)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-40 h-20 w-3 rounded-l-lg border border-r-0 border-zinc-800 bg-zinc-900/90 text-zinc-500 hover:text-indigo-400 hover:bg-zinc-850 flex items-center justify-center cursor-pointer shadow-2xl transition-all"
        title={isChatCollapsed ? "Expand Ollama Chat" : "Collapse Ollama Chat"}
      >
        <span className="text-[7px] font-mono select-none">
          {isChatCollapsed ? "◀" : "▶"}
        </span>
      </button>

      {/* 1. Left Side Drawer - Library */}
      <div
        className="h-full flex shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
        style={{ width: isSidebarCollapsed ? "0px" : "320px" }}
      >
        <Sidebar
          documents={documents}
          activeDocumentId={activeDocumentId}
          onSelectDocument={handleSelectDocument}
          onUploadDocument={handleUploadDocument}
          onDeleteDocument={handleDeleteDocument}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchMode={searchMode}
          onSearchModeToggle={() => setSearchMode((m) => (m === "keyword" ? "semantic" : "keyword"))}
        />
      </div>

      {/* 2. Middle Column - Visual Workspaces (With Toggling Focus Layouts) */}
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-950 border-r border-l border-zinc-900/60 h-full">
        {/* RESPONSIVE FOCUS TAB BAR */}
        <div className="px-6 py-3 border-b border-zinc-900/80 bg-zinc-950 flex items-center justify-between select-none">
          <div className="flex items-center gap-1 bg-zinc-900/60 p-0.5 rounded-lg border border-zinc-850/80">
            <button
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold tracking-wide rounded-md transition-all uppercase ${
                viewMode === "split"
                  ? "bg-zinc-800 border border-zinc-700 text-cyan-400 shadow-md"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode("editor")}
              className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold tracking-wide rounded-md transition-all uppercase ${
                viewMode === "editor"
                  ? "bg-zinc-800 border border-zinc-700 text-indigo-400 shadow-md"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <EditIcon size={10} />
              Writer Focus
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold tracking-wide rounded-md transition-all uppercase ${
                viewMode === "graph"
                  ? "bg-zinc-800 border border-zinc-700 text-cyan-400 shadow-md"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <GraphIcon size={10} />
              Graph Focus
            </button>
          </div>
          <div className="text-[10px] font-mono text-zinc-500 tracking-wider">
            {viewMode === "editor" ? "DISTRACTION-FREE READING" : viewMode === "graph" ? "SEMANTIC OVERVIEW" : "SPLIT GRAPH/WRITER"}
          </div>
        </div>

        {/* Dynamic vertical panels stack based on focus Mode selection */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          {/* A. Knowledge Graph Panel */}
          <div
            className="flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
            style={{
              height: viewMode === "editor" ? "0px" : viewMode === "graph" ? "100%" : "50%",
            }}
          >
            <KnowledgeGraph
              nodes={graphNodes}
              links={graphLinks}
              activeDocumentId={activeDocumentId}
              onSelectDocument={handleSelectDocument}
            />
          </div>

          {/* B. Text Document Editor Panel */}
          <div
            className="flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden flex-1"
            style={{
              height: viewMode === "graph" ? "0px" : viewMode === "editor" ? "100%" : "50%",
            }}
          >
            <Editor
              document={activeDocument}
              onUpdateDocument={handleUpdateDocument}
              onReindex={handleReindex}
            />
          </div>
        </div>
      </main>

      {/* 3. Right Side Drawer - AI Assistant Copilot */}
      <div
        className="h-full flex shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
        style={{ width: isChatCollapsed ? "0px" : "320px" }}
      >
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          availableModels={availableModels}
        />
      </div>
    </div>
  );
}
