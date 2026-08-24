export const MAX_SCAN_EDGE = 1600;

export function computeTargetSize(
  width: number,
  height: number,
  maxEdge: number = MAX_SCAN_EDGE,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export async function preprocessReceiptImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = computeTargetSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);
    const px = image.data;
    const contrast = 1.35;
    const offset = -40;
    for (let i = 0; i < px.length; i += 4) {
      const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const adjusted = Math.max(0, Math.min(255, gray * contrast + offset));
      px[i] = adjusted;
      px[i + 1] = adjusted;
      px[i + 2] = adjusted;
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}
