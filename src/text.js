// Reuse a single canvas context for all text measurements
let _measurementContext = null;
const getMeasurementContext = () => {
  if (!_measurementContext) {
    const canvas = new OffscreenCanvas(0, 0);
    _measurementContext = canvas.getContext('2d');
  }
  return _measurementContext;
};

const measureTextWidth = (
  text,
  fontSize = 16,
  { strokeWidth = 1, fontFamily = 'sans-serif' } = {},
) => {
  const ctx = getMeasurementContext();
  if (!ctx) return 0;

  ctx.font = `${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width + strokeWidth;
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
