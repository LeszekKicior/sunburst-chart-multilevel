let measureCtx = null;
const textWidthCache = new Map();
const MAX_TEXT_WIDTH_CACHE_SIZE = 5000;

function getMeasureCtx() {
  if (measureCtx) return measureCtx;

  if (typeof OffscreenCanvas !== 'undefined') {
    measureCtx = new OffscreenCanvas(0, 0).getContext('2d');
  } else if (typeof document !== 'undefined') {
    const canvasEl = document.createElement('canvas');
    measureCtx = canvasEl.getContext('2d');
  }

  return measureCtx;
}

const measureTextWidth = (
  text,
  fontSize = 16,
  { strokeWidth = 1, fontFamily = 'sans-serif' } = {},
) => {
  const strText = text == null ? '' : String(text);
  const cacheKey = `${fontFamily}|${fontSize}|${strokeWidth}|${strText}`;
  const cachedValue = textWidthCache.get(cacheKey);
  if (cachedValue != null) return cachedValue;

  const ctx = getMeasureCtx();
  if (!ctx) return 0;

  ctx.font = `${fontSize}px ${fontFamily}`;
  const width = ctx.measureText(strText).width + strokeWidth;

  textWidthCache.set(cacheKey, width);
  if (textWidthCache.size > MAX_TEXT_WIDTH_CACHE_SIZE) {
    const oldestKey = textWidthCache.keys().next().value;
    oldestKey != null && textWidthCache.delete(oldestKey);
  }

  return width;
};

const ellipsisText = (
  availableWidthPx,
  text,
  fontSize,
  { minRealChars = 4, ...measureCfg } = {},
) => {
  const fullTextWidth = measureTextWidth(text, fontSize, measureCfg);
  if (fullTextWidth <= availableWidthPx) return text;

  const elChar = '…';
  const textSpace =
    availableWidthPx - measureTextWidth(elChar, fontSize, measureCfg);

  const getCharsWidth = numChars => measureTextWidth(text.slice(0, numChars), fontSize, measureCfg);

  let numChars = Math.ceil(text.length * (textSpace / fullTextWidth));
  while (getCharsWidth(numChars) < textSpace && numChars < text.length) numChars++;
  while (getCharsWidth(numChars) > textSpace && numChars > 0) numChars--;

  return numChars <= minRealChars ? '' : `${text.slice(0, numChars)}${elChar}`;
};

const getFontSizeToFit = (
  availableWidthPx,
  text,
  { minFontSize = 5, maxFontSize = 18, ...measureCfg } = {},
) => {
  const fontSize =
    (availableWidthPx / measureTextWidth(text, 10, measureCfg)) * 10;
  return fontSize < minFontSize ? 0 : Math.min(maxFontSize, fontSize);
};

export { measureTextWidth, ellipsisText, getFontSizeToFit };
