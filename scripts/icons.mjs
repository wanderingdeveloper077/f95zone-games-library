import { scalePng, scaleRgba } from "./png.mjs";

export const WINDOWS_ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];

const ICNS_TYPES = [
  ["icp4", 16],
  ["ic11", 32],
  ["icp5", 32],
  ["ic12", 64],
  ["icp6", 64],
  ["ic07", 128],
  ["ic13", 256],
  ["ic08", 256],
  ["ic14", 512],
  ["ic09", 512],
  ["ic10", 1024],
];

export function encodeDibIcon(rgba, size) {
  const xorStride = size * 4;
  const maskStride = Math.ceil(size / 32) * 4;
  const dib = Buffer.alloc(40 + xorStride * size + maskStride * size);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(size, 4);
  dib.writeInt32LE(size * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  for (let y = 0; y < size; y += 1) {
    const source = (size - 1 - y) * size * 4;
    const target = 40 + y * xorStride;
    for (let x = 0; x < size; x += 1) {
      const from = source + x * 4;
      const to = target + x * 4;
      dib[to] = rgba[from + 2];
      dib[to + 1] = rgba[from + 1];
      dib[to + 2] = rgba[from];
      dib[to + 3] = rgba[from + 3];
    }
  }
  return dib;
}

export function buildWindowsIcons(source) {
  return WINDOWS_ICON_SIZES.map((size) => ({
    size,
    dib: encodeDibIcon(scaleRgba(source, size), size),
    png: size >= 256 ? scalePng(source, size) : null,
  }));
}

export function encodeIcns(source) {
  const chunks = ICNS_TYPES.map(([type, size]) => {
    const png = scalePng(source, size);
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, "ascii");
    header.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([header, png]);
  });
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write("icns", 0, 4, "ascii");
  header.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([header, body]);
}
