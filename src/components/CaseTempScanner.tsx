import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  Keyboard, 
  Play, 
  Square, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Sparkles 
} from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import { useBatchOCR } from '../hooks/useBatchOCR';
import { useAppStore } from '../store/useAppStore';
import ManualBatchInput from './ManualBatchInput';
import BatchCodeList from './BatchCodeList';

interface CaseTempScannerProps {
  onShowToast?: (msg: string) => void;
}

export default function CaseTempScanner({ onShowToast }: CaseTempScannerProps) {
  const [subTab, setSubTab] = useState<'scan' | 'manual'>('scan');
  const [isScanningActive, setIsScanningActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  const { stream, error: cameraError, startCamera, stopCamera } = useCamera();
  const { processFrame } = useBatchOCR();
  const { 
    batchItems, 
    autoGenerateBatchQr, 
    setAutoGenerateBatchQr 
  } = useAppStore();

  const caseCount = batchItems.filter(i => i.type === 'CASE').length;
  const tempCount = batchItems.filter(i => i.type === 'TEMP').length;
  const totalCount = batchItems.length;

  // Cleanup camera stream on unmount or tab change
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      stopCamera();
    };
  }, [stopCamera]);

  // Main scanning loop (runs at ~4 OCR frames/second when active)
  const runScanningLoop = useCallback(() => {
    if (!isScanningActive || !videoRef.current) return;

    const now = performance.now();
    // Throttle OCR to every 250ms (4 FPS) to optimize mobile battery & memory
    if (now - lastScanTimeRef.current >= 250) {
      lastScanTimeRef.current = now;
      if (videoRef.current.readyState >= 2) {
        processFrame(videoRef.current);
      }
    }

    animFrameRef.current = requestAnimationFrame(runScanningLoop);
  }, [isScanningActive, processFrame]);

  useEffect(() => {
    if (isScanningActive) {
      animFrameRef.current = requestAnimationFrame(runScanningLoop);
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, [isScanningActive, runScanningLoop]);

  const handleStartScan = async () => {
    try {
      setIsScanningActive(true);
      await startCamera('environment', videoRef.current);
      if (onShowToast) onShowToast('Camera batch scanner activated');
    } catch (err: any) {
      setIsScanningActive(false);
      if (onShowToast) onShowToast(err.message || 'Failed to start camera');
    }
  };

  const handleStopScan = () => {
    setIsScanningActive(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    stopCamera();
    if (onShowToast) onShowToast(`Scanning complete: ${totalCount} codes detected`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-mode selector (SCAN LIST vs MANUAL LIST) */}
      <div className="flex bg-warehouse-panel border border-warehouse-border rounded-xl p-1">
        <button
          onClick={() => {
            setSubTab('scan');
          }}
          className={`flex-1 py-2.5 px-4 rounded-lg font-mono font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition ${
            subTab === 'scan'
              ? 'bg-warehouse-card text-accent-amber border border-warehouse-border shadow-sm'
              : 'text-warehouse-muted hover:text-warehouse-text'
          }`}
        >
          <Camera size={15} />
          <span>SCAN LIST</span>
        </button>

        <button
          onClick={() => {
            if (isScanningActive) handleStopScan();
            setSubTab('manual');
          }}
          className={`flex-1 py-2.5 px-4 rounded-lg font-mono font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition ${
            subTab === 'manual'
              ? 'bg-warehouse-card text-accent-teal border border-warehouse-border shadow-sm'
              : 'text-warehouse-muted hover:text-warehouse-text'
          }`}
        >
          <Keyboard size={15} />
          <span>MANUAL LIST</span>
        </button>
      </div>

      {/* Workspace Content */}
      {subTab === 'scan' ? (
        <div className="flex flex-col gap-5">
          {/* Camera Viewfinder */}
          <div className={`viewfinder-container relative ${isScanningActive ? 'scanning-active' : ''}`}>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Reticle focus corners */}
            <div className="viewfinder-reticle">
              <div className="corner top-left"></div>
              <div className="corner top-right"></div>
              <div className="corner bottom-left"></div>
              <div className="corner bottom-right"></div>
              <div className="crosshair"></div>
              <div className="laser-line"></div>
            </div>

            {/* Inactive or Error Overlay */}
            {(!stream || cameraError) && (
              <div className="absolute inset-0 viewfinder-overlay">
                <div className="overlay-content">
                  {cameraError ? (
                    <>
                      <AlertCircle size={40} className="text-accent-red" />
                      <p className="overlay-message text-accent-red font-semibold text-xs">
                        {cameraError}
                      </p>
                      <button onClick={handleStartScan} className="btn btn-primary btn-large text-xs uppercase font-bold">
                        <RefreshCw size={14} />
                        <span>TRY AGAIN</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <Camera size={40} className="overlay-icon" />
                      <p className="overlay-message text-xs font-mono text-warehouse-muted">
                        Point camera at warehouse CASE or TEMP codes to scan continuously
                      </p>
                      <button
                        onClick={handleStartScan}
                        className="btn btn-primary btn-large text-xs uppercase font-bold tracking-wider"
                      >
                        <Play size={15} />
                        <span>START BATCH SCAN</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Controls Panel & Stats */}
          <div className="bg-warehouse-panel border border-warehouse-border rounded-xl p-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Scan buttons */}
              <div className="flex items-center gap-2">
                {!isScanningActive ? (
                  <button
                    onClick={handleStartScan}
                    className="btn btn-primary py-2 px-4 text-xs font-bold font-mono tracking-wider flex items-center gap-2"
                  >
                    <Play size={14} />
                    <span>START BATCH SCAN</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStopScan}
                    className="btn btn-danger py-2 px-4 text-xs font-bold font-mono tracking-wider flex items-center gap-2"
                  >
                    <Square size={14} />
                    <span>STOP SCAN</span>
                  </button>
                )}
              </div>

              {/* Auto Generate Toggle */}
              <div className="flex items-center gap-2 text-xs font-mono text-warehouse-muted">
                <label className="switch-control">
                  <input
                    type="checkbox"
                    checked={autoGenerateBatchQr}
                    onChange={(e) => setAutoGenerateBatchQr(e.target.checked)}
                  />
                  <span className="switch-slider"></span>
                </label>
                <span>AUTO GENERATE QR</span>
              </div>
            </div>

            {/* Real-time stats bar */}
            <div className="grid grid-cols-3 gap-2 bg-warehouse-card border border-warehouse-border rounded-lg p-3 text-center font-mono">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-warehouse-muted uppercase">TOTAL DETECTED</span>
                <span className="text-base font-extrabold text-warehouse-text">{totalCount}</span>
              </div>
              <div className="flex flex-col items-center border-x border-warehouse-border">
                <span className="text-[10px] text-accent-amber uppercase">CASE CODES</span>
                <span className="text-base font-extrabold text-accent-amber">{caseCount}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-accent-teal uppercase">TEMP CODES</span>
                <span className="text-base font-extrabold text-accent-teal">{tempCount}</span>
              </div>
            </div>
          </div>

          {/* Live Detected Stream List */}
          {batchItems.length > 0 && (
            <div className="bg-warehouse-card border border-warehouse-border rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-mono font-bold text-warehouse-muted border-b border-warehouse-border pb-2">
                <span className="flex items-center gap-1.5 text-accent-teal">
                  <Sparkles size={13} />
                  <span>LIVE DETECTED STREAM</span>
                </span>
                <span>{batchItems.length} UNIQUE</span>
              </div>

              <div className="max-h-[160px] overflow-y-auto flex flex-wrap gap-2 pt-1">
                {batchItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 bg-warehouse-panel border border-accent-teal/30 px-3 py-1 rounded-full text-xs font-mono text-warehouse-text animate-fade-in"
                  >
                    <CheckCircle size={13} className="text-accent-teal" />
                    <span>{item.code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* MANUAL LIST SUB-TAB */
        <ManualBatchInput onSuccess={onShowToast} />
      )}

      {/* Batch QR Grid & Result Exporters */}
      <BatchCodeList onShowToast={onShowToast} />
    </div>
  );
}
