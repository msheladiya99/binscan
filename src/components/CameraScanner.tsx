import React from 'react';
import { CameraOff, Play, Square, Target, Loader2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import { useOCR } from '../hooks/useOCR';
import { useAppStore } from '../store/useAppStore';
import { validateWarehouseCode, normalizeWarehouseCode } from '../utils/regex';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';

interface CameraScannerProps {
  onShowToast: (msg: string) => void;
}

// Scan states
type ScanState =
  | 'idle'         // camera not started
  | 'live'         // camera on, waiting to auto-capture
  | 'capturing'    // OCR is running on the frozen frame
  | 'found'        // code(s) detected — waiting for user to confirm chip
  | 'not_found';   // OCR ran but no valid code — show RECAPTURE button

export default function CameraScanner({ onShowToast }: CameraScannerProps) {
  const { isScanning, setIsScanning, setActiveCode, addToHistory, settings } = useAppStore();
  const { stream, error: cameraError, startCamera, stopCamera } = useCamera();
  const { ocrState, ocrProgress, ocrStatusText, recognize } = useOCR();

  const [scanState, setScanState] = React.useState<ScanState>('idle');
  const [isFlashActive, setIsFlashActive] = React.useState(false);
  const [frozenFrame, setFrozenFrame] = React.useState<string | null>(null);
  const [detectedCodes, setDetectedCodes] = React.useState<string[]>([]);
  const [ocrFeedback, setOcrFeedback] = React.useState('OCR engine loading...');

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const zxingControlsRef = React.useRef<IScannerControls | null>(null);
  const autoCaptureFiredRef = React.useRef(false);
  const ocrProcessingRef = React.useRef(false);

  // ─── Audio & haptic ──────────────────────────────────────────────────────
  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) { console.warn(e); }
  };

  const triggerVibrate = () => {
    if (navigator.vibrate) navigator.vibrate(80);
  };

  // ─── Confirm a code (from chip tap or auto single match) ─────────────────
  const confirmCode = React.useCallback((code: string) => {
    const clean = code.trim().toUpperCase();
    setActiveCode(clean);
    addToHistory(clean);
    playScanBeep();
    triggerVibrate();
    setIsScanning(false);
    setDetectedCodes([]);
    setFrozenFrame(null);
    setScanState('idle');
    onShowToast(`Location code detected: ${clean}`);
  }, [setActiveCode, addToHistory, setIsScanning, onShowToast]);

  // ─── Camera start / stop ──────────────────────────────────────────────────
  React.useEffect(() => {
    if (isScanning) {
      autoCaptureFiredRef.current = false; // reset on every new scan session
      setScanState('live');
      startCamera(settings.defaultCamera, videoRef.current)
        .catch(err => console.error('Auto-start camera failed:', err));
    } else {
      stopCamera();
      setFrozenFrame(null);
      setScanState('idle');
    }
    return () => {
      stopCamera();
      setFrozenFrame(null);
    };
  }, [isScanning, settings.defaultCamera, startCamera, stopCamera]);

  // ─── ZXing barcode reader (parallel fast path) ───────────────────────────
  React.useEffect(() => {
    if (stream && videoRef.current && isScanning) {
      const reader = new BrowserMultiFormatReader();
      reader.decodeFromVideoElement(videoRef.current, (result) => {
        if (result) {
          const text = result.getText();
          if (validateWarehouseCode(text)) confirmCode(text);
        }
      }).then(controls => {
        zxingControlsRef.current = controls;
      }).catch(err => console.error('ZXing binding error:', err));
    }
    return () => {
      if (zxingControlsRef.current) {
        zxingControlsRef.current.stop();
        zxingControlsRef.current = null;
      }
    };
  }, [stream, isScanning, confirmCode]);

  // ─── OCR feedback text ────────────────────────────────────────────────────
  React.useEffect(() => {
    if (ocrState === 'ready') {
      setOcrFeedback('OCR ready. Camera will auto-capture when active.');
    } else if (ocrState === 'initializing') {
      setOcrFeedback(`OCR Loading: ${ocrStatusText}`);
    } else if (ocrState === 'error') {
      setOcrFeedback('OCR Error. Using barcode scanner fallback.');
    }
  }, [ocrState, ocrStatusText]);

  // ─── Auto-capture: fires once when camera + OCR are both ready ────────────
  React.useEffect(() => {
    if (
      isScanning &&
      stream &&
      ocrState === 'ready' &&
      scanState === 'live' &&
      !autoCaptureFiredRef.current
    ) {
      autoCaptureFiredRef.current = true;
      // Small delay so camera sensor can warm up
      const t = setTimeout(() => runCapture(), 800);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning, stream, ocrState, scanState]);

  // ─── Core capture + OCR logic ─────────────────────────────────────────────
  const runCapture = React.useCallback(async () => {
    if (ocrProcessingRef.current || ocrState !== 'ready' || !stream) return;

    ocrProcessingRef.current = true;
    setScanState('capturing');
    setDetectedCodes([]);

    // Camera flash
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 150);

    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) {
      ocrProcessingRef.current = false;
      setScanState('not_found');
      return;
    }

    try {
      const ctx = canvas.getContext('2d');
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;

      // 1. Freeze full frame
      canvas.width = w;
      canvas.height = h;

      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        const snapshot = canvas.toDataURL('image/jpeg', 0.85);
        setFrozenFrame(snapshot);

        // 2. Crop centre 80% × 60% for OCR (wider than before to avoid cutting off labels)
        const cropW = Math.round(w * 0.8);
        const cropH = Math.round(h * 0.60);
        const cropX = Math.round((w - cropW) / 2);
        const cropY = Math.round((h - cropH) / 2);

        // Helper: build a canvas from drawing region
        const makeCrop = (): HTMLCanvasElement => {
          const c = document.createElement('canvas');
          c.width = cropW;
          c.height = cropH;
          const cc = c.getContext('2d')!;
          cc.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          return c;
        };

        // 3. Three preprocessing variants to maximise OCR hit chance
        // Variant A: raw crop (no extra processing)
        const cropRaw = makeCrop();

        // Variant B: adaptive binarize (balanced threshold at 100% of mean, not 88%)
        const cropBin = makeCrop();
        (() => {
          const cc = cropBin.getContext('2d')!;
          const imgData = cc.getImageData(0, 0, cropW, cropH);
          const px = imgData.data;
          let sum = 0;
          for (let i = 0; i < px.length; i += 4)
            sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          const thr = sum / (px.length / 4); // balanced mean threshold
          for (let i = 0; i < px.length; i += 4) {
            const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            const v = g < thr ? 0 : 255;
            px[i] = px[i + 1] = px[i + 2] = v;
          }
          cc.putImageData(imgData, 0, 0);
        })();

        // Variant C: high-contrast boost (stretch brightness range)
        const cropHC = makeCrop();
        (() => {
          const cc = cropHC.getContext('2d')!;
          const imgData = cc.getImageData(0, 0, cropW, cropH);
          const px = imgData.data;
          let minL = 255, maxL = 0;
          for (let i = 0; i < px.length; i += 4) {
            const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            if (g < minL) minL = g;
            if (g > maxL) maxL = g;
          }
          const range = maxL - minL || 1;
          for (let i = 0; i < px.length; i += 4) {
            const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            const v = Math.round(((g - minL) / range) * 255);
            px[i] = px[i + 1] = px[i + 2] = v;
          }
          cc.putImageData(imgData, 0, 0);
        })();

        // 4. Run OCR on all three variants in parallel
        const [rawA, rawB, rawC] = await Promise.all([
          recognize(cropRaw).catch(() => ''),
          recognize(cropBin).catch(() => ''),
          recognize(cropHC).catch(() => ''),
        ]);

        // Debug: log raw OCR so developers can see what Tesseract is reading
        console.debug('[OCR] raw (A):', rawA);
        console.debug('[OCR] bin (B):', rawB);
        console.debug('[OCR] hc  (C):', rawC);

        // 5. Gather all candidate strings from all three results
        const allRaw = [rawA, rawB, rawC].join(' ');
        const cleaned = allRaw.toUpperCase().replace(/[^A-Z0-9\-\s]/g, ' ');
        const segments = (cleaned.match(/[A-Z0-9]{1,5}(?:-[A-Z0-9]{1,5}){2,7}/g) || []);

        // 6. Validate each segment — first with strict check, then with OCR-correction
        const valid = Array.from(new Set(
          segments.flatMap(m => {
            if (validateWarehouseCode(m)) return [m];
            const corrected = normalizeWarehouseCode(m);
            return corrected ? [corrected] : [];
          })
        ));

        if (valid.length > 0) {
          setScanState('found');
          setDetectedCodes(valid);
          if (valid.length === 1) {
            // Auto-confirm if exactly one match
            confirmCode(valid[0]);
          }
        } else {
          setScanState('not_found');
        }
      }
    } catch (err) {
      console.warn('OCR recognition failed:', err);
      setScanState('not_found');
    } finally {
      ocrProcessingRef.current = false;
    }
  }, [ocrState, stream, recognize, confirmCode]);

  // ─── Recapture: unfreeze live feed → new shot ─────────────────────────────
  const handleRecapture = () => {
    setFrozenFrame(null);
    setDetectedCodes([]);
    setScanState('live');
    autoCaptureFiredRef.current = false; // allow one more auto-capture
  };

  // When scanState goes back to live (after recapture), auto-fire again
  React.useEffect(() => {
    if (
      isScanning &&
      stream &&
      ocrState === 'ready' &&
      scanState === 'live' &&
      !autoCaptureFiredRef.current
    ) {
      autoCaptureFiredRef.current = true;
      const t = setTimeout(() => runCapture(), 600);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanState]);

  // ─── Render ───────────────────────────────────────────────────────────────
  const isCapturing = scanState === 'capturing';
  const notFound    = scanState === 'not_found';
  const codesFound  = scanState === 'found';

  return (
    <div className="flex flex-col gap-4">

      {/* ── Viewfinder ── */}
      <div className={`viewfinder-container relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border-2 shadow-inner ${
        isScanning ? 'border-accent-amber scanning-active' : 'border-warehouse-border'
      }`}>
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />

        {/* Frozen snapshot overlay */}
        {frozenFrame && (
          <img
            src={frozenFrame}
            className="absolute inset-0 w-full h-full object-cover z-[5]"
            alt="Captured snapshot"
          />
        )}

        {/* Camera flash */}
        {isFlashActive && (
          <div className="absolute inset-0 bg-white z-[30] opacity-75 pointer-events-none" />
        )}

        {/* Reticles */}
        <div className="viewfinder-reticle">
          <div className="corner top-left" />
          <div className="corner top-right" />
          <div className="corner bottom-left" />
          <div className="corner bottom-right" />
          {!frozenFrame && <div className="laser-line" />}
          <div className="crosshair" />
        </div>

        {/* ── Scanning status badge (top centre) ── */}
        {isScanning && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[15] flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
            {isCapturing ? (
              <><Loader2 size={12} className="animate-spin text-accent-amber" /><span className="text-[10px] font-mono text-accent-amber">ANALYZING...</span></>
            ) : notFound ? (
              <><XCircle size={12} className="text-red-400" /><span className="text-[10px] font-mono text-red-400">NO CODE FOUND</span></>
            ) : codesFound ? (
              <><CheckCircle2 size={12} className="text-accent-teal" /><span className="text-[10px] font-mono text-accent-teal">CODE DETECTED</span></>
            ) : (
              <><div className="w-2 h-2 rounded-full bg-accent-amber animate-pulse" /><span className="text-[10px] font-mono text-white/80">READY TO CAPTURE</span></>
            )}
          </div>
        )}

        {/* ── RECAPTURE button overlaid on frozen frame ── */}
        {notFound && frozenFrame && (
          <div className="absolute inset-0 z-[20] flex flex-col items-center justify-end pb-6 gap-3 bg-black/40">
            <p className="text-xs font-mono text-white/70 text-center px-4">Image unclear or no code detected.<br/>Reposition and try again.</p>
            <button
              onClick={handleRecapture}
              className="flex items-center gap-2 bg-accent-amber text-warehouse-bg font-bold font-mono text-sm px-6 py-3 rounded-xl shadow-lg active:scale-95 transition-transform"
            >
              <RefreshCw size={16} />
              RECAPTURE
            </button>
          </div>
        )}

        {/* ── Inactive overlay ── */}
        {(!isScanning || cameraError) && (
          <div className="viewfinder-overlay absolute inset-0 bg-warehouse-bg/95 flex flex-col justify-center items-center p-6 text-center z-20">
            <CameraOff size={48} className="text-warehouse-muted/60 mb-3 animate-pulse" />
            <h4 className="font-mono text-sm font-bold text-warehouse-text mb-2">
              {cameraError ? 'CAMERA BLOCKED' : 'SCANNER INACTIVE'}
            </h4>
            <p className="text-xs text-warehouse-muted max-w-[280px] leading-relaxed mb-5">
              {cameraError ? cameraError : 'Press START to auto-capture and detect warehouse codes.'}
            </p>
            <button
              onClick={() => setIsScanning(true)}
              className="btn btn-primary font-mono text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Play size={14} />
              <span>START SCANNER</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Control buttons ── */}
      <div className="flex gap-3">
        <button
          onClick={() => setIsScanning(false)}
          disabled={!isScanning}
          className="btn btn-danger py-3 flex-1 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Square size={14} />
          <span>STOP</span>
        </button>

        {/* Manual capture button — only shown when live (not capturing / not reviewing) */}
        {(scanState === 'live' || scanState === 'capturing') && (
          <button
            onClick={runCapture}
            disabled={!isScanning || ocrState !== 'ready' || isCapturing}
            className="btn btn-accent py-3 flex-[2] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
            <span>{isCapturing ? 'SCANNING...' : 'CAPTURE & DETECT'}</span>
          </button>
        )}

        {/* Recapture button in control bar (when not_found but no frozen preview) */}
        {notFound && !frozenFrame && (
          <button
            onClick={handleRecapture}
            className="btn btn-accent py-3 flex-[2] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={16} />
            <span>RECAPTURE</span>
          </button>
        )}
      </div>

      {/* ── Status & chips ── */}
      <div className="border-t border-warehouse-border pt-4 mt-1 space-y-3">

        {/* OCR progress bar while capturing */}
        {isCapturing && (
          <div className="ocr-loader flex items-center gap-3 bg-accent-amber/5 border border-accent-amber/20 p-3.5 rounded-lg">
            <Loader2 className="spinner animate-spin text-accent-amber" size={18} />
            <div className="flex-grow flex flex-col gap-1">
              <span className="font-mono text-[10px] font-bold text-accent-amber">Tesseract OCR processing...</span>
              <div className="w-full bg-accent-amber/10 h-1 rounded overflow-hidden">
                <div className="bg-accent-amber h-full transition-all duration-150" style={{ width: `${ocrProgress * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Feedback text */}
        <div className={`px-3 py-2.5 rounded-lg text-xs font-medium text-center border-l-4 ${
          notFound    ? 'bg-red-500/5 border-red-500 text-red-300'        :
          codesFound  ? 'bg-accent-teal/5 border-accent-teal text-teal-200' :
          isCapturing ? 'bg-accent-amber/5 border-accent-amber text-amber-200' :
                        'bg-warehouse-panel border-warehouse-border text-warehouse-muted'
        }`}>
          {notFound    ? '⚠ No valid warehouse code found. Tap RECAPTURE to try again.'  :
           codesFound  ? '✓ Code detected! Tap a chip below to generate its QR code.'      :
           isCapturing ? '⏳ Analysing captured image...'                                   :
                        ocrFeedback}
        </div>

        {/* Code chips */}
        {codesFound && detectedCodes.length > 1 && (
          <div className="space-y-2">
            <span className="block text-[10px] font-mono font-bold text-warehouse-muted tracking-wider">
              SELECT A CODE:
            </span>
            <div className="flex flex-wrap gap-2">
              {detectedCodes.map((code, idx) => (
                <button
                  key={idx}
                  onClick={() => confirmCode(code)}
                  className="code-chip"
                >
                  {code}
                </button>
              ))}
            </div>
            {/* Also show recapture option when multiple codes found */}
            <button
              onClick={handleRecapture}
              className="flex items-center gap-1.5 text-[11px] font-mono text-warehouse-muted hover:text-warehouse-text transition-colors mt-1"
            >
              <RefreshCw size={11} /> Recapture instead
            </button>
          </div>
        )}
      </div>

      <canvas ref={captureCanvasRef} style={{ display: 'none' }} />
    </div>
  );
}
export type CameraScannerPropsType = {};
