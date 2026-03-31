import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { IntelligenceData } from '../types';

export const downloadAsPDF = (data: IntelligenceData) => {
  const doc = new jsPDF();
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFontSize(20);
  doc.text('NEXUS INTELLIGENCE DOSSIER', margin, 20);
  
  doc.setFontSize(12);
  doc.text(`Target: ${data.nodes.find(n => n.type === 'target')?.label || 'Unknown'}`, margin, 30);
  
  doc.setFontSize(14);
  doc.text('Intelligence Report', margin, 45);
  
  doc.setFontSize(10);
  const splitText = doc.splitTextToSize(data.report.replace(/#/g, ''), pageWidth - 2 * margin);
  doc.text(splitText, margin, 55);
  
  // Add Sources
  let y = 55 + (splitText.length * 5) + 10;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  
  doc.setFontSize(14);
  doc.text('Sources', margin, y);
  y += 10;
  doc.setFontSize(8);
  data.sources.forEach(source => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(`${source.title}: ${source.uri}`, margin, y);
    y += 5;
  });

  doc.save('nexus_intelligence_dossier.pdf');
};

export const downloadAsWord = async (data: IntelligenceData) => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "NEXUS INTELLIGENCE DOSSIER",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Target: ${data.nodes.find(n => n.type === 'target')?.label || 'Unknown'}`,
              bold: true,
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Intelligence Report",
          heading: HeadingLevel.HEADING_2,
        }),
        ...data.report.split('\n').map(line => new Paragraph({ text: line })),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Sources",
          heading: HeadingLevel.HEADING_2,
        }),
        ...data.sources.map(source => new Paragraph({
          text: `${source.title}: ${source.uri}`,
        })),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "nexus_intelligence_dossier.docx");
};

export const downloadAsExcel = (data: IntelligenceData) => {
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Report
  const reportData = [
    ["NEXUS INTELLIGENCE DOSSIER"],
    ["Target", data.nodes.find(n => n.type === 'target')?.label || 'Unknown'],
    [""],
    ["Report Content"],
    [data.report]
  ];
  const wsReport = XLSX.utils.aoa_to_sheet(reportData);
  XLSX.utils.book_append_sheet(wb, wsReport, "Report");

  // Sheet 2: Nodes
  const wsNodes = XLSX.utils.json_to_sheet(data.nodes);
  XLSX.utils.book_append_sheet(wb, wsNodes, "Graph Nodes");

  // Sheet 3: Links
  const wsLinks = XLSX.utils.json_to_sheet(data.links);
  XLSX.utils.book_append_sheet(wb, wsLinks, "Graph Links");

  // Sheet 4: Sources
  const wsSources = XLSX.utils.json_to_sheet(data.sources);
  XLSX.utils.book_append_sheet(wb, wsSources, "Sources");

  XLSX.writeFile(wb, "nexus_intelligence_dossier.xlsx");
};
