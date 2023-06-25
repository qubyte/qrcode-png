import { describe, before, it } from 'node:test';
import { strict as assert } from 'node:assert';
import qrcodePng from 'qrcode-png';
import jsQR from 'jsqr';
import { fromPng } from '@rgba-image/png';

describe('qrcode-png', () => {
  const content = 'The content, with numbers 123, 日本語, etc. etc.';

  let pngTypedArray;
  let data;
  let width;
  let height;

  describe('black and white', () => {
    before(() => {
      pngTypedArray = qrcodePng(content);
      ({ data, width, height } = fromPng(pngTypedArray));
    });

    it('creates a QR code which can be decoded', () => {
      const parsed = jsQR(data, width, height);

      assert.equal(parsed.data.trim(), content);
    });

    it('adds a padding of 4 pixels to the top by default', () => {
      const expectedEmptyRowsTopBytes = width * 4 * 4; // 4 pixels * 4 channels

      // Every channel should be 255 for opaque white pixels.
      assert.ok(data.subarray(0, expectedEmptyRowsTopBytes).every(n => n === 255));
    });

    it('adds a padding of 4 pixels to the bottom by default', () => {
      const expectedEmptyRowsBottomBytes = width * 4 * 4; // 4 pixels * 4 channels

      // Every channel should be 255 for opaque white pixels.
      assert.ok(data.subarray(-expectedEmptyRowsBottomBytes).every(n => n === 255));
    });

    it('adds a padding of 4 pixels to the start of each line by default', () => {
      const rowLength = width * 4; // 4 channels

      for (let i = 0, len = data.length; i < len; i += rowLength) {
        assert.ok(data.subarray(i, i + 4 * 4).every(n => n === 255));
      }
    });

    it('adds a padding of 4 pixels to the end of each line by default', () => {
      const rowLength = width * 4; // 4 channels

      for (let i = 0, len = data.length; i < len; i += rowLength) {
        assert.ok(data.subarray(i + rowLength - 4 * 4, i + rowLength).every(n => n === 255));
      }
    });

    it('sets non-background pixels to black', () => {
      // The top left pixel (not counting offsets) must be non-background.
      const topLeftOffset = width * 4 * 4 + 4 * 4; // 4 empty rows, plus row padding.
      const pixel = Array.from(data.subarray(topLeftOffset, topLeftOffset + 4));

      assert.deepEqual(pixel, [0, 0, 0, 255]); // rgba
    });

    it('uses only black and white for pixel colors', () => {
      for (let i = 0, len = data.length; i < len; i += 4) {
        const [r, g, b, a] = data.subarray(i, i + 4);

        assert.equal(a, 255); // alpha

        if (r === 255) {
          assert.equal(g, 255);
          assert.equal(b, 255);
        } else if (r === 0) {
          assert.equal(g, 0);
          assert.equal(b, 0);
        } else {
          throw new Error(`Unexpected red pixel value at index ${i}: [${r}, ${g}, ${b}]`);
        }
      }
    });

    it('allows padding to be set', () => {
      const pngTypedArray = qrcodePng(content, { padding: 1 });
      const { data, width, height } = fromPng(pngTypedArray);
      const parsed = jsQR(data, width, height);

      assert.equal(parsed.data.trim(), content); // Still the expected QR code.
      assert.ok(data.subarray(0, width * 4).every(n => n === 255)); // First row is padding.
      assert.ok(data.subarray(-width * 4).every(n => n === 255)); // Last row is padding.

      for (let i = 0, len = data.length; i < len; i += width * 4) {
        const row = data.subarray(i, i + width * 4);

        // First pixel in each row is padding.
        assert.deepEqual(Array.from(row.subarray(0, 4)), [255, 255, 255, 255]);

        // Last pixel in each row is padding.
        assert.deepEqual(Array.from(row.subarray(-4)), [255, 255, 255, 255]);
      }

      // First and last non-padding pixel in the first row are black.
      const firstRow = data.subarray(width * 4, width * 8);
      const firstPixel = firstRow.subarray(4, 8);
      const lastPixel = firstRow.subarray(-8, -4);

      assert.deepEqual(Array.from(firstPixel), [0, 0, 0, 255]);

      // Last non-padding pixel in first non-padding row is black.
      assert.deepEqual(Array.from(lastPixel), [0, 0, 0, 255]);
    });
  });

  describe('custom colors', () => {
    const color = [64, 128, 8];
    const background = [32, 16, 64];

    before(() => {
      pngTypedArray = qrcodePng(content, { color, background });
      ({ data, width, height } = fromPng(pngTypedArray));
    });

    it('creates a QR code which can be decoded', () => {
      const parsed = jsQR(data, width, height);

      assert.equal(parsed.data.trim(), content);
    });

    it('adds a padding of 4 pixels to the top by default', () => {
      const expectedEmptyRowsTopBytes = width * 4 * 4; // 4 pixels * 4 channels

      // Every channel should be 255 for opaque pixels.
      for (let i = 0; i < expectedEmptyRowsTopBytes; i += 4) {
        const [r, g, b, a] = data.subarray(i, i + 4);

        assert.deepEqual([r, g, b], background);
        assert.equal(a, 255);
      }
    });

    it('adds a padding of 4 pixels to the bottom by default', () => {
      const expectedEmptyRowsBottomBytes = width * 4 * 4; // 4 pixels * 4 channels

      // Every channel should be 255 for opaque pixels.
      for (let i = data.length - expectedEmptyRowsBottomBytes, len = data.length; i < len; i += 4) {
        const [r, g, b, a] = data.subarray(i, i + 4);

        assert.deepEqual([r, g, b], background);
        assert.equal(a, 255);
      }
    });

    it('adds a padding of 4 pixels to the start of each line by default', () => {
      const rowLength = width * 4; // 4 channels

      for (let i = 0, len = data.length; i < len; i += rowLength) {
        const [r, g, b, a] = data.subarray(i, i + 4);

        assert.deepEqual([r, g, b], background);
        assert.equal(a, 255);
      }
    });

    it('adds a padding of 4 pixels to the end of each line by default', () => {
      const rowLength = width * 4; // 4 channels

      for (let i = 0, len = data.length; i < len; i += rowLength) {
        const offset = rowLength - 4 * 4;
        const [r, g, b, a] = data.subarray(offset, offset + 4);

        assert.deepEqual([r, g, b], background);
        assert.equal(a, 255);
      }
    });

    it('sets non-background pixels to color', () => {
      // The top left pixel (not counting offsets) must be non-background.
      const topLeftOffset = width * 4 * 4 + 4 * 4; // 4 empty rows, plus row padding.
      const [r, g, b, a] = data.subarray(topLeftOffset, topLeftOffset + 4);

      assert.deepEqual([r, g, b], color);
      assert.deepEqual(a, 255);
    });

    it('uses only color and background for pixel colors', () => {
      for (let i = 0, len = data.length; i < len; i += 4) {
        assert.equal(data[i + 3], 255); // alpha

        if (data[i] === background[0]) {
          assert.equal(data[i + 1], background[1]);
          assert.equal(data[i + 2], background[2]);
        } else if (data[i] === color[0]) {
          assert.equal(data[i + 1], color[1]);
          assert.equal(data[i + 2], color[2]);
        } else {
          throw new Error(`Unexpected red pixel value at index ${i}: ${data[i]}`);
        }
      }
    });

    it('allows padding to be set', () => {
      const pngTypedArray = qrcodePng(content, { padding: 1, color, background });
      const { data, width, height } = fromPng(pngTypedArray);
      const parsed = jsQR(data, width, height);

      assert.equal(parsed.data.trim(), content); // Still the expected QR code.

      // First and last row are padding.
      for (let i = 0, len = width * 4; i < len; i += 4) {
        const firstRowPixel = Array.from(data.subarray(i, i + 4));
        const lastRowPixel = Array.from(data.subarray(data.length - i - 4, data.length - i));

        assert.deepEqual(firstRowPixel, [...background, 255]);
        assert.deepEqual(lastRowPixel, [...background, 255]);
      }

      for (let i = 0, len = data.length; i < len; i += width * 4) {
        const row = data.subarray(i, i + width * 4);

        // First pixel in each row is padding.
        assert.deepEqual(Array.from(row.subarray(0, 4)), [...background, 255]);

        // Last pixel in each row is padding.
        assert.deepEqual(Array.from(row.subarray(-4)), [...background, 255]);
      }

      // First and last non-padding pixel in the first row are color.
      const firstRow = data.subarray(width * 4, width * 8);
      const firstPixel = Array.from(firstRow.subarray(4, 8));
      const lastPixel = Array.from(firstRow.subarray(-8, -4));

      assert.deepEqual(firstPixel, [...color, 255]);

      // Last non-padding pixel in first non-padding row is color.
      assert.deepEqual(lastPixel, [...color, 255]);
    });
  });

  describe('custom colors with alpha', () => {
    const color = [64, 128, 8, 128];
    const background = [32, 16, 64, 192];

    before(() => {
      pngTypedArray = qrcodePng(content, { color, background });
      ({ data, width, height } = fromPng(pngTypedArray));
    });

    it('creates a QR code which can be decoded', () => {
      const parsed = jsQR(data, width, height);

      assert.equal(parsed.data.trim(), content);
    });

    it('adds a padding of 4 pixels to the top by default', () => {
      const expectedEmptyRowsTopBytes = width * 4 * 4; // 4 pixels * 4 channels

      // Every channel should be 255 for opaque pixels.
      for (let i = 0; i < expectedEmptyRowsTopBytes; i += 4) {
        assert.deepEqual(Array.from(data.subarray(i, i + 4)), background);
      }
    });

    it('adds a padding of 4 pixels to the bottom by default', () => {
      const expectedEmptyRowsBottomBytes = width * 4 * 4; // 4 pixels * 4 channels

      // Every channel should be 255 for opaque pixels.
      for (let i = data.length - expectedEmptyRowsBottomBytes, len = data.length; i < len; i += 4) {
        assert.deepEqual(Array.from(data.subarray(i, i + 4)), background);
      }
    });

    it('adds a padding of 4 pixels to the start of each line by default', () => {
      const rowLength = width * 4; // 4 channels

      for (let i = 0, len = data.length; i < len; i += rowLength) {
        assert.deepEqual(Array.from(data.subarray(i, i + 4)), background);
      }
    });

    it('adds a padding of 4 pixels to the end of each line by default', () => {
      const rowLength = width * 4; // 4 channels

      for (let i = 0, len = data.length; i < len; i += rowLength) {
        const offset = i + rowLength - 4 * 4;
        assert.deepEqual(Array.from(data.subarray(offset, offset + 4)), background);
      }
    });

    it('sets non-background pixels to color', () => {
      // The top left pixel (not counting offsets) must be non-background.
      const topLeftOffset = width * 4 * 4 + 4 * 4; // 4 empty rows, plus row padding.
      const pixel = Array.from(data.subarray(topLeftOffset, topLeftOffset + 4));

      assert.deepEqual(pixel, color);
    });

    it('uses only color and background for pixel colors', () => {
      for (let i = 0, len = data.length; i < len; i += 4) {
        const pixel = Array.from(data.subarray(i, i + 4));

        if (pixel[0] === background[0]) {
          assert.deepEqual(pixel, background);
        } else if (pixel[0] === color[0]) {
          assert.deepEqual(pixel, color);
        } else {
          throw new Error(`Unexpected red pixel value at index ${i}: ${data[i]}`);
        }
      }
    });

    it('allows padding to be set', () => {
      const pngTypedArray = qrcodePng(content, { padding: 1, color, background });
      const { data, width, height } = fromPng(pngTypedArray);
      const parsed = jsQR(data, width, height);

      assert.equal(parsed.data.trim(), content); // Still the expected QR code.

      // First and last row are padding.
      for (let i = 0, len = width * 4; i < len; i += 4) {
        const firstRowPixel = Array.from(data.subarray(i, i + 4));
        const lastRowPixel = Array.from(data.subarray(data.length - i - 4, data.length - i));

        assert.deepEqual(firstRowPixel, background);
        assert.deepEqual(lastRowPixel, background);
      }

      for (let i = 0, len = data.length; i < len; i += width * 4) {
        const row = data.subarray(i, i + width * 4);

        // First pixel in each row is padding.
        assert.deepEqual(Array.from(row.subarray(0, 4)), background);

        // Last pixel in each row is padding.
        assert.deepEqual(Array.from(row.subarray(-4)), background);
      }

      // First and last non-padding pixel in the first row are color.
      const firstRow = data.subarray(width * 4, width * 8);
      const firstPixel = Array.from(firstRow.subarray(4, 8));
      const lastPixel = Array.from(firstRow.subarray(-8, -4));

      assert.deepEqual(firstPixel, color);

      // Last non-padding pixel in first non-padding row is color.
      assert.deepEqual(lastPixel, color);
    });
  });
});
