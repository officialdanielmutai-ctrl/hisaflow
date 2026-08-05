'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { X, Loader2, ScanLine, AlertCircle } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { useRouter } from 'next/navigation';

interface BarcodeScannerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BarcodeScannerSheet({ open, onOpenChange }: BarcodeScannerSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const router = useRouter();

  const handleScan = async (code: string) => {
    if (!membership?.organization.id) return;
    setScanning(false);
    setError(null);
    
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const orgId = membership.organization.id;
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/inventory/barcode/${encodeURIComponent(code)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-organization-id': orgId,
        },
      });

      if (response.ok) {
        const item = await response.json();
        onOpenChange(false);
        router.push(`/inventory/${item.product?.id || ''}`);
      } else if (response.status === 404) {
        onOpenChange(false);
        router.push(`/inventory/new?barcode=${encodeURIComponent(code)}`);
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Lookup failed');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error processing barcode');
      setScanning(true);
    }
  };

  useEffect(() => {
    let reader: BrowserMultiFormatReader | null = null;
    let nativeDetector: any = null;
    let animationFrameId: number;

    const startScanner = async () => {
      if (!open || !videoRef.current) return;
      
      try {
        setScanning(true);
        setError(null);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        setHasCamera(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if ('BarcodeDetector' in window) {
          try {
            // @ts-ignore
            nativeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'upc_a', 'code_128', 'code_39'] });
            
            const scanNative = async () => {
              if (!scanning || !videoRef.current || !nativeDetector) return;
              try {
                const barcodes = await nativeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  handleScan(barcodes[0].rawValue);
                  return;
                }
              } catch (e) {
              }
              animationFrameId = requestAnimationFrame(scanNative);
            };
            scanNative();
            return;
          } catch (e) {
            console.warn('Native BarcodeDetector failed, falling back to zxing', e);
          }
        }

        reader = new BrowserMultiFormatReader();
        reader.decodeFromVideoElement(videoRef.current, (result, error) => {
          if (result) {
            handleScan(result.getText());
          }
        });

      } catch (err: any) {
        console.error('Camera error:', err);
        setHasCamera(false);
        setError('Could not access camera. Please ensure camera permissions are granted.');
        setScanning(false);
      }
    };

    if (open) {
      startScanner();
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      

      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [open]);

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
                  <ScanLine className="h-5 w-5 text-[var(--color-primary)]" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Scan Barcode</h2>
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

            <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden bg-black shadow-inner">
              <video 
                ref={videoRef} 
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              />
              
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[70%] h-[70%] border-2 border-[var(--color-primary)] rounded-xl relative">
                  {scanning && (
                    <div className="absolute left-0 right-0 h-0.5 bg-[var(--color-primary)] shadow-[0_0_8px_var(--color-primary)] animate-pulse" 
                         style={{
                           animation: 'scan-line 2s infinite linear',
                           top: '0%'
                         }} 
                    />
                  )}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl" />
                </div>
              </div>
            </div>

            <div className="mt-8 text-center max-w-sm">
              <h3 className="font-semibold text-gray-900 mb-2">Align code within the frame</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Supports standard barcodes (EAN, UPC) and QR codes. The scanner will automatically detect and look up the item.
              </p>
            </div>
            
            {!scanning && !error && hasCamera !== false && (
              <div className="mt-6 flex items-center gap-2 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Initializing camera...</span>
              </div>
            )}
          </div>
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes scan-line {
              0% { top: 0%; opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { top: 100%; opacity: 0; }
            }
          `}} />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
