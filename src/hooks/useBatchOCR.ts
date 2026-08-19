import { useState, useEffect, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import { extractCaseTempCodes } from '../utils/regex';
import { useAppStore } from '../store/useAppStore';

export function playDetectionFeedback() {
  // 1. Subtle vibration
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(100);
    } catch {
      // ignore
    }
  }

  // 2. Audio feedback
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch {
    // ignore audio autoplay policy errors
  }
}

/**
 * Preprocesses video frame on an offscreen canvas:
 * 1. Resizes image to optimal width (800-1000px)
 * 2. Converts to Grayscale
 * 3. Applies high contrast transformation
 */
export function preprocessFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

  const targetWidth = Math.min(1000, video.videoWidth);
  const scale = targetWidth / video.videoWidth;
  const targetHeight = Math.round(video.videoHeight * scale);

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Draw scaled video frame
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

  // Grayscale & Contrast enhancement
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Grayscale (Luma formula)
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Contrast boost factor
    const contrast = 1.3;
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    const newVal = Math.min(255, Math.max(0, factor * (gray - 128) + 128));

    data[i] = newVal;
    data[i + 1] = newVal;
    data[i + 2] = newVal;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function useBatchOCR() {
  const [ocrState, setOcrState] = useState<'uninitialized' | 'initializing' | 'ready' | 'error'>('uninitialized');
  const [ocrStatusText, setOcrStatusText] = useState('Idle');
  const workerRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const { addBatchCodes, addIgnoredBatchCodes } = useAppStore();

  useEffect(() => {
    let isMounted = true;

    async function initWorker() {
      setOcrState('initializing');
      setOcrStatusText('OCR ENGINE LOADING...');

      try {
        const worker = await createWorker('eng', 1, {
          logger: () => {}
        });

        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_ ',
          tessedit_pageseg_mode: '6' as any
        });

        if (isMounted) {
          workerRef.current = worker;
          offscreenCanvasRef.current = document.createElement('canvas');
          setOcrState('ready');
          setOcrStatusText('OCR READY');
        } else {
          await worker.terminate();
        }
      } catch (err) {
        console.error("Batch OCR init error:", err);
        if (isMounted) {
          setOcrState('error');
          setOcrStatusText('OCR INIT ERROR');
        }
      }
    }

    initWorker();

    return () => {
      isMounted = false;
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  /**
   * Processes a video frame using Tesseract OCR, extracts candidate CASE/TEMP/PERM codes.
   * Throttled to prevent overlapping OCR calls.
   */
  const processFrame = useCallback(async (videoElement: HTMLVideoElement) => {
    if (
      ocrState !== 'ready' || 
      !workerRef.current || 
      isProcessingRef.current || 
      !videoElement || 
      videoElement.readyState < 2
    ) {
      return;
    }

    isProcessingRef.current = true;

    try {
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }

      const preprocessed = preprocessFrame(videoElement, offscreenCanvasRef.current);
      if (!preprocessed) {
        isProcessingRef.current = false;
        return;
      }

      const result = await workerRef.current.recognize(preprocessed);
      const text = result?.data?.text || '';

      if (text) {
        const { validCodes, ignoredCodes } = extractCaseTempCodes(text);
        
        if (ignoredCodes.length > 0) {
          addIgnoredBatchCodes(ignoredCodes);
        }

        if (validCodes.length > 0) {
          const addedNew = addBatchCodes(validCodes);
          if (addedNew) {
            playDetectionFeedback();
          }
        }
      }
    } catch (err) {
      console.warn("Frame OCR processing warning:", err);
    } finally {
      isProcessingRef.current = false;
    }
  }, [ocrState, addBatchCodes, addIgnoredBatchCodes]);

  return {
    ocrState,
    ocrStatusText,
    processFrame,
    isProcessing: isProcessingRef.current
  };
}
