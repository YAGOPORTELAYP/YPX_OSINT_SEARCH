import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Node, Link } from '../types';
import { ZoomIn, ZoomOut, Maximize, MousePointer2, Target } from 'lucide-react';

interface GraphProps {
  nodes: Node[];
  links: Link[];
  onNodeClick?: (node: Node) => void;
  selectedNodeId?: string | null;
}

const Graph: React.FC<GraphProps> = ({ nodes, links, onNodeClick, selectedNodeId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

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
      .attr("stroke", "#00ff00")
      .attr("stroke-opacity", 0.2)
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrowhead)");

    link.append("text")
      .attr("fill", "#00ff00")
      .style("opacity", 0.5)
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
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.append("circle")
      .attr("r", d => d.id === selectedNodeId ? 12 : 8)
      .attr("fill", d => "#00ff00")
      .attr("stroke", d => d.id === selectedNodeId ? "#00ff00" : "#00ff0033")
      .attr("stroke-width", d => d.id === selectedNodeId ? 3 : 1)
      .style("filter", d => d.id === selectedNodeId ? "drop-shadow(0 0 8px #00ff00)" : "none");

    node.append("text")
      .text(d => d.label)
      .attr("x", 14)
      .attr("y", 4)
      .attr("fill", d => d.id === selectedNodeId ? "#00ff00" : "#eee")
      .style("font-size", d => d.id === selectedNodeId ? "12px" : "10px")
      .style("font-weight", d => d.id === selectedNodeId ? "bold" : "normal")
      .style("font-family", "monospace");

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
      event.subject.fx = null;
      event.subject.fy = null;
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
  }, [nodes, links, selectedNodeId]);

  const handleZoomIn = () => (svgRef.current as any)?.zoomIn?.();
  const handleZoomOut = () => (svgRef.current as any)?.zoomOut?.();
  const handleResetZoom = () => (svgRef.current as any)?.resetZoom?.();
  const handleCenterOnSelected = () => {
    if (selectedNodeId) {
      (svgRef.current as any)?.centerOnNode?.(selectedNodeId);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0a0a0a] border border-[#333] rounded-lg overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
      
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

      {/* Zoom Level Indicator */}
      <div className="absolute top-4 right-4 px-2 py-1 bg-[#1a1a1a]/80 border border-[#333] text-[#00ff00] text-[10px] font-mono rounded">
        ZOOM: {(zoomLevel * 100).toFixed(0)}%
      </div>

      <div className="absolute top-4 left-4 flex items-center gap-2 px-2 py-1 bg-[#1a1a1a]/80 border border-[#333] text-[#00ff00] text-[10px] font-mono rounded">
        <MousePointer2 size={12} />
        DRAG TO PAN / SCROLL TO ZOOM
      </div>
    </div>
  );
};

export default Graph;
