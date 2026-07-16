import { useState, useEffect, useRef, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

export function useOCR() {
  const [ocrState, setOcrState] = useState<'uninitialized' | 'initializing' | 'ready' | 'error'>('uninitialized');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('Idle');
  const workerRef = useRef<any>(null); // Type 'any' used to bypass complex internal Tesseract typings

  useEffect(() => {
    let isMounted = true;

    async function initTesseract() {
      setOcrState('initializing');
      setOcrStatusText('OCR WARMING');
      
      try {
        const worker = await createWorker('eng', 1, {
          logger: m => {
            if (!isMounted) return;
            if (m.status === 'recognizing text') {
              setOcrProgress(m.progress);
              setOcrStatusText(`Scanning (${Math.round(m.progress * 100)}%)`);
            } else {
              const statusStr = m.status ? m.status.replaceAll('_', ' ') : 'processing';
              setOcrProgress(typeof m.progress === 'number' ? m.progress : 0.2);
              setOcrStatusText(`${statusStr.toUpperCase()}`);
            }
          }
        });
        
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
          tessedit_pageseg_mode: '7' as any // Treat as single text line (very fast)
        });

        if (isMounted) {
          workerRef.current = worker;
          setOcrState('ready');
          setOcrStatusText('OCR: READY');
        } else {
          await worker.terminate();
        }
      } catch (err) {
        console.error("Tesseract load error:", err);
        if (isMounted) {
          setOcrState('error');
          setOcrStatusText('OCR: ERROR');
        }
      }
    }

    initTesseract();

    return () => {
      isMounted = false;
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const recognize = useCallback(async (imageSource: HTMLCanvasElement | HTMLVideoElement | string) => {
    if (ocrState !== 'ready' || !workerRef.current) {
      throw new Error("OCR Engine is not ready");
    }
    
    const result = await workerRef.current.recognize(imageSource);
    return result.data.text || '';
  }, [ocrState]);

  return {
    ocrState,
    ocrProgress,
    ocrStatusText,
    recognize
  };
}
export type UseOCRReturn = ReturnType<typeof useOCR>;
