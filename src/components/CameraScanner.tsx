import React from 'react';
import { CameraOff, Play, Square, Target, Loader2 } from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import { useOCR } from '../hooks/useOCR';
import { useAppStore } from '../store/useAppStore';
import { validateWarehouseCode } from '../utils/regex';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';

interface CameraScannerProps {
  onShowToast: (msg: string) => void;
}

export default function CameraScanner({ onShowToast }: CameraScannerProps) {
  const { isScanning, setIsScanning, setActiveCode, addToHistory, settings } = useAppStore();
  const { stream, error: cameraError, startCamera, stopCamera } = useCamera();
  const { ocrState, ocrProgress, ocrStatusText, recognize } = useOCR();

  const [isOcrBusy, setIsOcrBusy] = React.useState(false);
  const [detectedCodes, setDetectedCodes] = React.useState<string[]>([]);
  const [ocrFeedback, setOcrFeedback] = React.useState({ text: 'OCR engine loading...', type: 'info' });
  const [continuousOcrActive, setContinuousOcrActive] = React.useState(true);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const zxingControlsRef = React.useRef<IScannerControls | null>(null);
  const ocrIntervalRef = React.useRef<any>(null);

  const isOcrBusyRef = React.useRef(isOcrBusy);
  const continuousOcrActiveRef = React.useRef(continuousOcrActive);
  const isScanningRef = React.useRef(isScanning);
  
  React.useEffect(() => { isOcrBusyRef.current = isOcrBusy; }, [isOcrBusy]);
  React.useEffect(() => { continuousOcrActiveRef.current = continuousOcrActive; }, [continuousOcrActive]);
  React.useEffect(() => { isScanningRef.current = isScanning; }, [isScanning]);

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
    } catch (e) {
      console.warn(e);
    }
  };

  const triggerVibrate = () => {
    if (navigator.vibrate) {
      navigator.vibrate(80);
    }
  };

  const confirmCode = React.useCallback((code: string) => {
    const clean = code.trim().toUpperCase();
    setActiveCode(clean);
    addToHistory(clean);
    playScanBeep();
    triggerVibrate();
    setIsScanning(false);
    onShowToast(`Location code detected: ${clean}`);
  }, [setActiveCode, addToHistory, setIsScanning, onShowToast]);

  React.useEffect(() => {
    if (isScanning) {
      startCamera(settings.defaultCamera, videoRef.current)
        .catch(err => console.error("Auto-start camera failed:", err));
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isScanning, settings.defaultCamera, startCamera, stopCamera]);

  React.useEffect(() => {
    if (stream && videoRef.current && isScanning) {
      const reader = new BrowserMultiFormatReader();
      reader.decodeFromVideoElement(videoRef.current, (result) => {
        if (result) {
          const text = result.getText();
          if (validateWarehouseCode(text)) {
            confirmCode(text);
          }
        }
      }).then(controls => {
        zxingControlsRef.current = controls;
      }).catch(err => {
        console.error("ZXing binding error:", err);
      });
    }
    return () => {
      if (zxingControlsRef.current) {
        zxingControlsRef.current.stop();
        zxingControlsRef.current = null;
      }
    };
  }, [stream, isScanning, confirmCode]);

  React.useEffect(() => {
    if (ocrState === 'ready') {
      setOcrFeedback({ text: 'OCR Active. Align warehouse codes in viewfinder.', type: 'success' });
    } else if (ocrState === 'initializing') {
      setOcrFeedback({ text: `OCR Loading: ${ocrStatusText}`, type: 'info' });
    } else if (ocrState === 'error') {
      setOcrFeedback({ text: 'OCR Error. Using manual fallback.', type: 'error' });
    }
  }, [ocrState, ocrStatusText]);

  const processOcrFrame = React.useCallback(async () => {
    if (isOcrBusyRef.current || ocrState !== 'ready' || !stream || !isScanningRef.current) return;
    
    setIsOcrBusy(true);
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) {
      setIsOcrBusy(false);
      return;
    }

    try {
      const ctx = canvas.getContext('2d');
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;

      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const contrast = 1.6;
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          const val = factor * (gray - 128) + 128;
          data[i] = val;
          data[i+1] = val;
          data[i+2] = val;
        }
        ctx.putImageData(imgData, 0, 0);

        const text = await recognize(canvas);
        const upper = text.toUpperCase();
        const codeRegex = /\b[A-Z0-9]{1,5}(?:-[A-Z0-9]{1,5}){2,7}\b/g;
        const matches = (upper.match(codeRegex) || []) as string[];
        
        const validMatches = Array.from(new Set(matches)).filter(m => validateWarehouseCode(m));
        
        if (validMatches.length > 0) {
          setDetectedCodes(validMatches);
          if (validMatches.length === 1) {
            confirmCode(validMatches[0]);
          }
        }
      }
    } catch (err) {
      console.warn("OCR recognition cycle failed:", err);
    } finally {
      setIsOcrBusy(false);
    }
  }, [ocrState, stream, recognize, confirmCode]);

  React.useEffect(() => {
    if (isScanning && stream && ocrState === 'ready' && continuousOcrActive) {
      ocrIntervalRef.current = setInterval(() => {
        if (!isOcrBusyRef.current && continuousOcrActiveRef.current && isScanningRef.current) {
          processOcrFrame();
        }
      }, 800);
    } else {
      if (ocrIntervalRef.current) {
        clearInterval(ocrIntervalRef.current);
        ocrIntervalRef.current = null;
      }
    }
    return () => {
      if (ocrIntervalRef.current) {
        clearInterval(ocrIntervalRef.current);
        ocrIntervalRef.current = null;
      }
    };
  }, [isScanning, stream, ocrState, continuousOcrActive, processOcrFrame]);

  return (
    <div className="flex flex-col gap-4">
      {/* Viewfinder */}
      <div className={`viewfinder-container relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border-2 border-warehouse-border shadow-inner ${
        isScanning ? 'scanning-active' : ''
      }`}>
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>

        {/* Reticles */}
        <div className="viewfinder-reticle">
          <div className="corner top-left"></div>
          <div className="corner top-right"></div>
          <div className="corner bottom-left"></div>
          <div className="corner bottom-right"></div>
          <div className="laser-line"></div>
          <div className="crosshair"></div>
        </div>

        {/* Overlay */}
        {(!isScanning || cameraError) && (
          <div className="viewfinder-overlay absolute inset-0 bg-warehouse-bg/95 flex flex-col justify-center items-center p-6 text-center z-20">
            <CameraOff size={48} className="text-warehouse-muted/60 mb-3 animate-pulse" />
            <h4 className="font-mono text-sm font-bold text-warehouse-text mb-2">
              {cameraError ? 'CAMERA BLOCKED' : 'SCANNER INACTIVE'}
            </h4>
            <p className="text-xs text-warehouse-muted max-w-[280px] leading-relaxed mb-5">
              {cameraError ? cameraError : 'Webcam scanning stream is suspended. Toggle START below to activate.'}
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

      {/* Control Buttons */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <button
            onClick={() => setIsScanning(false)}
            disabled={!isScanning}
            className="btn btn-danger py-3 flex-1 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Square size={14} />
            <span>STOP CAM</span>
          </button>
          <button
            onClick={processOcrFrame}
            disabled={!isScanning || ocrState !== 'ready' || isOcrBusy}
            className="btn btn-accent py-3 flex-[2] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isOcrBusy ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
            <span>CAPTURE & DETECT</span>
          </button>
        </div>

        <div className="flex justify-between items-center bg-warehouse-panel border border-warehouse-border px-4 py-3 rounded-lg font-sans">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-warehouse-text">Continuous OCR Scans</span>
            <span className="text-[10px] text-warehouse-muted font-mono">Capture frames automatically every 1.8s</span>
          </div>
          <label className="switch-control">
            <input 
              type="checkbox"
              checked={continuousOcrActive}
              disabled={!isScanning || ocrState !== 'ready'}
              onChange={(e) => setContinuousOcrActive(e.target.checked)}
            />
            <span className="switch-slider"></span>
          </label>
        </div>
      </div>

      <div className="border-t border-warehouse-border pt-4 mt-2">
        {/* Loader progress */}
        {(isOcrBusy || ocrState === 'initializing') && (
          <div className="ocr-loader flex items-center gap-3 bg-accent-amber/5 border border-accent-amber/20 p-3.5 rounded-lg mb-3">
            <Loader2 className="spinner animate-spin text-accent-amber" size={18} />
            <div className="flex-grow flex flex-col gap-1">
              <span className="font-mono text-[10px] font-bold text-accent-amber">Tesseract OCR processing...</span>
              <div className="w-full bg-accent-amber/10 h-1 rounded overflow-hidden">
                <div className="bg-accent-amber h-full transition-all duration-150" style={{ width: `${ocrProgress * 100}%` }}></div>
              </div>
            </div>
          </div>
        )}

        <div className={`ocr-feedback-message px-3 py-2.5 rounded-lg text-xs font-medium text-center border-l-4 ${
          ocrFeedback.type === 'error' ? 'bg-accent-red/5 border-accent-red text-red-200' :
          ocrFeedback.type === 'success' ? 'bg-accent-teal/5 border-accent-teal text-teal-200' :
          'bg-warehouse-panel border-warehouse-border text-warehouse-muted'
        }`}>
          {ocrFeedback.text}
        </div>

        {/* Chips list */}
        {detectedCodes.length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="block text-[10px] font-mono font-bold text-warehouse-muted tracking-wider">
              OCR DETECTED LOCATION CODES (SELECT ONE):
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
          </div>
        )}
      </div>

      <canvas ref={captureCanvasRef} style={{ display: 'none' }}></canvas>
    </div>
  );
}
export type CameraScannerPropsType = {};
