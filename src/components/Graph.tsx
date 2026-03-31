import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Node, Link } from '../types';

interface GraphProps {
  nodes: Node[];
  links: Link[];
  onNodeClick?: (node: Node) => void;
  selectedNodeId?: string | null;
}

const Graph: React.FC<GraphProps> = ({ nodes, links, onNodeClick, selectedNodeId }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !nodes || nodes.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

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
      .attr("fill", "#444")
      .style("stroke", "none");

    const simulation = d3.forceSimulation<any>(nodes)
      .force("link", d3.forceLink<any, any>(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const linkGroup = svg.append("g")
      .attr("class", "links");

    const link = linkGroup.selectAll("g")
      .data(links)
      .join("g");

    link.append("line")
      .attr("stroke", "#444")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1)
      .attr("marker-end", "url(#arrowhead)");

    link.append("text")
      .attr("fill", "#666")
      .style("font-size", "8px")
      .style("font-family", "monospace")
      .attr("text-anchor", "middle")
      .text(d => d.label || "");

    const node = svg.append("g")
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
      .attr("fill", d => {
        switch (d.type) {
          case 'target': return "#ff4444";
          case 'email': return "#44ff44";
          case 'domain': return "#4444ff";
          case 'social': return "#ffff44";
          case 'leak': return "#ff44ff";
          case 'person': return "#ffaa00";
          case 'company': return "#00ffff";
          case 'political': return "#ff00ff";
          case 'financial': return "#00ff00";
          default: return "#888";
        }
      })
      .attr("stroke", d => d.id === selectedNodeId ? "#fff" : "#fff")
      .attr("stroke-width", d => d.id === selectedNodeId ? 3 : 1.5);

    node.append("text")
      .text(d => d.label)
      .attr("x", 14)
      .attr("y", 4)
      .attr("fill", d => d.id === selectedNodeId ? "#fff" : "#eee")
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

    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  return (
    <svg 
      ref={svgRef} 
      className="w-full h-full bg-[#0a0a0a] border border-[#333] rounded-lg"
    />
  );
};

export default Graph;
