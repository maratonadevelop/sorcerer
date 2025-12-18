import React, { useCallback, useMemo, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { getCroppedImageBlob } from '@/lib/cropImage';

export interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null; // image preview url (ObjectURL or remote)
  aspect?: number; // e.g., 16/9; if omitted, free aspect
  mimeType?: string; // 'image/jpeg' or 'image/png'
  quality?: number; // 0..1
  onCropped: (blob: Blob) => void;
}

export default function ImageCropDialog({ open, onOpenChange, src, aspect, mimeType = 'image/jpeg', quality = 0.92, onCropped }: ImageCropDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!src || !croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedImageBlob(src, {
        x: croppedAreaPixels.x,
        y: croppedAreaPixels.y,
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height,
      }, mimeType, quality);
      onCropped(blob);
      onOpenChange(false);
    } catch (e) {
      console.error('Crop failed', e);
      alert('Falha ao cortar imagem');
    } finally {
      setIsProcessing(false);
    }
  }, [src, croppedAreaPixels, mimeType, quality, onCropped, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cortar imagem</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-[60vh] bg-black/60 rounded-md overflow-hidden">
          {src ? (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              restrictPosition={false}
              showGrid={true}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">Selecione uma imagem</div>
          )}
        </div>
        <div className="mt-4 space-y-2">
          <div className="text-xs text-muted-foreground">Zoom</div>
          <Slider min={1} max={3} step={0.01} value={[zoom]} onValueChange={(v) => setZoom(v[0] ?? 1)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!src || !croppedAreaPixels || isProcessing}>{isProcessing ? 'Processando...' : 'Aplicar corte'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
