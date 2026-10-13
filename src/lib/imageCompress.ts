// 圖片檢查與壓縮（架構文件 9.1）：
// - 只接受 jpg、png、gif、webp
// - 非 GIF 重新繪製：長邊縮到 1600px，另做一張 480px 縮圖；重新繪製也會拿掉照片裡的拍攝地點等資訊
// - GIF 不壓縮（不然會變成不會動的圖），改成限制 3MB

import type { PreparedImage } from '../chat/types';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const GIF_MAX_BYTES = 3 * 1024 * 1024;
const FULL_EDGE = 1600;
const THUMB_EDGE = 480;

export type ImageError = 'type' | 'gif_too_large';

export const IMAGE_ERROR_TEXT: Record<ImageError | 'broken', string> = {
  type: '只能傳 jpg、png、gif、webp 圖片',
  gif_too_large: 'GIF 最大 3MB',
  broken: '這張圖片讀不出來，請換一張',
};

export function validateImageFile(file: { type: string; size: number }): ImageError | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'type';
  if (file.type === 'image/gif' && file.size > GIF_MAX_BYTES) return 'gif_too_large';
  return null;
}

/** 長邊不超過 maxEdge 時維持原尺寸 */
export function fitSize(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function render(bitmap: ImageBitmap, maxEdge: number, type: string): Promise<Blob> {
  const size = fitSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))), type, 0.85),
  );
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  // imageOrientation: 'from-image' 讓手機直拍的照片方向正確
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (file.type === 'image/gif') {
      return { full: file, thumb: file, width: bitmap.width, height: bitmap.height };
    }
    // PNG 保留透明背景，其餘轉成 JPEG
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const [full, thumb] = await Promise.all([
      render(bitmap, FULL_EDGE, type),
      render(bitmap, THUMB_EDGE, type),
    ]);
    const size = fitSize(bitmap.width, bitmap.height, FULL_EDGE);
    return { full, thumb, width: size.width, height: size.height };
  } finally {
    bitmap.close();
  }
}
