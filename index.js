"use strict";

const zlib = require('zlib');
const QRCode = require('qrcode-svg');

const PREAMBLE = Buffer.from('89504E470D0A1A0A', 'hex');
const IEND = Buffer.from('0000000049454E44AE426082', 'hex');
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
  const nameAndData = Buffer.concat([Buffer.from(name), data]);
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length);

  const crc32Buffer = Buffer.alloc(4);
  crc32Buffer.writeInt32BE(crc32(nameAndData));

  return Buffer.concat([lengthBuffer, nameAndData, crc32Buffer]);
}

function buildScanLine(row) {
  // A bit depth of 1 allows 8 pixels to be packed into one byte. When the
  // width is not divisible by 8, the last bite will have trailing low bits.
  // The first byte of the scanline is the filter byte.
  const nBytes = Math.ceil(row.length / 8);
  const buffer = Buffer.alloc(nBytes + 1);

  // The filter byte.
  buffer[0] = 0;

  for (let n = 0; n < nBytes; n++) {
    for (let i = 0; i < 8; i++) {
      if (row[n * 8 + i]) {
        // Flip bits in the same order as the row.
        buffer[n + 1] |= 1 << (7 - i);
      }
    }
  }

  return buffer;
}

function buildQrPng({ data, width, height, background, color }) {
  if (data.length !== width * height) {
    throw new Error("Unexpected length");
  }

  const IHDRData = Buffer.alloc(13);
  IHDRData.writeUInt32BE(width, 0);
  IHDRData.writeUInt32BE(height, 4);
  IHDRData[8] = 1; // bit depth (two possible pixel colors)
  IHDRData[9] = 3; // color type 3 (palette)
  IHDRData[10] = 0; // compression
  IHDRData[11] = 0; // filter
  IHDRData[12] = 0; // interlace (off)

  const scanlines = [];

  for (let offset = 0; offset < width * height; offset += width) {
    scanlines.push(buildScanLine(data.slice(offset, offset + width)));
  }

  const deflated = zlib.deflateSync(Buffer.concat(scanlines), {
    chunkSize: 32 * 1024,
    level: 9,
    strategy: zlib.constants.Z_RLE
  });

  return Buffer.concat([
    PREAMBLE,
    makeChunk('IHDR', IHDRData),
    makeChunk('PLTE', Buffer.from([...background, ...color])), // rgb
    makeChunk('IDAT', deflated),
    IEND
  ]);
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

  if (background.length !== 3 || !background.every(isValidByte)) {
    throw new Error('background must be a length 3 array with elements in range 0-255.');
  }

  if (color.length !== 3 || !color.every(isValidByte)) {
    throw new Error('color must be a length 3 with elements in range 0-255.');
  }

  const length = qr.qrcode.modules.length;
  const data = [];

  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      data.push(qr.qrcode.modules[j][i]);
    }
  }

  return buildQrPng({ data, width: length, height: length, background, color });
};

module.exports = makeQrPng;
