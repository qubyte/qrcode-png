# qrcode-png

Make a QR code PNG from a string. This module uses the [qrcode-svg] module
internally, and inherits some of its options. PNGs created by this library are
more efficiently encoded than
[those created by the most popular alternative](#benchmarks) thanks to a PNG
encoder designed for the specific use case of QR codes.

## Install

```shell
npm i qrcode-png
```

## Usage

```javascript
const qrcode = require('qrcode-png');

const pngTypedArray = qrcode(content, options);
```

The return value of `qrcode` is an instance of [`Uint8Array`][Uint8Array]. If
you're using it in Node.js, many core libraries will accept it as a substitute
for a buffer. Any time you need a buffer you can wrap the `Uint8Array` in one
without copying:

```javascript
const pngBuffer = Buffer.from(qrcode(content, options).buffer);
```

## `content`

`content` is the string you want encoded in the QR code. It must be a string
with length greater than 0.

## `options`

`options` is an optional object with these fields:

* **padding** - Background colored padding around the QR code, `4` modules by default, `0` for no border.
* **color** - color of modules (squares), a length 3 (or 4 if you want to include alpha) array RGB values in the range 0-255, e.g. `[0, 0, 0]` for black. The default is black.
* **background** - color of background, a length 3 (or 4 if you want to include alpha) array RGB values in the range 0-255, e.g. `[255, 255, 255]` for white. The default is white.
* **ecl** - error correction level: `L`, `M`, `H`, `Q`. Default `M`.
* **deflate** - a deflate implementation such as Node's `zlib.deflateSync` or `pako.deflate`. Curry it with options you want it to use. By default a function is used which creates a valid PNG, but does not compress data. You may find it sufficient.

## Writing to a file

This library returns a TypedArray, which you can pass directly to an `fs`
method.

```javascript
const fs = require('fs');
const qrcode = require('qrcode-png');

const pngTypedArray = qrcode(content);

fs.writeFileSync('./my-qr-code.png', pngTypedArray);
```

## Customizing the deflate implementation

It's possible (and enouraged in Node) to pass in a custom deflate function. For
the browser, [pako] has a similar `deflate` function.

```javascript
const fs = require('fs');
const zlib = require('zlib');
const qrcode = require('qrcode-png');

function deflate(buffer) {
  return zlib.deflateSync(buffer, { level: zlib.constants.Z_BEST_COMPRESSION });
}

const pngTypedArray = qrcode(content, { deflate });
```

## Use in the browser

A bundler such as webpack or rollup with CommonJS and node module resolution
must be used to bundle the [qrcode-svg] module this package depends on. [pako]
is recommended for better `deflate` compression.

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

If you want to inline the png in your HTML a convenience method is provided:

```javascript
const dataUrl = qrcode("Hello, world!").toDataUrl();
```

## Benchmarks

In informal benchmarks against [`qrcode`][qrcode] (which provides similar
functionality for PNG data URLS), this library generates URLs in about half the
time and the results are about 25% of the size (a considerable saving) for the
same error correction level. **No claim is made of a fair test!** If your use
case is performance sensitive you should do your own analysis for your use case.

Some speculation: The savings seen from this library are likely due to a
combination of factors, but a large part is that this library uses color-type 0
(for the default black and white) or 3 for PNG encoding, in both cases with a
bit depth of 1 (a very compact representation). [`qrcode`][qrcode] uses
[`pngjs`][pngjs], which does not support writing color-type 3 PNGs.
[`qrcode`][qrcode] produces color-type 6 PNGs (truecolor with alpha), with a bit
depth of 8. Filters (which [`pngjs`][pngjs] has advanced behaviour for but which
this library does not) may recover some of the space wasted by the higher bit
depth.

[Uint8Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array
[qrcode-svg]: https://npmjs.com/package/qrcode-svg
[pako]: https://npmjs.com/package/pako
[better to use a buffer]: https://nodejs.org/dist/latest-v16.x/docs/api/globals.html#atobdata
[qrcode]: https://npmjs.com/package/qrcode
[pngjs]: https://npmjs.com/package/pngjs
