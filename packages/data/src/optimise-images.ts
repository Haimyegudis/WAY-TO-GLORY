/**
 * Downscales the artwork in app/public/bg so the installed app does not carry
 * several megabytes of background per screen. Decodes and re-encodes PNG with
 * nothing but zlib, which is enough for flat artwork and photographs at this size.
 */
import { readFile, readdir, rename, writeFile, unlink } from 'node:fs/promises';
import { deflateSync, inflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bgDir = join(here, '..', '..', 'app', 'public', 'bg');

const MAX_WIDTH = 1080;

interface Image {
  width: number;
  height: number;
  pixels: Buffer; // RGBA
}

function decodePng(bytes: Buffer): Image | null {
  if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idat: Buffer[] = [];

  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    offset += 12 + length;
  }

  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) return null;
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const lines = Buffer.alloc(height * stride);

  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++]!;
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const out = lines.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? lines.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels]! : 0;
      const b = prior[x]!;
      const c = x >= channels ? prior[x - channels]! : 0;
      const value = line[x]!;
      let recon: number;
      switch (filter) {
        case 0: recon = value; break;
        case 1: recon = value + a; break;
        case 2: recon = value + b; break;
        case 3: recon = value + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          recon = value + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: recon = value;
      }
      out[x] = recon & 0xff;
    }
  }

  // Normalise to RGBA so the resampler has one shape to deal with.
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < lines.length; i += channels, j += 4) {
    pixels[j] = lines[i]!;
    pixels[j + 1] = lines[i + 1]!;
    pixels[j + 2] = lines[i + 2]!;
    pixels[j + 3] = channels === 4 ? lines[i + 3]! : 255;
  }
  return { width, height, pixels };
}

/** Box filter: averages the source block behind each destination pixel. */
function downscale(image: Image, targetWidth: number): Image {
  if (image.width <= targetWidth) return image;
  const scale = image.width / targetWidth;
  const width = targetWidth;
  const height = Math.max(1, Math.round(image.height / scale));
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * scale);
    const y1 = Math.min(image.height, Math.floor((y + 1) * scale));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * scale);
      const x1 = Math.min(image.width, Math.floor((x + 1) * scale));
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let sy = y0; sy < Math.max(y0 + 1, y1); sy++) {
        for (let sx = x0; sx < Math.max(x0 + 1, x1); sx++) {
          const at = (sy * image.width + sx) * 4;
          r += image.pixels[at]!;
          g += image.pixels[at + 1]!;
          b += image.pixels[at + 2]!;
          a += image.pixels[at + 3]!;
          count++;
        }
      }
      const to = (y * width + x) * 4;
      pixels[to] = Math.round(r / count);
      pixels[to + 1] = Math.round(g / count);
      pixels[to + 2] = Math.round(b / count);
      pixels[to + 3] = Math.round(a / count);
    }
  }
  return { width, height, pixels };
}

function crc32(buf: Buffer): number {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function encodePng(image: Image): Buffer {
  // Drop alpha: these are opaque photographs, and RGB is a third smaller.
  const stride = image.width * 3;
  const raw = Buffer.alloc(image.height * (stride + 1));
  for (let y = 0; y < image.height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 1; // Sub filter compresses photographs better than none.
    for (let x = 0; x < image.width; x++) {
      const from = (y * image.width + x) * 4;
      const to = rowStart + 1 + x * 3;
      const left = x > 0 ? (y * image.width + x - 1) * 4 : -1;
      for (let c = 0; c < 3; c++) {
        const value = image.pixels[from + c]!;
        const prior = left >= 0 ? image.pixels[left + c]! : 0;
        raw[to + c] = (value - prior) & 0xff;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main(): Promise<void> {
  const files = await readdir(bgDir);

  // Anything saved as "hero.jpg.png" is really a PNG; give it its proper name.
  for (const file of files) {
    if (file.endsWith('.jpg.png')) {
      await rename(join(bgDir, file), join(bgDir, file.replace('.jpg.png', '.png')));
    }
  }

  for (const file of await readdir(bgDir)) {
    if (!file.endsWith('.png')) continue;
    const path = join(bgDir, file);
    const bytes = await readFile(path);
    const image = decodePng(bytes);
    if (!image) {
      console.log(`  ${file}: not a plain PNG, left alone`);
      continue;
    }
    const scaled = downscale(image, MAX_WIDTH);
    if (scaled === image && bytes.length < 900_000) {
      console.log(`  ${file}: already small enough`);
      continue;
    }
    const encoded = encodePng(scaled);
    await writeFile(path, encoded);
    console.log(
      `  ${file}: ${image.width}x${image.height} ${(bytes.length / 1024 / 1024).toFixed(1)}MB -> ` +
        `${scaled.width}x${scaled.height} ${(encoded.length / 1024).toFixed(0)}KB`,
    );
  }

  // A stray empty credits file from an earlier experiment.
  if ((await readdir(bgDir)).includes('credits.json')) {
    const credits = await readFile(join(bgDir, 'credits.json'), 'utf8');
    if (credits.trim() === '{}') await unlink(join(bgDir, 'credits.json'));
  }
}

void main();
