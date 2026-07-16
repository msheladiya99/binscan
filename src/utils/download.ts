import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import type { AppSettings } from '../store/useAppStore';

export const downloadPNG = (text: string, qrCanvas: HTMLCanvasElement) => {
  const url = qrCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `QR_${text}.png`;
  link.href = url;
  link.click();
};

export const downloadSVG = async (text: string, settings: AppSettings) => {
  try {
    const svgString = await QRCode.toString(text, {
      type: 'svg',
      margin: settings.margin,
      color: {
        dark: settings.fgColor,
        light: settings.bgColor
      },
      errorCorrectionLevel: settings.errorCorrection
    });
    
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `QR_${text}.svg`;
    link.href = url;
    link.click();
    
    // Cleanup
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to generate SVG:", err);
  }
};

export const downloadPDF = (text: string, qrCanvas: HTMLCanvasElement) => {
  // Create PDF in A4 format (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // Title
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(20);
  doc.text("WAREHOUSE LABEL DIRECTORY", 105, 30, { align: "center" });
  
  // Card container (110mm width x 150mm height, centered)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(50, 45, 110, 150);
  
  // Header tear-line separator
  doc.setLineDashPattern([2, 2], 0);
  doc.line(50, 58, 160, 58);
  
  // Footer tear-line separator
  doc.line(50, 180, 160, 180);
  doc.setLineDashPattern([], 0); // reset dash
  
  // Brand Header
  doc.setFontSize(10);
  doc.text("BINSCAN LABEL SYSTEM", 55, 53);
  
  // Checksum ID
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const check = Math.abs(hash).toString(36).substring(0, 5).toUpperCase();
  doc.text(`ID: ${check}`, 155, 53, { align: "right" });
  
  // QR Image insertion
  const imgData = qrCanvas.toDataURL("image/png");
  doc.addImage(imgData, "PNG", 65, 68, 80, 80);
  
  // Monospace warehouse text code display
  doc.setFont("Courier", "bold");
  doc.setFontSize(22);
  doc.text(text, 105, 165, { align: "center" });
  
  // Timestamp
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  doc.text(`GEN DATE: ${now}`, 55, 188);
  doc.text("STATUS: OK", 155, 188, { align: "right" });
  
  doc.save(`LABEL_${text}.pdf`);
};
