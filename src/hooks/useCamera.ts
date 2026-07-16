import { useState, useCallback, useRef } from 'react';

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  const startCamera = useCallback(async (
    facingMode: 'user' | 'environment' = 'environment', 
    videoElement?: HTMLVideoElement | null
  ) => {
    stopCamera();
    setError(null);

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: false
    };

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoElement) {
        videoElement.srcObject = mediaStream;
        videoElement.setAttribute('playsinline', 'true');
        videoElement.play().catch(e => console.warn("Video auto-play blocked or failed", e));
      }

      return mediaStream;
    } catch (err: any) {
      console.warn("MediaDevice constraints ideal environment failed, attempting generic fallback stream", err);
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = mediaStream;
        setStream(mediaStream);
        
        if (videoElement) {
          videoElement.srcObject = mediaStream;
          videoElement.setAttribute('playsinline', 'true');
          videoElement.play().catch(e => console.warn("Fallback Video auto-play failed", e));
        }
        
        return mediaStream;
      } catch (innerErr: any) {
        console.error("Camera access failed:", innerErr);
        const name = innerErr?.name || '';
        let msg = "Could not activate camera.";
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          msg = "Permission blocked. Please enable camera access in your browser settings.";
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          msg = "No webcam device found on this system.";
        }
        setError(msg);
        throw new Error(msg);
      }
    }
  }, [stopCamera]);

  return {
    stream,
    error,
    startCamera,
    stopCamera
  };
}
export type UseCameraReturn = ReturnType<typeof useCamera>;
