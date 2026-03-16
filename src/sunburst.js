import { select as d3Select } from 'd3-selection';
import { scaleLinear, scalePow } from 'd3-scale';
import { hierarchy as d3Hierarchy, partition as d3Partition } from 'd3-hierarchy';
import { arc as d3Arc } from 'd3-shape';
import { path as d3Path } from 'd3-path';
import { interpolate as d3Interpolate } from 'd3-interpolate';
import { transition as d3Transition } from 'd3-transition';
import Kapsule from 'kapsule';
import accessorFn from 'accessor-fn';
import Tooltip from 'float-tooltip';
import  { measureTextWidth } from './text';

const TEXT_FONTSIZE = 12;
const MIN_FONT_SIZE = 8;
const TEXT_STROKE_WIDTH = 5;

export default Kapsule({

  props: {
    width: { default: window.innerWidth },
    height: { default: window.innerHeight },
    data: { onChange(_, state) { state.needsReparse = true }},
    children: { default: 'children', onChange(_, state) { state.needsReparse = true }},
    sort: { onChange(_, state) { state.needsReparse = true }},
    label: { default: d => d.name },
    labelOrientation: { default: 'auto' }, // angular, radial, auto
    size: { default: 'value', onChange(_, state) { state.needsReparse = true }},
    level: { onChange(_, state) { state.needsReparse = true }},
    levelSpan: { default: 1, onChange(_, state) { state.needsReparse = true }},
    color: { default: d => 'lightgrey' },
    strokeColor: { default: d => 'white' },
    nodeClassName: {}, // Additional css classes to add on each slice node
    minSliceAngle: { default: .2 },
    maxLevels: {},
    excludeRoot: { default: false, onChange(_, state) { state.needsReparse = true }},
    centerRadius: { default: 0.1 },
    radiusScaleExponent: { default: 0.5 }, // radius decreases quadratically outwards to preserve area
    showLabels: { default: true },
    fontSize: { default: TEXT_FONTSIZE },
    handleNonFittingLabel: {},
    tooltipContent: { default: d => '', triggerUpdate: false },
    tooltipTitle: { default: null, triggerUpdate: false },
    showTooltip: { default: d => true, triggerUpdate: false},
    focusOnNode: {
      onChange: function(d, state) {
        if (d && state.initialised) {
          moveStackToFront(d.__dataNode);
        }

        function moveStackToFront(elD) {
          state.svg.selectAll('.slice').filter(d => d === elD)
            .each(function(d) {
              this.parentNode.appendChild(this);
              if (d.parent) { moveStackToFront(d.parent); }
            })
        }
      }
    },
    onClick: { triggerUpdate: false },
    onRightClick: { triggerUpdate: false },
    onHover: { triggerUpdate: false },
    transitionDuration: { default: 750, triggerUpdate: false }
  },

  methods: {
    _parseData: function(state) {
      if (state.data) {
        const hierData = d3Hierarchy(state.data, accessorFn(state.children))
          .sum(accessorFn(state.size));
        const levelOf = accessorFn(state.level);
        const levelSpanOf = accessorFn(state.levelSpan);

        if (state.sort) {
          hierData.sort(state.sort);
        }

        d3Partition().padding(0)(hierData);

       hierData.eachBefore(d => {
          d.__level0 = d.parent ? d.parent.__level1 : 0;
          
          // Check if node has explicit level defined
          const explicitLevel = levelOf(d.data, d.parent);
          if (explicitLevel != null && Number.isFinite(+explicitLevel)) {
            // Use explicit level
            d.__level1 = +explicitLevel;
            d.__levelSpan = d.__level1 - d.__level0;
          } else {
            // Use levelSpan (default or specified)
            const rawSpan = +levelSpanOf(d.data, d.parent);
            d.__levelSpan = Number.isFinite(rawSpan) && rawSpan > 0 ? rawSpan : 1;
            d.__level1 = d.__level0 + d.__levelSpan;
          }
        });

        hierData.eachAfter(d => {
          d.__subtreeLevel1 = Math.max(
            d.__level1,
            ...((d.children || []).map(child => child.__subtreeLevel1))
          );
        });

        const maxLevel = Math.max(...hierData.descendants().map(d => d.__level1));
        const levelToY = scaleLinear().domain([0, maxLevel]).range([0, 1]);

        hierData.descendants().forEach(d => {
          d.y0 = levelToY(d.__level0);
          d.y1 = levelToY(d.__level1);
        });

        state.rootLevelSpan = hierData.__level1 - hierData.__level0;
        state.maxLevel = maxLevel;

        if (state.excludeRoot) {
          // re-scale y values if excluding root
          const yScale = scaleLinear()
            .domain([state.rootLevelSpan, state.maxLevel]);

          hierData.descendants().forEach(d => {
            d.y0 = yScale(d.__level0);
            d.y1 = yScale(d.__level1);
          });

          state.levelToY = level => yScale(level);
        } else {
          state.levelToY = level => levelToY(level);
        }

        hierData.descendants().forEach((d, i) => {
          d.id = i; // Mark each node with a unique ID
          d.data.__dataNode = d; // Dual-link data nodes
        });

        state.layoutData = hierData.descendants();
      }
    }
  },

  init: function(domNode, state) {
    state.chartId = Math.round(Math.random() * 1e12); // Unique ID for DOM elems

    state.radiusScale = scalePow();
    state.angleScale = scaleLinear()
      .domain([0, 10]) // For initial build-in animation
      .range([0, 2 * Math.PI])
      .clamp(true);

    state.arc = d3Arc()
      .startAngle(d => state.angleScale(d.x0))
      .endAngle(d => state.angleScale(d.x1))
      .innerRadius(d => Math.max(0, state.radiusScale(d.y0)))
      .outerRadius(d => Math.max(0, state.radiusScale(d.y1)));

    const el = d3Select(domNode)
      .append('div').attr('class', 'sunburst-viz');

    state.svg = el.append('svg');
    state.canvas = state.svg.append('g')
      .style('font-family', 'sans-serif')
      .style('font-size', `${state.fontSize}px`);

    state.tooltip = new Tooltip(el);

    // Reset focus by clicking on canvas
    state.svg
      .on('click', ev => (state.onClick || this.focusOnNode)(null, ev)) // By default reset zoom when clicking on canvas
      .on('contextmenu', ev => {
        if (state.onRightClick) { // By default do nothing when right-clicking on canvas
          state.onRightClick(null, ev);
          ev.preventDefault();
        }
      })
      .on('mouseover', ev => state.onHover && state.onHover(null, ev));

  },

  update: function(state) {
    if (state.needsReparse) {
      this._parseData();
      state.needsReparse = false;
    }

    const maxRadius = (Math.min(state.width, state.height) / 2);
    state.radiusScale.range([maxRadius * Math.max(0, Math.min(1, state.centerRadius)), maxRadius]);

    state.radiusScaleExponent > 0 && state.radiusScale.exponent(state.radiusScaleExponent);

    state.svg
      .style('width', state.width + 'px')
      .style('height', state.height + 'px')
      .attr('viewBox', `${-state.width/2} ${-state.height/2} ${state.width} ${state.height}`);

    const fontSize = Number.isFinite(+state.fontSize) && +state.fontSize > 0
      ? +state.fontSize
      : TEXT_FONTSIZE;

    state.canvas.style('font-size', `${fontSize}px`);

    if (!state.layoutData) return;

    const focusD =
      (state.focusOnNode && state.focusOnNode.__dataNode.y0 >= 0 && state.focusOnNode.__dataNode)
      || { x0: 0, x1: 1, y0: 0, y1: 1, __level0: state.excludeRoot ? state.rootLevelSpan : 0, __subtreeLevel1: state.maxLevel };

    const focusLevel0 = focusD.__level0 != null ? focusD.__level0 : (state.excludeRoot ? state.rootLevelSpan : 0);

    const slice = state.canvas.selectAll('.slice')
      .data(
        state.layoutData
          .filter(d => // Show only slices with a large enough angle and within the max levels
            d.x1 > focusD.x0
            && d.x0 < focusD.x1
            && (d.x1-d.x0)/(focusD.x1-focusD.x0) > state.minSliceAngle/360
            && (!state.maxLevels || d.__level0 - focusLevel0 < state.maxLevels)
            && (d.y0 >=0 || focusD.parent) // hide negative layers on top level
          ),
        d => d.id
      );

    const nameOf = accessorFn(state.label);
    const colorOf = accessorFn(state.color);
    const strokeColorOf = accessorFn(state.strokeColor);
    const nodeClassNameOf = accessorFn(state.nodeClassName);
    const transition = d3Transition().duration(state.transitionDuration);

    const focusSubtreeLevel1 = focusD.__subtreeLevel1 != null ? focusD.__subtreeLevel1 : state.maxLevel;
    const maxLevel = Math.min(
      focusSubtreeLevel1,
      focusLevel0 + (state.maxLevels || Infinity)
    );
    const maxY = Math.min(1, state.levelToY(maxLevel));

    // Apply zoom
    state.svg.transition(transition)
      .tween('scale', () => {
        const xd = d3Interpolate(state.angleScale.domain(), [focusD.x0, focusD.x1]);
        const yd = d3Interpolate(state.radiusScale.domain(), [focusD.y0, maxY]);
        return t => {
          state.angleScale.domain(xd(t));
          state.radiusScale.domain(yd(t));
        };
      });

    // Exiting
    const oldSlice = slice.exit().transition(transition).remove();
    oldSlice.select('path.main-arc').attrTween('d', d => () => state.arc(d));
    oldSlice.select('path.hidden-arc').attrTween('d', d => () => middleArcLine(d));

    // Entering
    const newSlice = slice.enter().append('g')
      .style('opacity', 0)
      .on('click', (ev, d) => {
        ev.stopPropagation();
        (state.onClick || this.focusOnNode)(d.data, ev);
      })
      .on('contextmenu', (ev, d) => {
        ev.stopPropagation();
        if (state.onRightClick) {
          state.onRightClick(d.data, ev);
          ev.preventDefault();
        }
      })
      .on('mouseover', (ev, d) => {
        ev.stopPropagation();
        state.onHover && state.onHover(d.data, ev);

        state.tooltip.content(!!state.showTooltip(d.data, d) && `<div class="tooltip-title">${
          state.tooltipTitle
            ? state.tooltipTitle(d.data, d)
            : getNodeStack(d)
              .slice(state.excludeRoot ? 1 : 0)
              .map(getNodeLabel)
              .join(' &rarr; ')
        }</div>${state.tooltipContent(d.data, d)}`);
      })
      .on('mouseout', () => state.tooltip.content(false));

    newSlice.append('path')
      .attr('class', 'main-arc')
      .style('stroke', d => strokeColorOf(d.data, d.parent))
      .style('fill', d => colorOf(d.data, d.parent));

    newSlice.append('path')
      .attr('class', 'hidden-arc')
      .attr('id', d => `hidden-arc-${state.chartId}-${d.id}`);

    // angular label
    const angularLabel = newSlice.append('text')
      .attr('class', 'angular-label');

    // Add white contour
    angularLabel.append('textPath')
      .attr('class', 'text-contour')
      .attr('startOffset','50%')
      .attr('xlink:href', d => `#hidden-arc-${state.chartId}-${d.id}` );

    angularLabel.append('textPath')
      .attr('class', 'text-stroke')
      .attr('startOffset','50%')
      .attr('xlink:href', d => `#hidden-arc-${state.chartId}-${d.id}` );

    // radial label
    const radialLabel = newSlice.append('g').attr('class', 'radial-label');
    radialLabel.append('text').attr('class', 'text-contour'); // white contour
    radialLabel.append('text').attr('class', 'text-stroke');

    // white contour
    newSlice.selectAll('.text-contour')
      .style('stroke-width', `${TEXT_STROKE_WIDTH}px`);

    // Entering + Updating
    const allSlices = slice.merge(newSlice);

    allSlices
      .style('opacity', 1)
      .attr('class', d => [
        'slice',
        ...(`${nodeClassNameOf(d.data) || ''}`.split(' ').map(str => str.trim()))
      ].filter(s => s).join(' '));

    allSlices.select('path.main-arc').transition(transition)
      .attrTween('d', d => () => state.arc(d))
      .style('stroke', d => strokeColorOf(d.data, d.parent))
      .style('fill', d => colorOf(d.data, d.parent));

    const computeAngularLabels = state.showLabels && ['angular', 'auto'].includes(state.labelOrientation.toLowerCase());
    const computeRadialLabels = state.showLabels && ['radial', 'auto'].includes(state.labelOrientation.toLowerCase());

    if (computeAngularLabels) {
      allSlices.select('path.hidden-arc').transition(transition)
        .attrTween('d', d => () => middleArcLine(d));
    }

    // Ensure propagation of data to labels children
    allSlices.select('text.angular-label').select('textPath.text-contour');
    allSlices.select('text.angular-label').select('textPath.text-stroke');
    allSlices.select('g.radial-label').select('text.text-contour');
    allSlices.select('g.radial-label').select('text.text-stroke');

    // Label processing
    const getLabelMeta = d => {
      if (!state.showLabels) return { label: '', fits: false, fontSize };

      const isRadial = (state.labelOrientation === 'auto'
        ? autoPickLabelOrientation(d)
        : state.labelOrientation) !== 'angular';

      let label = getNodeLabel(d);
      let labelFontSize = fontSize;
      let fits = isRadial
        ? radialTextFits(d, label, labelFontSize)
        : angularTextFits(d, label, labelFontSize);

      if (!fits && state.handleNonFittingLabel) {
        const availableSpace = isRadial ? getAvailableLabelRadialSpace(d) : getAvailableLabelAngularSpace(d);
        const newLabel = state.handleNonFittingLabel(label, availableSpace, d);
        if (newLabel) {
          label = newLabel;
          fits = isRadial
            ? radialTextFits(d, label, labelFontSize)
            : angularTextFits(d, label, labelFontSize);
        }
      }

      while (!fits && labelFontSize > MIN_FONT_SIZE) {
        labelFontSize -= 1;
        fits = isRadial
          ? radialTextFits(d, label, labelFontSize)
          : angularTextFits(d, label, labelFontSize);
      }

      return { isRadial, label, fits, fontSize: labelFontSize };
    };
    const labelMetaCache = new Map();

    allSlices.each(d => {
      labelMetaCache.set(d, getLabelMeta(d));
    });

    // Show/hide labels
    allSlices.select('.angular-label')
      .transition(transition)
        .styleTween('display', d => () => {
          const { isRadial, fits } = labelMetaCache.get(d);
          return computeAngularLabels && !isRadial && fits ? null : 'none';
        })
        .styleTween('font-size', d => () => `${labelMetaCache.get(d).fontSize}px`);

    allSlices.select('.radial-label')
      .transition(transition)
        .styleTween('display', d => () => {
          const { isRadial, fits } = labelMetaCache.get(d);
          return computeRadialLabels && isRadial && fits ? null : 'none';
        })
        .styleTween('font-size', d => () => `${labelMetaCache.get(d).fontSize}px`);

    // Set labels
    computeAngularLabels && allSlices.selectAll('text.angular-label').selectAll('textPath')
      .transition(transition)
        .textTween(d => () => labelMetaCache.get(d).label);

    computeRadialLabels && allSlices.selectAll('g.radial-label').selectAll('text')
      .transition(transition)
        .textTween(d => () => labelMetaCache.get(d).label)
        .attrTween('transform', d => () => radialTextTransform(d));

    //

    function middleArcLine(d) {
      const halfPi = Math.PI/2;
      const angles = [state.angleScale(d.x0) - halfPi, state.angleScale(d.x1) - halfPi];
      const r = Math.max(0, (state.radiusScale(d.y0) + state.radiusScale(d.y1)) / 2);

      if (!r || !(angles[1] - angles[0])) return '';

      const middleAngle = (angles[1] + angles[0]) / 2;
      const invertDirection = middleAngle > 0 && middleAngle < Math.PI; // On lower quadrants write text ccw
      if (invertDirection) { angles.reverse(); }

      const path = d3Path();
      path.arc(0, 0, r, angles[0], angles[1], invertDirection);
      return path.toString();
    }

    function radialTextTransform(d) {
      const middleAngle = (state.angleScale(d.x0) + state.angleScale(d.x1) - Math.PI) / 2;
      const r = Math.max(0, (state.radiusScale(d.y0) + state.radiusScale(d.y1)) / 2);

      const x = r * Math.cos(middleAngle);
      const y = r * Math.sin(middleAngle);
      let rot = middleAngle * 180 / Math.PI;

      middleAngle > Math.PI / 2 && middleAngle < Math.PI * 3/2 && (rot += 180); // prevent upside down text

      return `translate(${x}, ${y}) rotate(${rot})`;
    }

    function getAvailableLabelAngularSpace(d) {
      const deltaAngle = state.angleScale(d.x1) - state.angleScale(d.x0);
      const r = Math.max(0, (state.radiusScale(d.y0) + state.radiusScale(d.y1)) / 2);
      return r * deltaAngle;
    }

    function getAvailableLabelRadialSpace(d) {
      return state.radiusScale(d.y1) - state.radiusScale(d.y0);
    }

    function getNodeLabel(d) {
      const label = nameOf(d.data);
      return label == null ? '' : String(label);
    }

    function angularTextFits(d, label = getNodeLabel(d), textFontSize = fontSize) {
      return measureTextWidth(label, textFontSize, { strokeWidth: TEXT_STROKE_WIDTH }) < getAvailableLabelAngularSpace(d);
    }

    function radialTextFits(d, label = getNodeLabel(d), textFontSize = fontSize) {
      const availableHeight = state.radiusScale(d.y0) * (state.angleScale(d.x1) - state.angleScale(d.x0));
      if (availableHeight < textFontSize + TEXT_STROKE_WIDTH) return false; // not enough angular space

      return measureTextWidth(label, textFontSize, { strokeWidth: TEXT_STROKE_WIDTH }) < getAvailableLabelRadialSpace(d);
    }

    function autoPickLabelOrientation(d) {
      // prefer mode that keeps text most horizontal
      const angle = ((state.angleScale(d.x0) + state.angleScale(d.x1)) / 2)%Math.PI;
      const preferRadial = angle > Math.PI / 4 && angle < Math.PI * 3/4;

      let orientation = preferRadial
        ? (radialTextFits(d) ? 'radial' : angularTextFits(d) ? 'angular' : null)
        : (angularTextFits(d) ? 'angular' : radialTextFits(d) ? 'radial' : null);

      if (!orientation) {
        const availableArcWidth = state.radiusScale(d.y0) * (state.angleScale(d.x1) - state.angleScale(d.x0));
        if (availableArcWidth < fontSize + TEXT_STROKE_WIDTH) {
          // not enough space for radial text, choose angular
          orientation = 'angular';
        } else {
          const angularSpace = getAvailableLabelAngularSpace(d);
          const radialSpace = getAvailableLabelRadialSpace(d);
          orientation = angularSpace < radialSpace ? 'radial' : 'angular';
        }
      }

      return orientation;
    }

    function getNodeStack(d) {
      const stack = [];
      let curNode = d;
      while (curNode) {
        stack.unshift(curNode);
        curNode = curNode.parent;
      }
      return stack;
    }
  }
});
