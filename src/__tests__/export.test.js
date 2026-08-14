import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportSVG, exportPNG } from '../export';

describe('export.js', () => {
  let state;

  beforeEach(() => {
    // Mock state with a fake D3 selection
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgNode.innerHTML = '<g class="slice"><path d="M0,0L1,1"></path></g>';
    
    state = {
      svg: {
        node: () => svgNode
      },
      width: 500,
      height: 500
    };

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:foo');
    global.URL.revokeObjectURL = vi.fn();

    // Mock document.body.appendChild/removeChild
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  });

  describe('exportSVG', () => {
    it('should create a download link and click it', () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      
      exportSVG(state, 'test.svg');

      expect(document.body.appendChild).toHaveBeenCalled();
      const link = vi.mocked(document.body.appendChild).mock.calls[0][0];
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('download')).toBe('test.svg');
      expect(link.getAttribute('href')).toBe('blob:foo');
      expect(clickSpy).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalledWith(link);
    });
  });

  describe('exportPNG', () => {
    it('should create a canvas and image to export PNG', async () => {
      // Mock canvas getContext and toDataURL
      const mockCtx = {
        drawImage: vi.fn()
      };
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx);
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,foo');
      
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      // Use a promise to wait for the click event
      const clickPromise = new Promise((resolve) => {
        clickSpy.mockImplementation(() => {
          resolve();
        });
      });

      // Mock Image and trigger onload manually
      const originalImage = global.Image;
      global.Image = class {
        constructor() {
          this.onload = null;
        }
        set src(val) {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      };

      exportPNG(state, 'test.png');

      await clickPromise;

      expect(mockCtx.drawImage).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
      const link = vi.mocked(document.body.appendChild).mock.calls.find(call => call[0].getAttribute('download') === 'test.png')[0];
      expect(link.getAttribute('download')).toBe('test.png');
      expect(link.getAttribute('href')).toBe('data:image/png;base64,foo');
      expect(document.body.removeChild).toHaveBeenCalledWith(link);

      global.Image = originalImage;
    });
  });
});
