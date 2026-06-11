import fs from 'node:fs/promises';
import sharp from 'sharp';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const input = args.get('--input');
const out = args.get('--out');
const transparentThreshold = Number(args.get('--transparent-threshold') || 28);
const opaqueThreshold = Number(args.get('--opaque-threshold') || 155);

if (!input || !out) {
  console.error('Usage: node remove-chroma-key.mjs --input in.png --out out.png');
  process.exit(1);
}

const image = sharp(input).ensureAlpha();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const samples = [];
const samplePixel = (x, y) => {
  const offset = (y * width + x) * channels;
  samples.push([data[offset], data[offset + 1], data[offset + 2]]);
};

for (let x = 0; x < width; x += 1) {
  samplePixel(x, 0);
  samplePixel(x, height - 1);
}
for (let y = 1; y < height - 1; y += 1) {
  samplePixel(0, y);
  samplePixel(width - 1, y);
}

const median = (channel) => {
  const values = samples.map((sample) => sample[channel]).sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
};

const key = [median(0), median(1), median(2)];
const distance = (r, g, b) => Math.hypot(r - key[0], g - key[1], b - key[2]);

for (let offset = 0; offset < data.length; offset += channels) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const sourceAlpha = data[offset + 3];
  const dist = distance(r, g, b);

  let alpha = sourceAlpha;
  if (dist <= transparentThreshold) {
    alpha = 0;
  } else if (dist < opaqueThreshold) {
    const t = (dist - transparentThreshold) / (opaqueThreshold - transparentThreshold);
    alpha = Math.round(sourceAlpha * Math.min(1, Math.max(0, t ** 1.35)));
  }

  if (alpha < sourceAlpha) {
    const spill = (1 - alpha / 255) * 0.55;
    data[offset] = Math.round(r * (1 - spill) + Math.min(r, g + 42) * spill);
    data[offset + 2] = Math.round(b * (1 - spill) + Math.min(b, g + 42) * spill);
  }

  data[offset + 3] = alpha;
}

await fs.mkdir(new URL('.', `file:///${out.replaceAll('\\', '/')}`).pathname, { recursive: true }).catch(() => {});
await sharp(data, { raw: { width, height, channels } }).png().toFile(out);

console.log(`${out} ${width}x${height} alpha key=${key.join(',')}`);
