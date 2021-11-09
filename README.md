# qrcode-png

Make a QR code PNG from a string. This module uses the [qrcode-svg] module
internally, and inherits some of its options.

## Install

```shell
npm i qrcode-png
```

## Usage

```javascript
const qrcode = require('qrcode-png');

const pngBuffer = qrcode(options);
```

## Options:

Options is a string (the content), or an object with these fields:

* **content** - QR Code content, required.
* **padding** - Background colored padding around the QR code, `4` modules by default, `0` for no border.
* **color** - color of modules (squares), a length 3 (or 4 if you want to include alpha) array RGB values in the range 0-255, e.g. `[0, 0, 0]` for black.
* **background** - color of background, a length 3 (or 4 if you want to include alpha) array RGB values in the range 0-255, e.g. `[255, 255, 255]` for white.
* **ecl** - error correction level: `L`, `M`, `H`, `Q`

## Writing to a file

This library returns a buffer, which you can pass directly to an `fs` method.

```javascript
const fs = require('fs');
const qrcode = require('qrcode-png');

const pngBuffer = qrcode(options);

fs.writeFileSync('./my-qr-code.png', pngBuffer);
```

## Use in the browser

This library produces PNGs with a pixel permodule (square). To be useful the
width and height should be set, and some styles applied to avoid it looking
blurry.

```html
<img class="qr" src"./my-qr-code.png" width="100" height="100">
```

```css
img.qr {
  text-align: center;
  image-rendering: auto;
  image-rendering: crisp-edges;
  image-rendering: optimize-contrast;
  image-rendering: optimizeSpeed;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: pixelated;
}
```

If you want to inline the png in your HTML, convert it to a data URL:

```javascript
const qrcode = require('qrcode-png');
const pngBuffer = qrcode("Hello, world!");

const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
```
