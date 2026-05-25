import React, { useRef, useEffect, useState } from "react";
import { GraphIcon, SparklesIcon } from "./Icons";

export interface GraphNode {
  id: string;
  label: string;
  docId: string;
  type: "document" | "chunk";
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  size: number;
  color: string;
  preview: string;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number; // Semantic similarity score (e.g. 0.0 to 1.0)
}

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  activeDocumentId: string | null;
  onSelectDocument: (docId: string) => void;
}

// Resilient helper to convert hex, rgb, or rgba color strings to transparent colors for Canvas
function getAlphaColor(color: string, alpha: number): string {
  if (!color) return `rgba(255, 255, 255, ${alpha})`;
  if (color.startsWith("#")) {
    const clean = color.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16) || 0;
    const g = parseInt(clean.slice(2, 4), 16) || 0;
    const b = parseInt(clean.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith("rgba")) {
    return color.replace(/[\d\.]+\)$/, `${alpha})`);
  }
  if (color.startsWith("rgb")) {
    return color.replace("rgb", "rgba").replace(")", `, ${alpha})`);
  }
  return color;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  nodes: initialNodes,
  links: initialLinks,
  activeDocumentId,
  onSelectDocument,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Simulation state stored in refs to avoid React re-render lags
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const activeDocIdRef = useRef<string | null>(null);

  // Interactive offsets (Pan & Zoom)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);

  // Mouse Interaction Refs
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const hoveredNodeRef = useRef<GraphNode | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    node: GraphNode;
  } | null>(null);

  // Track dynamic animation phases (e.g. particle pulse cycles)
  const animTimeRef = useRef(0);

  // Sync refs with props
  useEffect(() => {
    // Retain coordinates if matching ids exist to avoid layout resetting
    const existingMap = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    nodesRef.current.forEach((n) => {
      if (n.x !== undefined && n.y !== undefined) {
        existingMap.set(n.id, { x: n.x, y: n.y, vx: n.vx || 0, vy: n.vy || 0 });
      }
    });

    const newNodes = initialNodes.map((n) => {
      const existing = existingMap.get(n.id);
      return {
        ...n,
        x: existing ? existing.x : Math.random() * 400 + 100,
        y: existing ? existing.y : Math.random() * 250 + 100,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0,
      };
    });

    nodesRef.current = newNodes;
    linksRef.current = initialLinks;
  }, [initialNodes, initialLinks]);

  useEffect(() => {
    activeDocIdRef.current = activeDocumentId;
  }, [activeDocumentId]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      // Center the graph nodes on initialization
      if (panRef.current.x === 0 && panRef.current.y === 0) {
        panRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
        setPan({ ...panRef.current });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Pan & Zoom Refs Synchronization
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Main Canvas Physics & Animation Loop
  useEffect(() => {
    let animFrameId: number;

    const tick = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        animFrameId = requestAnimationFrame(tick);
        return;
      }

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const pan = panRef.current;
      const zoom = zoomRef.current;
      const activeDocId = activeDocIdRef.current;

      animTimeRef.current += 0.05;

      // ---- 1. PHYSICS SIMULATION SYSTEM ----
      const kRepulsion = 120; // Repelling force between all nodes
      const kGravity = 0.025; // Pull force towards coordinate center (0,0)
      const kSpring = 0.05;   // Attraction along linkages
      const damping = 0.85;   // Velocity decay rate

      // Apply standard repulsion forces between all nodes
      for (let i = 0; i < nodes.length; i++) {
        const u = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const v = nodes[j];
          const dx = (u.x || 0) - (v.x || 0);
          const dy = (u.y || 0) - (v.y || 0);
          const distSq = dx * dx + dy * dy + 0.1;
          const dist = Math.sqrt(distSq);

          if (dist < 280) {
            // Strong inverse force
            const force = kRepulsion / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            u.vx = (u.vx || 0) + fx;
            u.vy = (u.vy || 0) + fy;
            v.vx = (v.vx || 0) - fx;
            v.vy = (v.vy || 0) - fy;
          }
        }
      }

      // Apply spring attraction forces between links
      links.forEach((link) => {
        const sourceNode = nodes.find((n) => n.id === link.source);
        const targetNode = nodes.find((n) => n.id === link.target);
        if (!sourceNode || !targetNode) return;

        const dx = (targetNode.x || 0) - (sourceNode.x || 0);
        const dy = (targetNode.y || 0) - (sourceNode.y || 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const restLength = 120; // Ideal distance apart
        const delta = dist - restLength;

        // Hooke's Law: F = -k * delta
        const force = kSpring * delta * link.value;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        sourceNode.vx = (sourceNode.vx || 0) + fx;
        sourceNode.vy = (sourceNode.vy || 0) + fy;
        targetNode.vx = (targetNode.vx || 0) - fx;
        targetNode.vy = (targetNode.vy || 0) - fy;
      });

      // Apply center gravity forces and update positions
      nodes.forEach((node) => {
        if (node === draggedNodeRef.current) return; // Keep dragged node stationary

        // Gravitate to origin (0,0)
        const gx = -(node.x || 0) * kGravity;
        const gy = -(node.y || 0) * kGravity;

        node.vx = (node.vx || 0) + gx;
        node.vy = (node.vy || 0) + gy;

        // Apply friction/decay and update
        node.vx *= damping;
        node.vy *= damping;

        node.x = (node.x || 0) + (node.vx || 0);
        node.y = (node.y || 0) + (node.vy || 0);
      });

      // ---- 2. RENDERING SYSTEM ----
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // Apply offset matrices for Pan and Zoom
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Draw linkage lines (Semantic Links)
      links.forEach((link) => {
        const sourceNode = nodes.find((n) => n.id === link.source);
        const targetNode = nodes.find((n) => n.id === link.target);
        if (!sourceNode || !targetNode) return;

        const x1 = sourceNode.x || 0;
        const y1 = sourceNode.y || 0;
        const x2 = targetNode.x || 0;
        const y2 = targetNode.y || 0;

        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, getAlphaColor(sourceNode.color, 0.13));
        gradient.addColorStop(0.5, "rgba(99, 102, 241, 0.15)");
        gradient.addColorStop(1, getAlphaColor(targetNode.color, 0.13));

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Premium particle animation moving along the link
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 10) {
          // Calculate animated scroll offset along the spring line
          const speedMultiplier = 1.5;
          const t = (animTimeRef.current * speedMultiplier) % 1;
          const px = x1 + dx * t;
          const py = y1 + dy * t;

          // Glowing flow particle
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(103, 232, 249, 0.8)"; // bright cyan particles
          ctx.shadowBlur = 10;
          ctx.shadowColor = "rgba(103, 232, 249, 1)";
          ctx.fill();
          ctx.shadowBlur = 0; // Reset shadow
        }
      });

      // Draw node spheres & tags
      nodes.forEach((node) => {
        const x = node.x || 0;
        const y = node.y || 0;
        const isDocActive = node.docId === activeDocId;
        const isHovered = hoveredNodeRef.current?.id === node.id;

        // Glow ring for hovered or active document nodes
        if (isDocActive || isHovered) {
          ctx.beginPath();
          ctx.arc(x, y, node.size + (isHovered ? 8 : 4), 0, Math.PI * 2);
          ctx.fillStyle = getAlphaColor(node.color, 0.08);
          ctx.strokeStyle = getAlphaColor(node.color, 0.25);
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();

          // Animated pulsating halo
          const pulse = Math.sin(animTimeRef.current * 1.5) * 3 + 6;
          ctx.beginPath();
          ctx.arc(x, y, node.size + pulse, 0, Math.PI * 2);
          ctx.strokeStyle = getAlphaColor(node.color, 0.12);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Draw core node circle
        ctx.beginPath();
        ctx.arc(x, y, node.size, 0, Math.PI * 2);

        // Core Gradient Fill
        const gradient = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, node.size);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.2, node.color);
        gradient.addColorStop(1, "#0a0a0a");

        ctx.fillStyle = gradient;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = isDocActive || isHovered ? 12 : 3;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadows

        // Label Tag
        ctx.fillStyle = isDocActive ? "#ffffff" : isHovered ? "#e4e4e7" : "#a1a1aa";
        ctx.font = isDocActive ? "bold 10px sans-serif" : "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.label, x, y + node.size + 14);

        // Sub-text showing chunk node type vs document node
        if (isHovered) {
          ctx.fillStyle = "rgba(161, 161, 170, 0.7)";
          ctx.font = "8px monospace";
          ctx.fillText(node.type.toUpperCase(), x, y + node.size + 24);
        }
      });

      ctx.restore();

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameId);
  }, []);

  // ---- 3. INTERACTION MATH & EVENTS ----

  // Translate screen space coordinates back to canvas space coordinates (accounting for Zoom & Pan)
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    return {
      x: (clientX - panRef.current.x) / zoomRef.current,
      y: (clientY - panRef.current.y) / zoomRef.current,
      clientX: e.clientX,
      clientY: e.clientY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const nodes = nodesRef.current;

    // Detect click collision with nodes
    let clickedNode: GraphNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = coords.x - (node.x || 0);
      const dy = coords.y - (node.y || 0);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < node.size + 8) {
        clickedNode = node;
        break;
      }
    }

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      onSelectDocument(clickedNode.docId);
      setTooltip(null);
    } else {
      // Start global panning
      draggedNodeRef.current = null;
      (canvasRef.current as any).isPanning = true;
      (canvasRef.current as any).startPan = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle physics node dragging
    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = coords.x;
      draggedNodeRef.current.y = coords.y;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      setTooltip(null);
      return;
    }

    // Handle global viewport panning
    if ((canvas as any).isPanning) {
      const start = (canvas as any).startPan;
      setPan({
        x: e.clientX - start.x,
        y: e.clientY - start.y,
      });
      return;
    }

    // Handle hover inspections & tooltips
    const nodes = nodesRef.current;
    let foundHover: GraphNode | null = null;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = coords.x - (node.x || 0);
      const dy = coords.y - (node.y || 0);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < node.size + 8) {
        foundHover = node;
        break;
      }
    }

    hoveredNodeRef.current = foundHover;

    if (foundHover) {
      canvas.style.cursor = "pointer";
      // Position floating HTML tooltip relative to the wrapper element
      const wrapperRect = containerRef.current?.getBoundingClientRect();
      if (wrapperRect) {
        setTooltip({
          x: e.clientX - wrapperRect.left,
          y: e.clientY - wrapperRect.top - 100,
          node: foundHover,
        });
      }
    } else {
      canvas.style.cursor = "grab";
      setTooltip(null);
    }
  };

  const handleMouseUp = () => {
    draggedNodeRef.current = null;
    if (canvasRef.current) {
      (canvasRef.current as any).isPanning = false;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = 1.05;
    const nextZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    // Bind zoom boundaries
    setZoom(Math.max(0.4, Math.min(2.5, nextZoom)));
  };

  const resetViewport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setZoom(1);
    setPan({ x: canvas.width / 2, y: canvas.height / 2 });
  };

  return (
    <div 
      ref={containerRef} 
      className="relative flex-1 bg-zinc-950 border-b border-zinc-900 overflow-hidden"
    >
      {/* Header Utilities */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 select-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md">
          <GraphIcon className="text-indigo-400" size={12} />
          <span className="text-[10px] font-semibold tracking-wider text-zinc-300 uppercase font-mono">
            Interactive Semantic Knowledge Graph
          </span>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 select-none">
        <button
          onClick={resetViewport}
          className="px-2.5 py-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800/80 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 transition-all backdrop-blur-md"
        >
          Reset View (100%)
        </button>
      </div>

      {/* HTML Interactive Tooltip Overlay */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none p-3 max-w-[280px] rounded-xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-md shadow-2xl text-zinc-200 animate-fade-in"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div 
              className="h-2.5 w-2.5 rounded-full shadow-lg" 
              style={{ 
                backgroundColor: tooltip.node.color, 
                boxShadow: `0 0 8px ${tooltip.node.color}` 
              }} 
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              {tooltip.node.type} node
            </span>
          </div>
          <h4 className="text-xs font-semibold text-zinc-100 truncate mb-1">
            {tooltip.node.label}
          </h4>
          <p className="text-[10px] text-zinc-400 line-clamp-3 leading-relaxed font-sans italic bg-zinc-950/40 p-2 rounded border border-zinc-900">
            "{tooltip.node.preview}"
          </p>
        </div>
      )}

      {/* Simulation Drawing Board */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full block cursor-grab active:cursor-grabbing bg-radial from-zinc-900/30 to-zinc-950"
      />

      {/* Graphic Controls Overlay */}
      <div className="absolute bottom-4 right-4 z-10 pointer-events-none flex items-center gap-4 bg-zinc-900/30 border border-zinc-850 px-3 py-1.5 rounded-lg text-[9px] font-mono text-zinc-500 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          <span>Documents</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span>Semantic Chunks</span>
        </div>
        <span>• Drag Nodes • Wheel to Zoom • Drag to Pan</span>
      </div>
    </div>
  );
};
