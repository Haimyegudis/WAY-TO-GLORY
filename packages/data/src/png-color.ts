import { inflateSync } from 'node:zlib';

/**
 * Just enough of a PNG decoder to pull a club's dominant colour out of its crest,
 * which is what tints the identity card. Returns undefined for anything it cannot
 * read confidently (paletted images, greyscale marks, mostly-white crests).
 */
export function dominantColor(bytes: Buffer): string | undefined {
  try {
    if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) return undefined;

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
      } else if (type === 'IEND') {
        break;
      }
      offset += 12 + length;
    }

    if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || width === 0 || height === 0) return undefined;
    if (width * height > 4_000_000) return undefined;

    const channels = colorType === 6 ? 4 : 3;
    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const pixels = Buffer.alloc(height * stride);

    let pos = 0;
    for (let y = 0; y < height; y++) {
      const filter = raw[pos++]!;
      const line = raw.subarray(pos, pos + stride);
      pos += stride;
      const out = pixels.subarray(y * stride, (y + 1) * stride);
      const prior = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
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

    // Bucket the saturated pixels and take the heaviest bucket: crests are flat colour.
    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
    for (let i = 0; i < pixels.length; i += channels) {
      const r = pixels[i]!;
      const g = pixels[i + 1]!;
      const b = pixels[i + 2]!;
      const alpha = channels === 4 ? pixels[i + 3]! : 255;
      if (alpha < 200) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max < 45 || max - min < 28) continue;
      const key = `${Math.round(r / 48)}_${Math.round(g / 48)}_${Math.round(b / 48)}`;
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }

    let best: { count: number; r: number; g: number; b: number } | null = null;
    for (const bucket of buckets.values()) {
      if (!best || bucket.count > best.count) best = bucket;
    }
    if (!best || best.count < 20) return undefined;

    const hex = (n: number) => Math.round(n / best!.count).toString(16).padStart(2, '0');
    return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
  } catch {
    return undefined;
  }
}
