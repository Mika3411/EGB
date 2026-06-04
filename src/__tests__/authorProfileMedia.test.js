import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cropAuthorProfileImage,
  resizeAuthorProfileImage,
} from '../shared/utils/authorProfileMedia';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalImage = globalThis.Image;

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  globalThis.Image = originalImage;
  vi.restoreAllMocks();
});

const installImageMocks = ({ width = 2400, height = 1200 } = {}) => {
  URL.createObjectURL = vi.fn(() => 'blob:author-profile-image');
  URL.revokeObjectURL = vi.fn();

  globalThis.Image = class {
    naturalWidth = width;
    naturalHeight = height;
    width = width;
    height = height;
    onload = null;
    onerror = null;

    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }

    get src() {
      return this._src;
    }
  };
};

describe('author profile media resizing', () => {
  it('resizes avatars to a square data URL', async () => {
    installImageMocks();
    const canvasCalls = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function toDataURL(mimeType, quality) {
      canvasCalls.push({ width: this.width, height: this.height, mimeType, quality });
      return 'data:image/webp;base64,avatar';
    });

    const result = await resizeAuthorProfileImage(new File(['avatar'], 'avatar.png', { type: 'image/png' }), 'avatar');

    expect(result).toBe('data:image/webp;base64,avatar');
    expect(canvasCalls[0]).toMatchObject({
      width: 512,
      height: 512,
      mimeType: 'image/webp',
      quality: 0.86,
    });
  });

  it('resizes banners to a horizontal data URL', async () => {
    installImageMocks();
    const canvasCalls = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function toDataURL(mimeType, quality) {
      canvasCalls.push({ width: this.width, height: this.height, mimeType, quality });
      return 'data:image/webp;base64,banner';
    });

    const result = await resizeAuthorProfileImage(new File(['banner'], 'banner.jpg', { type: 'image/jpeg' }), 'banner');

    expect(result).toBe('data:image/webp;base64,banner');
    expect(canvasCalls[0]).toMatchObject({
      width: 1600,
      height: 320,
      mimeType: 'image/webp',
      quality: 0.84,
    });
  });

  it('rejects non image files', async () => {
    await expect(
      resizeAuthorProfileImage(new File(['text'], 'profile.txt', { type: 'text/plain' }), 'avatar'),
    ).rejects.toThrow("Le fichier sélectionné n'est pas une image.");
  });

  it('crops avatars and banners with the requested output size', async () => {
    installImageMocks({ width: 2000, height: 800 });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function toDataURL(mimeType, quality) {
      return `data:${mimeType};quality=${quality};size=${this.width}x${this.height}`;
    });

    await expect(cropAuthorProfileImage({
      src: 'data:image/png;base64,source',
      sourceWidth: 2000,
      sourceHeight: 800,
      target: 'banner',
      zoom: 1.5,
      panX: 40,
      panY: -20,
    })).resolves.toBe('data:image/webp;quality=0.84;size=1600x320');

    await expect(cropAuthorProfileImage({
      src: 'data:image/png;base64,source',
      sourceWidth: 800,
      sourceHeight: 1200,
      target: 'avatar',
    })).resolves.toBe('data:image/webp;quality=0.86;size=512x512');
  });

  it('covers portrait avatar imports and clamps pan inside the final canvas', async () => {
    installImageMocks({ width: 900, height: 1200 });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage,
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,avatar');

    await cropAuthorProfileImage({
      src: 'data:image/png;base64,source',
      sourceWidth: 900,
      sourceHeight: 1200,
      target: 'avatar',
      zoom: 1,
      panX: 500,
      panY: 500,
    });

    let [, , , , , dx, dy, drawWidth, drawHeight] = drawImage.mock.calls.at(-1);
    expect(dx).toBe(0);
    expect(dy).toBeCloseTo(0, 4);
    expect(drawWidth).toBe(512);
    expect(drawHeight).toBeCloseTo(682.6667, 4);

    await cropAuthorProfileImage({
      src: 'data:image/png;base64,source',
      sourceWidth: 900,
      sourceHeight: 1200,
      target: 'avatar',
      zoom: 1,
      panY: -500,
    });

    [, , , , , dx, dy, drawWidth, drawHeight] = drawImage.mock.calls.at(-1);
    expect(dx).toBe(0);
    expect(drawWidth).toBe(512);
    expect(dy + drawHeight).toBeCloseTo(512, 4);
  });
});
