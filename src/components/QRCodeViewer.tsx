import React from 'react';
import { Download, Copy, Printer, Maximize2, Minimize2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { downloadPNG, downloadSVG, downloadPDF } from '../utils/download';
import { printLabel } from '../utils/print';

interface QRCodeViewerProps {
  onShowToast: (msg: string) => void;
}

export default function QRCodeViewer({ onShowToast }: QRCodeViewerProps) {
  const { activeCode, settings } = useAppStore();
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Render QR code dynamically based on activeCode or settings
  React.useEffect(() => {
    if (!activeCode) return;
    
    const canvas = canvasRef.current;
    if (canvas) {
      import('qrcode').then((QRCode) => {
        QRCode.default.toCanvas(canvas, activeCode, {
          width: settings.qrSize,
          margin: settings.margin,
          color: {
            dark: settings.fgColor,
            light: settings.bgColor
          },
          errorCorrectionLevel: settings.errorCorrection
        }, (err) => {
          if (err) console.error("QR Code canvas generation failed:", err);
        });
      });
    }
  }, [activeCode, settings]);

  const handleCopyText = () => {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode)
      .then(() => onShowToast("Code text copied to clipboard!"))
      .catch(() => onShowToast("Failed to copy code."));
  };

  const handlePrint = () => {
    if (!activeCode || !canvasRef.current) return;
    printLabel(activeCode, canvasRef.current);
  };

  const handleDownload = () => {
    if (!activeCode || !canvasRef.current) return;
    const format = settings.downloadFormat;
    if (format === 'png') {
      downloadPNG(activeCode, canvasRef.current);
      onShowToast("PNG Download started!");
    } else if (format === 'svg') {
      downloadSVG(activeCode, settings);
      onShowToast("SVG Download started!");
    } else if (format === 'pdf') {
      downloadPDF(activeCode, canvasRef.current);
      onShowToast("PDF Download started!");
    }
  };

  // Determine checksum value
  const checksum = React.useMemo(() => {
    if (!activeCode) return 'AWAITING';
    let hash = 0;
    for (let i = 0; i < activeCode.length; i++) {
      hash = activeCode.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash).toString(36).substring(0, 5).toUpperCase();
  }, [activeCode]);

  // Determine timestamp value
  const nowFormatted = React.useMemo(() => {
    if (!activeCode) return 'YYYY-MM-DD HH:MM';
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }, [activeCode]);

  return (
    <div className="flex flex-col gap-5 h-full">
      <h2 className="text-xs font-mono font-bold text-warehouse-muted border-l-2 border-accent-amber pl-2 tracking-wider">
        QR CODE OUTPUT LABEL
      </h2>

      {/* Label Sticker Panel */}
      <div className="flex-grow flex items-center justify-center p-6 bg-warehouse-panel border border-warehouse-border rounded-xl min-h-[340px] relative overflow-hidden">
        {activeCode ? (
          <div 
            id="label-sticker" 
            className="w-full max-w-[285px] bg-[#fdfdfd] text-[#0a0a0a] border-4 border-[#0a0a0a] rounded-sm p-4 shadow-2xl flex flex-col gap-3.5 relative font-mono animate-sticker-appear"
          >
            {/* Top Cut Dotted Edge */}
            <div className="absolute top-[-4px] left-0 right-0 h-[4px] bg-[linear-gradient(to_right,#0a0a0a_50%,transparent_50%)] bg-[length:8px_100%] bg-repeat-x"></div>
            
            {/* Card Header details */}
            <div className="flex justify-between items-center border-b-2 border-[#0a0a0a] pb-2 text-[10px] font-extrabold">
              <span>BINSCAN SYSTEMS</span>
              <span>ID: {checksum}</span>
            </div>

            {/* QR Canvas */}
            <div className="flex justify-center items-center py-2 bg-white relative group border border-slate-100 rounded-sm">
              <canvas ref={canvasRef} className="w-[180px] h-[180px] object-contain"></canvas>
              
              <button 
                onClick={() => setIsFullscreen(true)}
                className="absolute right-2 bottom-2 p-1.5 bg-black/60 hover:bg-black text-white rounded opacity-0 group-hover:opacity-100 transition duration-150"
                title="Fullscreen QR View"
              >
                <Maximize2 size={13} />
              </button>
            </div>

            {/* Sticker Info */}
            <div className="text-center space-y-2">
              <div className="text-base font-extrabold tracking-wider truncate py-0.5 border-t border-b border-dashed border-black/20">
                {activeCode}
              </div>
              <div className="flex justify-between text-[8px] text-[#555] font-semibold">
                <span>GEN DATE: {nowFormatted}</span>
                <span>STATUS: OK</span>
              </div>
            </div>
            
            {/* Bottom Cut Dotted Edge */}
            <div className="absolute bottom-[-4px] left-0 right-0 h-[4px] bg-[linear-gradient(to_right,#0a0a0a_50%,transparent_50%)] bg-[length:8px_100%] bg-repeat-x"></div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-warehouse-muted/60 py-16">
            <Maximize2 size={56} className="text-warehouse-muted/30 animate-pulse" />
            <span className="font-mono text-xs font-bold tracking-wider">AWAITING LOCATION CODE</span>
          </div>
        )}
      </div>

      {/* Exporter Buttons */}
      <div className="grid grid-cols-3 gap-2.5">
        <button 
          onClick={handleDownload} 
          disabled={!activeCode}
          className="btn btn-primary py-3 px-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Download size={14} />
          <span>DOWNLOAD</span>
        </button>
        <button 
          onClick={handleCopyText} 
          disabled={!activeCode}
          className="btn btn-outline py-3 px-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Copy size={14} />
          <span>COPY</span>
        </button>
        <button 
          onClick={handlePrint} 
          disabled={!activeCode}
          className="btn btn-outline py-3 px-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Printer size={14} />
          <span>PRINT</span>
        </button>
      </div>

      {/* Fullscreen Overlay */}
      {isFullscreen && activeCode && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col justify-center items-center p-6">
          <button 
            onClick={() => setIsFullscreen(false)}
            className="absolute top-6 right-6 p-3 bg-warehouse-panel text-warehouse-text border border-warehouse-border rounded-full hover:border-warehouse-border-focus transition cursor-pointer"
          >
            <Minimize2 size={24} />
          </button>
          
          <div className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center justify-center gap-6 max-w-lg w-full max-h-[85vh]">
            <canvas 
              ref={(el) => {
                if (el) {
                  import('qrcode').then((QRCode) => {
                    QRCode.default.toCanvas(el, activeCode, {
                      width: 400,
                      margin: 1,
                      color: {
                        dark: '#000000',
                        light: '#ffffff'
                      }
                    });
                  });
                }
              }}
              className="max-w-full max-h-[60vh] object-contain"
            ></canvas>
            
            <h2 className="font-mono text-2xl font-black text-black tracking-widest text-center word-break break-all">
              {activeCode}
            </h2>
          </div>
        </div>
      )}
    </div>
  );
}
export type QRCodeViewerPropsType = {};
