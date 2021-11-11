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
  const chunk = new Uint8Array(4 + name.length + data.length + 4)
  const view = new DataView(chunk.buffer);
  const nameOffset = 4;
  const dataOffset = nameOffset + name.length;
  const crcOffset = dataOffset + data.length;

  // Set the length bytes.
  view.setUint32(0, data.length, false);

  // Set the name bytes.
  for (let i = 0, len = name.length; i < len; i++) {
    chunk[nameOffset + i] = name[i].charCodeAt(0);
  }

  // Set the data bytes.
  chunk.set(data, dataOffset);

  // Calculate the CRC from the name and data bytes.
  const crc = crc32(chunk.subarray(nameOffset, crcOffset));

  // Set the CRC bytes.
  view.setUint32(crcOffset, crc);

  return chunk;
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
          buffer[offset + n + 1] += 1 << (7 - i);
        }
      }
    }
  }

  return buffer;
}

function makeHeaderData(width, height) {
  const IHDRData = Uint8Array.of(
    0,0,0,0, // The width will go here.
    0,0,0,0, // The height will go here.
    1, // bit depth (two possible pixel colors)
    3, // color type 3 (palette)
    0, // compression
    0, // filter
    0  // interlace (off)
  );

  // Width and height are set in network byte order.
  const view = new DataView(IHDRData.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);

  return IHDRData;
}

function makeIdatData(data, width, height) {
  return pako.deflate(buildScanLines(data, width, height), { level: 9, strategy: 3 });
}

function buildQrPng({ data, background, color }) {
  const height = data.length;
  const width = height;

  const backgroundRgb = background.slice(0, 3);
  const backgroundAlpha = typeof background[3] === "number" ? background[3] : 255;
  const colorRgb = color.slice(0, 3);
  const colorAlpha = typeof color[3] === "number" ? color[3] : 255;
  const hasAlpha = backgroundAlpha !== 255 || colorAlpha !== 255;

  // When no colors in the palette have an associated alpha value, we can skip
  // the tRNS (transparency) chunk completely.

  return Uint8Array.of(
    ...PREAMBLE,
    ...makeChunk('IHDR', makeHeaderData(width, height)),
    ...makeChunk('PLTE', [...backgroundRgb, ...colorRgb]),
    // When no colors in the palette have an associated alpha value, we can skip
    // the tRNS (transparency) chunk completely.
    ...(hasAlpha ? makeChunk("tRNS", [backgroundAlpha, colorAlpha]) : []), // alpha
    ...makeChunk('IDAT', makeIdatData(data, width, height)),
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
