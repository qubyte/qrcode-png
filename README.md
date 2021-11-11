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

const pngTypedArray = qrcode(options);
```

The return value of `qrcode` is an instance of `Uint8Array`. If you're using it
in Node.js, many core libraries will accept it as a substitute for a buffer. Any
time you need a buffer you can wrap the `Uint8Array` in one:

```javascript
const pngBuffer = Buffer.from(qrcode(options));
```

## Options:

Options is a string (the content), or an object with these fields:

* **content** - QR Code content, required.
* **padding** - Background colored padding around the QR code, `4` modules by default, `0` for no border.
* **color** - color of modules (squares), a length 3 (or 4 if you want to include alpha) array RGB values in the range 0-255, e.g. `[0, 0, 0]` for black.
* **background** - color of background, a length 3 (or 4 if you want to include alpha) array RGB values in the range 0-255, e.g. `[255, 255, 255]` for white.
* **ecl** - error correction level: `L`, `M`, `H`, `Q`

## Writing to a file

This library returns a TypedArray, which you can pass directly to an `fs`
method.

```javascript
const fs = require('fs');
const qrcode = require('qrcode-png');

const pngTypedArray = qrcode(options);

fs.writeFileSync('./my-qr-code.png', pngTypedArray);
```

## Use in the browser

To use this library in the browser it must be bundled with [pako] and
[qrcode-svg]. A bundler such as webpack or rollup with CommonJS and node module
resolution plugins will do the job.

## About the images produced

This library produces PNGs with a pixel per module (square). To be useful the
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

In Node:

```javascript
const pngBuffer = Buffer.from(qrcode("Hello, world!"));
const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
```

In a browser (also works in Node 16+, but it's [better to use a buffer]
there):

```javascript
const pngTypedArray = qrcode("Hello, world!");
const dataUrl = `data:image/png;base64,${atob(String.fromCharCode(...dat))}`;
```

[qrcode-svg]: https://npmjs.com/package/qrcode-svg
[better to use a buffer]: https://nodejs.org/dist/latest-v16.x/docs/api/globals.html#atobdata
