"use strict";

const pako = require('pako');
const QRCode = require('qrcode-svg');

const PREAMBLE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const IEND = Uint8Array.of(0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130);
const crcTable = new Int32Array(256);

// http://www.libpng.org/pub/png/spec/1.2/PNG-CRCAppendix.html
for (let n = 0, c = 0; n < 256; ++n, c = n) {
  for (let m = 0; m < 8; m++) {
    c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buffer) {
  let crc32 = -1;

  for (let i = 0, len = buffer.length; i < len; i++) {
    const index = (crc32 ^ buffer[i]) & 0xff;
    crc32 = (crc32 >>> 8) ^ crcTable[index];
  }

  crc32 ^= -1;

  return crc32;
}

function makeChunk(name, data) {
  const nameAndData = Uint8Array.of(
    ...Array.from(name, s => s.charCodeAt(0)),
    ...data
  );
  const crc = crc32(nameAndData);

  return Uint8Array.of(
    0xff & (data.length >> 24), // Big endian 32 bit unsigned integer.
    0xff & (data.length >> 16),
    0xff & (data.length >> 8),
    0xff & data.length,
    ...nameAndData,
    0xff & (crc >> 24), // Big endian 32 bit unsigned integer.
    0xff & (crc >> 16),
    0xff & (crc >> 8),
    0xff & crc
  );
}

function buildScanLines(data, width, height) {
  // A bit depth of 1 allows 8 pixels to be packed into one byte. When the
  // width is not divisible by 8, the last bite will have trailing low bits.
  // The first byte of the scanline is the filter byte.
  const nBytesPerRow = 1 + Math.ceil(width / 8);
  const buffer = new Uint8Array(nBytesPerRow * height);

  for (let scanline = 0; scanline < height; scanline++) {
    const offset = nBytesPerRow * scanline;

    // The filter byte.
    buffer[offset] = 0;

    for (let n = 0; n < nBytesPerRow - 1; n++) {
      for (let i = 0; i < 8; i++) {
        if (data[scanline][n * 8 + i]) {
          // Flip bits in the same order as the row.
          buffer[offset + n + 1] |= 1 << (7 - i);
        }
      }
    }
  }

  return buffer;
}

function buildQrPng({ data, background, color }) {
  const height = data.length;
  const width = height;
  const IHDRData = Uint8Array.of(
    255 & (width >> 24), // Big endian 32 bit unsigned integer.
    255 & (width >> 16),
    255 & (width >> 8),
    255 & width,
    255 & (height >> 24), // Big endian 32 bit unsigned integer.
    255 & (height >> 16),
    255 & (height >> 8),
    255 & height,
    1, // bit depth (two possible pixel colors)
    3, // color type 3 (palette)
    0, // compression
    0, // filter
    0  // interlace (off)
  );

  const scanlines = buildScanLines(data, width, height);
  const deflated = pako.deflate(scanlines, {
    level: 9,
    strategy: 3
  });

  const backgroundRgb = background.slice(0, 3);
  const backgroundAlpha = typeof background[3] === "number" ? background[3] : 255;
  const colorRgb = color.slice(0, 3);
  const colorAlpha = typeof color[3] === "number" ? color[3] : 255;
  const hasAlpha = backgroundAlpha !== 255 || colorAlpha !== 255;

  // When no colors in the palette have an associated alpha value, we can skip
  // the tRNS (transparency) chunk completely.

  return Uint8Array.of(
    ...PREAMBLE,
    ...makeChunk('IHDR', IHDRData),
    ...makeChunk('PLTE', [...backgroundRgb, ...colorRgb]),
    // When no colors in the palette have an associated alpha value, we can skip
    // the tRNS (transparency) chunk completely.
    ...(hasAlpha ? makeChunk("tRNS", [backgroundAlpha, colorAlpha]) : []), // alpha
    ...makeChunk('IDAT', deflated),
    ...IEND
  );
}

function isValidByte(n) {
  return Number.isInteger(n) && n >= 0 && n < 256;
}

function makeQrPng(options) {
  let qr;
  let color;
  let background;
  let qrOptions;

  if (typeof options === 'string') {
    qr = new QRCode(options);
    color = [0, 0, 0];
    background = [255, 255, 255];
  } else {
    ({ color = [0, 0, 0], background = [255, 255, 255], ...qrOptions } = options);
    qr = new QRCode(qrOptions);
  }

  if ((background.length !== 3 && background.length !== 4) || !background.every(isValidByte)) {
    throw new Error('background must be a length 3 or 4 array with elements in range 0-255.');
  }

  if ((color.length !== 3 && color.length !== 4) || !color.every(isValidByte)) {
    throw new Error('color must be a length 3 or 4 with elements in range 0-255.');
  }

  const data = qr.qrcode.modules;

  return buildQrPng({ data, background, color });
};

module.exports = makeQrPng;
