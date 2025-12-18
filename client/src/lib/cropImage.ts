// Utility to crop an image using an offscreen canvas
// imageSrc: string (URL or data URL), crop: { x, y, width, height } in pixels
// Returns a Blob of the cropped image
export async function getCroppedImageBlob(
  imageSrc: string,
  crop: { x: number; y: number; width: number; height: number },
  mimeType: string = 'image/jpeg',
  quality: number = 0.92,
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(crop.width));
  canvas.height = Math.max(1, Math.round(crop.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Draw cropped area
  ctx.drawImage(
    image,
    crop.x, crop.y, crop.width, crop.height, // source rect
    0, 0, canvas.width, canvas.height // destination
  );

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) return reject(new Error('Canvas toBlob returned null'));
      resolve(b);
    }, mimeType, quality);
  });
  return blob;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Attempt to avoid tainting canvas when possible (same-origin uploads should be fine)
    try { img.crossOrigin = 'anonymous'; } catch {}
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
