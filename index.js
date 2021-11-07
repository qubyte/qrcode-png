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

function buildQrPng(data, width, height) {
  if (data.length !== width * height) {
    throw new Error("Unexpected length");
  }

  const IHDRData = Buffer.alloc(13);
  IHDRData.writeUInt32BE(width, 0);
  IHDRData.writeUInt32BE(height, 4);
  IHDRData[8] = 8; // bit depth, TODO: make this 1 if possible.
  IHDRData[9] = 3; // color type 3 (palette)
  IHDRData[10] = 0; // compression
  IHDRData[11] = 0; // filter
  IHDRData[12] = 0; // interlace (off)

  const scanlines = Buffer.alloc((width + 1) * height);

  for (let n = 0, i = 0; n < data.length; n++, i++) {
    if (n % width === 0) {
      scanlines[i] = 0; // filter byte prepended to each scanline.
      i += 1;
    }

    scanlines[i] = data[n] ? 1 : 0;
  }

  const deflated = zlib.deflateSync(scanlines, {
    chunkSize: 32 * 1024,
    level: 9,
    strategy: zlib.constants.Z_RLE
  });

  return Buffer.concat([
    PREAMBLE,
    makeChunk('IHDR', IHDRData),
    makeChunk('PLTE', Buffer.from('FFFFFF000000', 'hex')), // rgb
    makeChunk('IDAT', deflated),
    IEND
  ]);
}

function makeQrPng(content) {
  const qr = new QRCode(content);
  const length = qr.qrcode.modules.length;
  const data = [];

  for (let i = 0; i < length; i++) {
    for (let j = 0; j < length; j++) {
      data.push(qr.qrcode.modules[j][i]);
    }
  }

  return buildQrPng(data, length, length);
};

module.exports = makeQrPng;
