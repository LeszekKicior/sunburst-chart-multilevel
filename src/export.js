const EXPORT_STYLES = `
  .sunburst-viz text {
    dominant-baseline: middle;
    text-anchor: middle;
    fill: #222;
  }
  .sunburst-viz .text-contour {
    fill: none;
    stroke: white;
    stroke-linejoin: round;
  }
  .sunburst-viz .main-arc {
    stroke-width: 1px;
  }
  .sunburst-viz .hidden-arc {
    fill: none;
  }
`;

function getSVGSource(svgElement, width, height) {
  const svg = svgElement.cloneNode(true);
  svg.setAttribute('class', (svg.getAttribute('class') || '') + ' sunburst-viz');
  if (width) svg.setAttribute('width', width);
  if (height) svg.setAttribute('height', height);

  // Add styles
  const style = document.createElement('style');
  style.innerHTML = EXPORT_STYLES;
  svg.insertBefore(style, svg.firstChild);

  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svg);

  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return '<?xml version="1.0" standalone="no"?>\r\n' + source;
}

export function exportSVG(state, fileName = 'chart.svg') {
  const source = getSVGSource(state.svg.node());
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function exportPNG(state, fileName = 'chart.png') {
  const { width, height } = state;
  const source = getSVGSource(state.svg.node(), width, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = function() {
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.setAttribute('href', pngUrl);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  img.src = url;
}
