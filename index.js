import { deflate } from 'pako';
import QRCode from 'qrcode-svg';

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
    const index = (crc32 ^ buffer[i]) & 255;
    crc32 = (crc32 >>> 8) ^ crcTable[index];
  }

  crc32 ^= -1;

  return crc32;
}

function makeChunk(name, data) {
  const chunk = new Uint8Array(4 + name.length + data.length + 4);
  const view = new DataView(chunk.buffer);
  const nameOffset = 4;
  const dataOffset = nameOffset + name.length;
  const crcOffset = dataOffset + data.length;

  // Set the length bytes.
  view.setUint32(0, data.length, false);

  // Set the name bytes.
  for (let i = 0, len = name.length; i < len; i++) {
    chunk[nameOffset + i] = name.charCodeAt(i);
  }

  // Set the data bytes.
  chunk.set(data, dataOffset);

  // Calculate the CRC from the name and data bytes.
  const crc = crc32(chunk.subarray(nameOffset, crcOffset));

  // Set the CRC bytes.
  view.setUint32(crcOffset, crc, false);

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
    0, 0, 0, 0, // The width will go here.
    0, 0, 0, 0, // The height will go here.
    1, // bit depth (two possible pixel colors)
    3, // color type 3 (palette)
    0, // compression
    0, // filter
    0 // interlace (off)
  );

  // Width and height are set in network byte order.
  const view = new DataView(IHDRData.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);

  return IHDRData;
}

function makeIdatData(data, width, height) {
  return deflate(buildScanLines(data, width, height), { level: 9, strategy: 3 });
}

class SerializableUint8Array extends Uint8Array {
  toHex() {
    return Array.from(this, code => code.toString(16)).join('');
  }

  toBase64() {
    // In Node a Buffer is the best way to get a base64 string, and we can do it
    // without copying by passing Buffer.from the underlying ArrayBuffer.
    /* eslint-disable no-undef */
    if (typeof Buffer === 'function' && typeof Buffer.from === 'function') {
      return Buffer.from(this.buffer).toString('base64');
    }
    /* eslint-enable no-undef */

    // In a browser we fall back to using btoa. We're dealing strictly with 1
    // byte characters so it's safe to use btoa in this case.

    // String.fromCharCode can take more than one argument, so up to some length
    // we could do String.fromCharCode(...this). It's risky for large values
    // though!
    return btoa(Array.from(this, code => String.fromCharCode(code)).join(''));
  }

  toDataUrl() {
    return `data:image/png;base64,${this.toBase64()}`;
  }
}

function buildQrPng({ data, background, color }) {
  const height = data.length;
  const width = height;

  const backgroundRgb = background.slice(0, 3);
  const backgroundAlpha = typeof background[3] === 'number' ? background[3] : 255;
  const colorRgb = color.slice(0, 3);
  const colorAlpha = typeof color[3] === 'number' ? color[3] : 255;
  const hasAlpha = backgroundAlpha !== 255 || colorAlpha !== 255;

  // When no colors in the palette have an associated alpha value, we can skip
  // the tRNS (transparency) chunk completely.

  return SerializableUint8Array.of(
    ...PREAMBLE,
    ...makeChunk('IHDR', makeHeaderData(width, height)),
    ...makeChunk('PLTE', [...backgroundRgb, ...colorRgb]),
    // When no colors in the palette have an associated alpha value, we can skip
    // the tRNS (transparency) chunk completely.
    ...(hasAlpha ? makeChunk('tRNS', [backgroundAlpha, colorAlpha]) : []), // alpha
    ...makeChunk('IDAT', makeIdatData(data, width, height)),
    ...IEND
  );
}

function isValidByte(n) {
  return Number.isInteger(n) && n >= 0 && n < 256;
}

function addPadding(modules, padding) {
  const width = modules.length + padding * 2;
  const pad = Array(padding).fill(false);
  const data = [];

  // Top padding rows.
  for (let i = 0; i < padding; i++) {
    data.push(Array(width).fill(false));
  }
  // Padded data rows.
  for (const row of modules) {
    data.push(pad.concat(row).concat(pad));
  }
  // Bottom padding rows.
  for (let i = 0; i < padding; i++) {
    data.push(Array(width).fill(false));
  }

  return data;
}

export default function makeQrPng(options) {
  let qr;
  let color = [0, 0, 0];
  let background = [255, 255, 255];
  let padding = 4;
  let qrOptions;

  if (typeof options === 'string') {
    qr = new QRCode(options);
  } else {
    ({ color = [0, 0, 0], background = [255, 255, 255], padding = 4, ...qrOptions } = options);
    qr = new QRCode(qrOptions);
  }

  if ((background.length !== 3 && background.length !== 4) || !background.every(isValidByte)) {
    throw new Error('background must be a length 3 or 4 array with elements in range 0-255.');
  }

  if ((color.length !== 3 && color.length !== 4) || !color.every(isValidByte)) {
    throw new Error('color must be a length 3 or 4 with elements in range 0-255.');
  }

  // While the padding option does the same (including the default) as in
  // qrcode-svg, the padding isn't part of the data returned by that module,
  // so it has to be added.
  const data = addPadding(qr.qrcode.modules, padding);

  return buildQrPng({ data, background, color });
}
