/**
 * Minimal PNG decoder for Playwright screenshots (8-bit RGB or RGBA).
 */
import zlib from "node:zlib";

export class PNG {
  width: number;
  height: number;
  data: Uint8Array;

  constructor(width: number, height: number, data: Uint8Array) {
    this.width = width;
    this.height = height;
    this.data = data;
  }

  static decode(buf: Buffer): PNG {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (buf.length < 8 || !buf.subarray(0, 8).equals(sig)) {
      throw new Error("not a PNG");
    }
    let offset = 8;
    let width = 0;
    let height = 0;
    let colorType = 6;
    const idat: Buffer[] = [];
    while (offset < buf.length) {
      const len = buf.readUInt32BE(offset);
      const type = buf.toString("ascii", offset + 4, offset + 8);
      const data = buf.subarray(offset + 8, offset + 8 + len);
      offset += 12 + len;
      if (type === "IHDR") {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        const bitDepth = data[8];
        colorType = data[9]!;
        if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
          throw new Error(`unsupported PNG ihdr ${bitDepth}/${colorType}`);
        }
      } else if (type === "IDAT") {
        idat.push(Buffer.from(data));
      } else if (type === "IEND") {
        break;
      }
    }
    const inflated = zlib.inflateSync(Buffer.concat(idat));
    const bpp = colorType === 6 ? 4 : 3;
    const stride = width * bpp;
    const rgba = new Uint8Array(width * height * 4);
    let ip = 0;
    let op = 0;
    const prev = new Uint8Array(stride);
    for (let y = 0; y < height; y++) {
      const filter = inflated[ip++]!;
      const row = inflated.subarray(ip, ip + stride);
      ip += stride;
      const cur = new Uint8Array(stride);
      for (let i = 0; i < stride; i++) {
        const raw = row[i]!;
        const a = i >= bpp ? cur[i - bpp]! : 0;
        const b = prev[i]!;
        const c = i >= bpp ? prev[i - bpp]! : 0;
        let val = raw;
        if (filter === 1) val = (raw + a) & 255;
        else if (filter === 2) val = (raw + b) & 255;
        else if (filter === 3) val = (raw + Math.floor((a + b) / 2)) & 255;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          val = (raw + pr) & 255;
        } else if (filter !== 0) {
          throw new Error(`bad png filter ${filter}`);
        }
        cur[i] = val;
      }
      if (bpp === 4) {
        rgba.set(cur, op);
        op += stride;
      } else {
        for (let x = 0; x < width; x++) {
          rgba[op++] = cur[x * 3]!;
          rgba[op++] = cur[x * 3 + 1]!;
          rgba[op++] = cur[x * 3 + 2]!;
          rgba[op++] = 255;
        }
      }
      prev.set(cur);
    }
    return new PNG(width, height, rgba);
  }
}
