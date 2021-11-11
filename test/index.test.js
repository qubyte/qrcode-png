import { strict as assert } from 'assert';
import qrcodePng from 'qrcode-png';
import jsQR from 'jsqr';
import { fromPng } from '@rgba-image/png';

describe('qrcode-png', () => {
  it('creates a QR code which can be decoded', () => {
    const content = 'The content, with numbers 123, CJK 日本語, but no emoji yet :/';
    const pngTypedArray = qrcodePng(content);
    const { data, width, height } = fromPng(pngTypedArray);
    const parsed = jsQR(data, width, height);

    assert.equal(parsed.data.trim(), content);
  });
});
