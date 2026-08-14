import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Sunburst from '../sunburst';

// Polyfill OffscreenCanvas for JSDOM
if (typeof global.OffscreenCanvas === 'undefined') {
  global.OffscreenCanvas = class {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }
    getContext(type) {
      if (type === '2d') {
        return {
          measureText: (text) => ({ width: text.length * 10 }),
          font: ''
        };
      }
      return null;
    }
  };
}

describe('sunburst.js', () => {
  let el;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  afterEach(() => {
    document.body.removeChild(el);
  });

  it('should initialize sunburst chart', () => {
    const chart = Sunburst()(el);
    expect(chart).toBeDefined();
    expect(el.querySelector('svg')).toBeTruthy();
  });

  it('should set and get width', () => {
    const chart = Sunburst()(el);
    chart.width(500);
    expect(chart.width()).toBe(500);
  });

  it('should parse data correctly', async () => {
    const chart = Sunburst()(el);
    const data = {
      name: 'root',
      children: [
        { name: 'a', value: 1 },
        { name: 'b', value: 2 }
      ]
    };
    chart.data(data);
    
    // Kapsule uses debounce for updates, so we wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const slices = el.querySelectorAll('.slice');
    // Root + 2 children = 3 slices
    expect(slices.length).toBe(3);
  });
  
  it('should handle excludeRoot property', async () => {
    const chart = Sunburst()(el);
    const data = {
      name: 'root',
      children: [
        { name: 'a', value: 1 }
      ]
    };
    
    chart.data(data);
    await new Promise(resolve => setTimeout(resolve, 200));
    const initialSlices = el.querySelectorAll('.slice').length;
    expect(initialSlices).toBe(2);
    
    // Instead of changing property on existing chart, let's create a new one with excludeRoot: true
    const el2 = document.createElement('div');
    document.body.appendChild(el2);
    const chart2 = Sunburst()(el2);
    chart2.excludeRoot(true).data(data);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    const afterSlices = el2.querySelectorAll('.slice').length;
    expect(afterSlices).toBe(1);
    document.body.removeChild(el2);
  });
});
