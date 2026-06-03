import { vi } from 'vitest';

const createCanvasGradientMock = () => ({
  addColorStop: vi.fn(),
});

const createCanvasPatternMock = () => ({});

const createImageDataMock = (width = 1, height = 1) => ({
  data: new Uint8ClampedArray(Math.max(1, width * height * 4)),
  width,
  height,
});

const createCanvas2dContextMock = (canvas) => ({
  canvas,
  fillStyle: '#000000',
  strokeStyle: '#000000',
  globalAlpha: 1,
  lineCap: 'butt',
  lineDashOffset: 0,
  lineJoin: 'miter',
  lineWidth: 1,
  miterLimit: 10,
  shadowBlur: 0,
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  textAlign: 'start',
  textBaseline: 'alphabetic',
  font: '10px sans-serif',
  arc: vi.fn(),
  arcTo: vi.fn(),
  beginPath: vi.fn(),
  bezierCurveTo: vi.fn(),
  clearRect: vi.fn(),
  clip: vi.fn(),
  closePath: vi.fn(),
  createImageData: vi.fn(createImageDataMock),
  createLinearGradient: vi.fn(createCanvasGradientMock),
  createPattern: vi.fn(createCanvasPatternMock),
  createRadialGradient: vi.fn(createCanvasGradientMock),
  drawImage: vi.fn(),
  ellipse: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  getImageData: vi.fn((x = 0, y = 0, width = 1, height = 1) => createImageDataMock(width, height)),
  getLineDash: vi.fn(() => []),
  isPointInPath: vi.fn(() => false),
  isPointInStroke: vi.fn(() => false),
  lineTo: vi.fn(),
  measureText: vi.fn((text = '') => ({ width: String(text).length * 8 })),
  moveTo: vi.fn(),
  putImageData: vi.fn(),
  quadraticCurveTo: vi.fn(),
  rect: vi.fn(),
  resetTransform: vi.fn(),
  restore: vi.fn(),
  rotate: vi.fn(),
  roundRect: vi.fn(),
  save: vi.fn(),
  scale: vi.fn(),
  setLineDash: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
  strokeText: vi.fn(),
  transform: vi.fn(),
  translate: vi.fn(),
});

const canvasContexts = new WeakMap();

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value(contextType) {
      if (contextType === '2d') {
        if (!canvasContexts.has(this)) {
          canvasContexts.set(this, createCanvas2dContextMock(this));
        }
        return canvasContexts.get(this);
      }
      return null;
    },
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: vi.fn(() => 'data:image/png;base64,'),
  });
}
