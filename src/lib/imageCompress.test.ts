import { describe, expect, it } from 'vitest';
import { fitSize, GIF_MAX_BYTES, validateImageFile } from './imageCompress';

describe('validateImageFile', () => {
  it('接受四種圖片格式', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) {
      expect(validateImageFile({ type, size: 1000 })).toBeNull();
    }
  });
  it('拒絕 SVG 和 PDF', () => {
    expect(validateImageFile({ type: 'image/svg+xml', size: 10 })).toBe('type');
    expect(validateImageFile({ type: 'application/pdf', size: 10 })).toBe('type');
  });
  it('GIF 超過 3MB 被擋', () => {
    expect(validateImageFile({ type: 'image/gif', size: GIF_MAX_BYTES })).toBeNull();
    expect(validateImageFile({ type: 'image/gif', size: GIF_MAX_BYTES + 1 })).toBe('gif_too_large');
  });
  it('大張的 JPEG 不受 3MB 限制（會被壓縮）', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 20 * 1024 * 1024 })).toBeNull();
  });
});

describe('fitSize', () => {
  it('4000×3000 縮成長邊 1600', () => {
    expect(fitSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });
  it('直式照片也是看長邊', () => {
    expect(fitSize(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });
  it('小圖不放大', () => {
    expect(fitSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
