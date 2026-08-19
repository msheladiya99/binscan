import QRCode from 'qrcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

export interface BatchItem {
  id: string;
  code: string;
  type: 'CASE' | 'TEMP';
  qrData?: string;
  detectedAt: number;
}

/**
 * Generates a PNG Data URL for a given QR string payload.
 * Payload MUST be exact code string without modification.
 */
export async function generateQRDataUrl(text: string): Promise<string> {
  return await QRCode.toDataURL(text, {
    width: 500,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
}

/**
 * Downloads individual QR code as PNG file named exact code string (e.g., 4992_CASE_00501106.png).
 */
export async function downloadSingleBatchQR(code: string): Promise<void> {
  const dataUrl = await generateQRDataUrl(code);
  const link = document.createElement('a');
  link.download = `${code}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Downloads a ZIP file containing PNG files for all codes in the batch list.
 * Reports progress callback.
 */
export async function downloadBatchZIP(
  items: BatchItem[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (items.length === 0) return;

  const zip = new JSZip();
  const folder = zip.folder("QR_Codes") || zip;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (onProgress) onProgress(i + 1, items.length);

    const dataUrl = item.qrData || (await generateQRDataUrl(item.code));
    // Strip data url header to get raw base64 string
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    folder.file(`${item.code}.png`, base64Data, { base64: true });
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.download = `BINSCAN_BATCH_${items.length}_CODES.zip`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Generates a PDF containing one QR label per page.
 */
export async function downloadBatchPDF(items: BatchItem[]): Promise<void> {
  if (items.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i > 0) doc.addPage();

    const dataUrl = item.qrData || (await generateQRDataUrl(item.code));

    // Page title / brand
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text("BINSCAN WAREHOUSE BATCH LABEL", 105, 25, { align: "center" });

    // Label border container (120mm width x 160mm height)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1.2);
    doc.rect(45, 35, 120, 160);

    // Label Header: Badge Type
    doc.setFillColor(item.type === 'CASE' ? 245 : 6, item.type === 'CASE' ? 158 : 182, item.type === 'CASE' ? 11 : 212);
    doc.rect(45, 35, 120, 15, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${item.type} CODE LABEL`, 105, 45, { align: "center" });

    // Code text display
    doc.setTextColor(0, 0, 0);
    doc.setFont("Courier", "bold");
    doc.setFontSize(18);
    doc.text(item.code, 105, 65, { align: "center" });

    // Large QR image
    doc.addImage(dataUrl, "PNG", 60, 75, 90, 90);

    // Footer info
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`ITEM ${i + 1} OF ${items.length}`, 50, 182);
    doc.text("SCANNER VERIFIED", 160, 182, { align: "right" });
  }

  doc.save(`BINSCAN_BATCH_${items.length}_LABELS.pdf`);
}

/**
 * Prints all labels in printable format.
 */
export async function printBatchLabels(items: BatchItem[]): Promise<void> {
  if (items.length === 0) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Please allow popup windows to print batch labels.");
    return;
  }

  const labelHtmlPromises = items.map(async (item, idx) => {
    const dataUrl = item.qrData || (await generateQRDataUrl(item.code));
    return `
      <div class="label-card">
        <div class="label-type ${item.type.toLowerCase()}">${item.type}</div>
        <div class="code-title">${item.code}</div>
        <div class="qr-container">
          <img src="${dataUrl}" class="qr-image" alt="${item.code}" />
        </div>
        <div class="label-footer">
          <span>ITEM ${idx + 1} OF ${items.length}</span>
          <span>BINSCAN</span>
        </div>
      </div>
    `;
  });

  const labelsHtml = (await Promise.all(labelHtmlPromises)).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Batch QR Labels (${items.length})</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', Courier, monospace;
            background: #ffffff;
            color: #000000;
          }
          .label-card {
            width: 100%;
            max-width: 170mm;
            margin: 0 auto 20mm auto;
            border: 3px solid #000000;
            padding: 20px;
            box-sizing: border-box;
            text-align: center;
            page-break-after: always;
          }
          .label-card:last-child {
            page-break-after: avoid;
          }
          .label-type {
            display: inline-block;
            font-family: Arial, sans-serif;
            font-size: 16px;
            font-weight: bold;
            padding: 6px 20px;
            color: #ffffff;
            border-radius: 4px;
            margin-bottom: 15px;
            text-transform: uppercase;
          }
          .label-type.case {
            background-color: #d97706;
          }
          .label-type.temp {
            background-color: #0891b2;
          }
          .code-title {
            font-size: 26px;
            font-weight: bold;
            letter-spacing: 1px;
            margin-bottom: 15px;
            word-break: break-all;
          }
          .qr-container {
            margin: 10px 0;
          }
          .qr-image {
            width: 90mm;
            height: 90mm;
            object-fit: contain;
          }
          .label-footer {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            border-top: 2px dashed #777777;
            padding-top: 10px;
            margin-top: 10px;
            font-family: Arial, sans-serif;
          }
        </style>
      </head>
      <body>
        ${labelsHtml}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}
