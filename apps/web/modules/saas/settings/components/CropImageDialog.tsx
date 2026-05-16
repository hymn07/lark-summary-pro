"use client";

import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { useMemo, useRef } from "react";
import type { ReactCropperElement } from "react-cropper";
import Cropper from "react-cropper";

export function CropImageDialog({
  image,
  open,
  onOpenChange,
  onCrop,
}: {
  image: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCrop: (blob: Blob) => void;
}) {
  const cropperRef = useRef<ReactCropperElement>(null);

  const crop = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    cropper.getCroppedCanvas().toBlob((blob) => {
      if (blob) onCrop(blob);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        {image && <Cropper src={image} ref={cropperRef} aspectRatio={1} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={crop}>Crop</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
