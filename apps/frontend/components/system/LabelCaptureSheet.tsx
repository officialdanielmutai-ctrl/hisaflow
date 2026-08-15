'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { X, Loader2, Camera, AlertCircle, RotateCcw } from 'lucide-react';
import { useLabelOcrCapture, type LabelOcrResult } from '@/hooks/useLabelOcrCapture';

interface LabelCaptureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (result: LabelOcrResult) => void;
}

/**
 * Captures a product label/packaging photo entirely in-page (getUserMedia
 * + canvas snapshot), the same approach BarcodeScannerSheet uses. This is
 * deliberate: an <input capture="environment"> that hands off to the OS
 * camera app is unreliable in an installed PWA - see useLabelOcrCapture's
 * doc comment for why.
 */
export default function LabelCaptureSheet({ open, onOpenChange, onCapture }: LabelCaptureSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);

  const { processImage, status } = useLabelOcrCapture();

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      if (!open) return;

      setReady(false);
      setError(null);
      setPreview(null);
      setNotFoundMessage(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera not supported (HTTPS required).');
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
        });

        let retries = 0;
        while (!videoRef.current && retries < 20) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          retries++;
        }

        if (!videoRef.current) {
          throw new Error('Video container failed to initialize.');
        }

        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();

        setReady(true);
      } catch (err: any) {
        console.error('Camera error:', err);
        setError('Could not access camera. Please ensure camera permissions are granted.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [open]);

  const handleShutter = () => {
    if (!videoRef.current || !ready) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPreview(canvas.toDataURL('image/jpeg', 0.9));

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setError('Could not capture photo. Please try again.');
          setPreview(null);
          return;
        }

        const result = await processImage(blob);

        if (!result || (!result.name && !result.category && !result.expiryDate && !result.batchNumber)) {
          setNotFoundMessage("Couldn't read any details from that photo — try getting closer to the product name, or enter details manually.");
          setPreview(null);
          return;
        }

        onCapture(result);
        onOpenChange(false);
      },
      'image/jpeg',
      0.9,
    );
  };

  const handleRetry = () => {
    setPreview(null);
    setNotFoundMessage(null);
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex flex-col rounded-t-[32px] bg-white h-[85vh] max-h-[800px] outline-none border border-gray-200">
          <div className="p-4 bg-white rounded-t-[32px] flex flex-col items-center border-b border-gray-100 flex-shrink-0">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-200 mb-6" />
            <div className="flex w-full justify-between items-center px-2">
              <div className="flex items-center gap-2">
                <div className="bg-[var(--color-primary)]/10 p-2 rounded-lg">
                  <Camera className="h-5 w-5 text-[var(--color-primary)]" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Scan Label</h2>
              </div>
              <Drawer.Close className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5 text-gray-500" />
              </Drawer.Close>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 flex flex-col items-center">
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl flex items-start gap-3 w-full max-w-md">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {notFoundMessage && (
              <div className="mb-6 p-4 bg-amber-50 text-amber-700 rounded-xl flex items-start gap-3 w-full max-w-md">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">{notFoundMessage}</p>
              </div>
            )}

            <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden bg-black shadow-inner">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Captured label" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                />
              )}

              {status === 'processing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                  <span className="text-sm font-medium text-white">Reading the label…</span>
                </div>
              )}

              {!preview && (
                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none" />
              )}
            </div>

            <div className="mt-8 text-center max-w-sm">
              <h3 className="font-semibold text-gray-900 mb-2">
                {preview ? 'Reading details from this photo' : 'Frame the product name clearly'}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {preview
                  ? "This can take a few seconds."
                  : "Point the camera at the packaging or label, then tap the shutter."}
              </p>
            </div>

            {!ready && !error && !preview && (
              <div className="mt-6 flex items-center gap-2 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Initializing camera...</span>
              </div>
            )}

            {notFoundMessage && (
              <button
                type="button"
                onClick={handleRetry}
                className="mt-6 flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium"
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </button>
            )}
          </div>

          {ready && !preview && !error && (
            <div className="flex-shrink-0 flex items-center justify-center p-6 bg-white border-t border-gray-100">
              <button
                type="button"
                onClick={handleShutter}
                disabled={status === 'processing'}
                aria-label="Capture photo"
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[var(--color-primary)] bg-white disabled:opacity-50"
              >
                <div className="h-12 w-12 rounded-full bg-[var(--color-primary)]" />
              </button>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
