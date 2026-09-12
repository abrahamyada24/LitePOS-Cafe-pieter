const ESC = 0x1b;
const GS = 0x1d;

const normalizePrinterText = (value) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/[–—]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x0a\x20-\x7e]/g, '?');

const createLogoRasterCommand = (
  bitmap,
  width,
  height,
  { canvasWidth = 180, canvasHeight = 90, threshold = 180 } = {},
) => {
  if (!Buffer.isBuffer(bitmap) || width <= 0 || height <= 0 || bitmap.length < width * height * 4) {
    throw new Error('Bitmap logo tidak valid.');
  }

  const luminance = new Float32Array(canvasWidth * canvasHeight);
  luminance.fill(255);
  const offsetX = Math.max(0, Math.floor((canvasWidth - width) / 2));
  const offsetY = Math.max(0, Math.floor((canvasHeight - height) / 2));
  const copyWidth = Math.min(width, canvasWidth);
  const copyHeight = Math.min(height, canvasHeight);

  for (let y = 0; y < copyHeight; y += 1) {
    for (let x = 0; x < copyWidth; x += 1) {
      const source = (y * width + x) * 4;
      // Electron's Windows bitmap representation is BGRA.
      const blue = bitmap[source];
      const green = bitmap[source + 1];
      const red = bitmap[source + 2];
      const alpha = bitmap[source + 3] / 255;
      const gray = (red * 0.299) + (green * 0.587) + (blue * 0.114);
      luminance[((y + offsetY) * canvasWidth) + x + offsetX] = 255 - ((255 - gray) * alpha);
    }
  }

  const bytesPerRow = Math.ceil(canvasWidth / 8);
  const raster = Buffer.alloc(bytesPerRow * canvasHeight, 0);
  for (let y = 0; y < canvasHeight; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) {
      const index = (y * canvasWidth) + x;
      const oldValue = luminance[index];
      const newValue = oldValue < threshold ? 0 : 255;
      const error = oldValue - newValue;

      if (newValue === 0) {
        raster[(y * bytesPerRow) + Math.floor(x / 8)] |= 0x80 >> (x % 8);
      }

      if (x + 1 < canvasWidth) luminance[index + 1] += error * (7 / 16);
      if (y + 1 < canvasHeight) {
        if (x > 0) luminance[index + canvasWidth - 1] += error * (3 / 16);
        luminance[index + canvasWidth] += error * (5 / 16);
        if (x + 1 < canvasWidth) luminance[index + canvasWidth + 1] += error * (1 / 16);
      }
    }
  }

  const header = Buffer.from([
    GS, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    canvasHeight & 0xff,
    (canvasHeight >> 8) & 0xff,
  ]);
  return Buffer.concat([header, raster]);
};

const buildReceiptCommand = ({ text, logoRasterCommand = null }) => {
  const chunks = [
    Buffer.from([ESC, 0x40]),
    Buffer.from([ESC, 0x74, 0x00]),
    Buffer.from([ESC, 0x21, 0x00]),
    Buffer.from([ESC, 0x4d, 0x00]),
    Buffer.from([ESC, 0x20, 0x00]),
    Buffer.from([GS, 0x21, 0x00]),
  ];

  if (logoRasterCommand) {
    chunks.push(
      Buffer.from([ESC, 0x61, 0x01]),
      logoRasterCommand,
      Buffer.from([0x0a]),
    );
  }

  chunks.push(
    Buffer.from([ESC, 0x61, 0x00]),
    Buffer.from(normalizePrinterText(text), 'ascii'),
  );

  return Buffer.concat(chunks);
};

module.exports = {
  buildReceiptCommand,
  createLogoRasterCommand,
  normalizePrinterText,
};
