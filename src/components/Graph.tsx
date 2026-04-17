import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Node, Link } from '../types';
import { ZoomIn, ZoomOut, Maximize, MousePointer2, Target, RefreshCw, Search } from 'lucide-react';

interface GraphProps {
  nodes: Node[];
  links: Link[];
  onNodeClick?: (node: Node) => void;
  onNodeDragEnd?: (nodes: Node[]) => void;
  selectedNodeId?: string | null;
}

const Graph: React.FC<GraphProps> = ({ nodes, links, onNodeClick, onNodeDragEnd, selectedNodeId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const typeColors: Record<string, string> = {
    target: "#00ff00",
    email: "#00ffff",
    domain: "#ffff00",
    social: "#ff00ff",
    leak: "#ff0000",
    public_data: "#ffffff",
    person: "#00ff00",
    company: "#3366ff",
    political: "#ff9900",
    financial: "#00cc66"
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !nodes || nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Create a main group for all graph elements to apply zoom/pan
    const g = svg.append("g");

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);

    // Define arrow markers for links
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("xoverflow", "visible")
      .append("svg:path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "#00ff00")
      .style("stroke", "none");

    // Create patterns for node images
    const defs = svg.select("defs");
    nodes.forEach(n => {
      if (n.imageUrl) {
        defs.append("pattern")
          .attr("id", `pattern-${n.id.replace(/[^a-zA-Z0-9]/g, '-')}`)
          .attr("width", 1)
          .attr("height", 1)
          .attr("patternUnits", "objectBoundingBox")
          .append("image")
          .attr("href", n.imageUrl)
          .attr("width", 24)
          .attr("height", 24)
          .attr("preserveAspectRatio", "xMidYMid slice");
      }
    });

    const simulation = d3.forceSimulation<any>(nodes)
      .force("link", d3.forceLink<any, any>(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const linkGroup = g.append("g")
      .attr("class", "links");

    const link = linkGroup.selectAll("g")
      .data(links)
      .join("g");

    link.append("line")
      .attr("stroke", d => {
        const isHighlighted = hoveredNodeId === (d.source.id || d.source) || hoveredNodeId === (d.target.id || d.target);
        return isHighlighted ? "#00ff00" : "#00ff0033";
      })
      .attr("stroke-opacity", d => {
        const isHighlighted = hoveredNodeId === (d.source.id || d.source) || hoveredNodeId === (d.target.id || d.target);
        return isHighlighted ? 0.8 : 0.2;
      })
      .attr("stroke-width", d => {
        const isHighlighted = hoveredNodeId === (d.source.id || d.source) || hoveredNodeId === (d.target.id || d.target);
        return isHighlighted ? 2 : 1;
      })
      .attr("marker-end", "url(#arrowhead)");

    link.append("text")
      .attr("fill", "#00ff00")
      .style("opacity", d => {
        const isHighlighted = hoveredNodeId === (d.source.id || d.source) || hoveredNodeId === (d.target.id || d.target);
        return isHighlighted ? 1 : 0.3;
      })
      .style("font-size", "8px")
      .style("font-family", "monospace")
      .attr("text-anchor", "middle")
      .text(d => d.label || "");

    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        if (onNodeClick) onNodeClick(d);
      })
      .on("mouseenter", (event, d) => {
        setHoveredNodeId(d.id);
      })
      .on("mouseleave", () => {
        setHoveredNodeId(null);
      })
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.append("circle")
      .attr("r", d => {
        const isSelected = d.id === selectedNodeId;
        const isHovered = d.id === hoveredNodeId;
        const isNeighbor = links.some(l => 
          (l.source.id === hoveredNodeId && l.target.id === d.id) || 
          (l.target.id === hoveredNodeId && l.source.id === d.id)
        );
        return isSelected || isHovered ? 14 : isNeighbor ? 10 : 8;
      })
      .attr("fill", d => d.imageUrl ? `url(#pattern-${d.id.replace(/[^a-zA-Z0-9]/g, '-')})` : (typeColors[d.type] || "#00ff00"))
      .attr("stroke", d => {
        const isSelected = d.id === selectedNodeId;
        const isHovered = d.id === hoveredNodeId;
        return isSelected || isHovered ? "#00ff00" : (typeColors[d.type] || "#00ff00") + "66";
      })
      .attr("stroke-width", d => d.id === selectedNodeId || d.id === hoveredNodeId ? 3 : 1)
      .style("filter", d => d.id === selectedNodeId || d.id === hoveredNodeId ? "drop-shadow(0 0 8px #00ff00)" : "none");

    node.append("text")
      .text(d => d.label)
      .attr("x", 18)
      .attr("y", 4)
      .attr("fill", d => {
        const isSelected = d.id === selectedNodeId;
        const isHovered = d.id === hoveredNodeId;
        const isNeighbor = links.some(l => 
          (l.source.id === hoveredNodeId && l.target.id === d.id) || 
          (l.target.id === hoveredNodeId && l.source.id === d.id)
        );
        return isSelected || isHovered ? "#00ff00" : isNeighbor ? "#eee" : "#666";
      })
      .style("font-size", d => d.id === selectedNodeId || d.id === hoveredNodeId ? "14px" : "10px")
      .style("font-weight", d => d.id === selectedNodeId || d.id === hoveredNodeId ? "bold" : "normal")
      .style("font-family", "monospace")
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      link.selectAll("line")
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      link.selectAll("text")
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2 - 5);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      // Keep fx and fy to persist position
      event.subject.fx = event.x;
      event.subject.fy = event.y;
      
      if (onNodeDragEnd) {
        // Return updated nodes with their current positions
        onNodeDragEnd(nodes.map(n => ({
          ...n,
          x: n.x,
          y: n.y,
          fx: n.fx,
          fy: n.fy
        })));
      }
    }

    // Expose zoom controls
    (svgRef.current as any).zoomIn = () => svg.transition().call(zoom.scaleBy, 1.5);
    (svgRef.current as any).zoomOut = () => svg.transition().call(zoom.scaleBy, 0.75);
    (svgRef.current as any).resetZoom = () => svg.transition().call(zoom.transform, d3.zoomIdentity);
    (svgRef.current as any).centerOnNode = (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (node && (node as any).x !== undefined) {
        const transform = d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(1.5)
          .translate(-(node as any).x, -(node as any).y);
        svg.transition().duration(750).call(zoom.transform, transform);
      }
    };

    return () => {
      simulation.stop();
    };
  }, [nodes, links, selectedNodeId, hoveredNodeId]);

  const handleZoomIn = () => (svgRef.current as any)?.zoomIn?.();
  const handleZoomOut = () => (svgRef.current as any)?.zoomOut?.();
  const handleResetZoom = () => (svgRef.current as any)?.resetZoom?.();
  const handleResetLayout = () => {
    if (onNodeDragEnd) {
      onNodeDragEnd(nodes.map(n => ({
        ...n,
        fx: null,
        fy: null
      })));
    }
  };
  const handleCenterOnSelected = () => {
    if (selectedNodeId) {
      (svgRef.current as any)?.centerOnNode?.(selectedNodeId);
    }
  };

  const filteredNodes = nodes.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
      
      {/* Search Overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a]/90 border border-[#333] rounded-lg focus-within:border-[#00ff00] transition-all">
          <Search size={14} className="text-[#666]" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="FIND ENTITY..."
            className="bg-transparent border-none outline-none text-[10px] text-[#eee] w-32 md:w-48 font-mono placeholder:text-[#333]"
          />
        </div>
        
        {searchQuery && filteredNodes.length > 0 && (
          <div className="bg-[#1a1a1a]/95 border border-[#333] rounded-lg max-h-48 overflow-y-auto custom-scrollbar">
            {filteredNodes.map(n => (
              <div 
                key={n.id}
                onClick={() => {
                  if (onNodeClick) onNodeClick(n);
                  (svgRef.current as any)?.centerOnNode?.(n.id);
                  setSearchQuery('');
                }}
                className="p-2 text-[10px] text-[#eee] hover:bg-[#00ff00]/10 hover:text-[#00ff00] cursor-pointer border-b border-[#222] last:border-0 font-mono"
              >
                [{n.type.toUpperCase()}] {n.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button 
          onClick={handleZoomIn}
          className="p-2 bg-[#1a1a1a] border border-[#333] text-[#00ff00] rounded hover:bg-[#222] transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button 
          onClick={handleZoomOut}
          className="p-2 bg-[#1a1a1a] border border-[#333] text-[#00ff00] rounded hover:bg-[#222] transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <button 
          onClick={handleResetZoom}
          className="p-2 bg-[#1a1a1a] border border-[#333] text-[#00ff00] rounded hover:bg-[#222] transition-colors"
          title="Reset View"
        >
          <Maximize size={18} />
        </button>
        <button 
          onClick={handleResetLayout}
          className="p-2 bg-[#1a1a1a] border border-[#333] text-[#00ff00] rounded hover:bg-[#222] transition-colors"
          title="Reset Layout"
        >
          <RefreshCw size={18} />
        </button>
        {selectedNodeId && (
          <button 
            onClick={handleCenterOnSelected}
            className="p-2 bg-[#1a1a1a] border border-[#333] text-[#00ff00] rounded hover:bg-[#222] transition-colors"
            title="Center on Selected"
          >
            <Target size={18} />
          </button>
        )}
      </div>

      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <div className="px-2 py-1 bg-[#1a1a1a]/80 border border-[#333] text-[#00ff00] text-[10px] font-mono rounded">
          ZOOM: {(zoomLevel * 100).toFixed(0)}%
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-[#1a1a1a]/80 border border-[#333] text-[#00ff00] text-[10px] font-mono rounded">
          <MousePointer2 size={12} />
          DRAG TO PAN / SCROLL TO ZOOM
        </div>
      </div>
    </div>
  );
};

export default Graph;
