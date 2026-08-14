import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('valueCountMethod', () => {
  let el;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
  });

  afterEach(() => {
    document.body.removeChild(el);
  });

  const data = {
    name: 'root',
    value: 10,
    children: [
      {
        name: 'branch1',
        value: 5,
        children: [
          { name: 'leaf1.1', value: 2 },
          { name: 'leaf1.2', value: 3 }
        ]
      },
      {
        name: 'leaf2',
        value: 4
      }
    ]
  };

  it('should use "node-sum" by default', async () => {
    const chart = Sunburst()(el);
    chart.data(data);
    await new Promise(resolve => setTimeout(resolve, 100));

    const rootNode = el.querySelector('.slice').__data__;
    // node-sum: 10 (root) + 5 (branch1) + 2 (leaf1.1) + 3 (leaf1.2) + 4 (leaf2) = 24
    // Wait, let's check how d3.hierarchy().sum() works.
    // hierData.sum(sizeAccessor) sets d.value to the sum of its own sizeAccessor(d.data) and its descendants.
    expect(rootNode.value).toBe(24);
  });

  it('should support "direct" method', async () => {
    const chart = Sunburst()(el);
    // @ts-ignore
    chart.valueCountMethod('direct').data(data);
    await new Promise(resolve => setTimeout(resolve, 100));

    const rootNode = el.querySelector('.slice').__data__;
    // direct: only own value
    expect(rootNode.value).toBe(10);
    
    const branch1Node = [...el.querySelectorAll('.slice')].find(d => d.__data__.data.name === 'branch1').__data__;
    expect(branch1Node.value).toBe(5);
  });

  it('should support "leaf-only" method', async () => {
    const chart = Sunburst()(el);
    // @ts-ignore
    chart.valueCountMethod('leaf-only').data(data);
    await new Promise(resolve => setTimeout(resolve, 100));

    const rootNode = el.querySelector('.slice').__data__;
    // leaf-only: 2 (leaf1.1) + 3 (leaf1.2) + 4 (leaf2) = 9
    // branch1 and root are ignored because they have children.
    expect(rootNode.value).toBe(9);

    const branch1Node = [...el.querySelectorAll('.slice')].find(d => d.__data__.data.name === 'branch1').__data__;
    // branch1 has children, so its own value (5) is ignored. Its value should be sum of its leaf children.
    expect(branch1Node.value).toBe(5); // 2 + 3 = 5
  });
});
