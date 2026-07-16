export const printLabel = (text: string, qrCanvas: HTMLCanvasElement) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Please enable popups in browser configurations to print location labels.");
    return;
  }
  
  const imgUrl = qrCanvas.toDataURL("image/png");
  
  // Calculate checksum ID
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const check = Math.abs(hash).toString(36).substring(0, 5).toUpperCase();
  const dateStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Label - ${text}</title>
        <style>
          @page {
            size: auto;
            margin: 0mm;
          }
          body {
            margin: 0;
            padding: 10px;
            font-family: 'Courier New', Courier, monospace;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 98vh;
            background: #ffffff;
            color: #000000;
          }
          .label-sticker {
            width: 90mm;
            height: 130mm;
            border: 3px solid #000000;
            padding: 15px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sticker-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 2px solid #000000;
            padding-bottom: 5px;
            font-size: 11px;
            font-weight: bold;
          }
          .sticker-body {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-grow: 1;
            padding: 10px 0;
          }
          .qr-img {
            width: 70mm;
            height: 70mm;
            object-fit: contain;
          }
          .sticker-footer {
            text-align: center;
          }
          .code-text {
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 1px;
            margin-bottom: 8px;
            word-break: break-all;
          }
          .meta {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            border-top: 1px solid #777777;
            padding-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="label-sticker">
          <div class="sticker-header">
            <span>BINSCAN LABEL SYSTEM</span>
            <span>ID: ${check}</span>
          </div>
          <div class="sticker-body">
            <img src="${imgUrl}" class="qr-img" />
          </div>
          <div class="sticker-footer">
            <div class="code-text">${text}</div>
            <div class="meta">
              <span>GEN DATE: ${dateStr}</span>
              <span>STATUS: OK</span>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
