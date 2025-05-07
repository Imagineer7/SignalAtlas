// src/utils/renderSubbands.js
import * as d3 from 'd3';

export default function renderSubbands(svg, bandData, scale, options = {}) {
  const {
    barHeight = 12,
    animate = true,
    externalLabelThreshold = 40,
    transitionDuration = 400,
  } = options;

  const baseModeColors = {
    cw: '#888888',
    ssb: '#ebcb8b',
    fm: '#a3be8c',
    digital: '#bf616a',
    atv: '#b48ead',
    satellite: '#5e81ac',
    experimental: '#d08770',
    mixed: '#88c0d0',
  };

  const getModeColor = (mode) => {
    if (!mode) return '#555';
    const cleaned = mode.trim().toLowerCase();
    if (baseModeColors[cleaned]) return baseModeColors[cleaned];
    const parts = cleaned.split(/[/\s]+/);
    for (const part of parts) {
      if (baseModeColors[part]) return baseModeColors[part];
    }
    return '#999';
  };

  svg.selectAll("*").remove();

  const width = parseFloat(svg.attr("width")) || 800;
  svg.append("rect")
    .attr("x", 0)
    .attr("y", 20)
    .attr("width", width)
    .attr("height", barHeight)
    .attr("fill", "#333");

  const labelLanes = [];
  const laneSpacing = 12;

  bandData.subbands.forEach((sb, i) => {
    const xStart = scale(sb.start);
    const xEnd = scale(sb.end);
    const barWidth = xEnd - xStart;
    const centerX = xStart + barWidth / 2;
    const fill = getModeColor(sb.mode);
    const label = sb.label.length > 20 ? sb.label.slice(0, 17) + '…' : sb.label;

    const bar = svg.append("rect")
      .attr("x", xStart)
      .attr("y", 20)
      .attr("width", 0)
      .attr("height", barHeight)
      .attr("fill", fill);

    if (animate) {
      bar.transition()
        .duration(transitionDuration)
        .attr("width", barWidth);
    } else {
      bar.attr("width", barWidth);
    }

    if (barWidth >= externalLabelThreshold) {
      svg.append("text")
        .attr("x", centerX)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .attr("fill", "#fff")
        .attr("font-size", "10px")
        .text(label)
        .style("opacity", 0)
        .transition()
        .duration(transitionDuration)
        .style("opacity", 1);
    } else {
      let lane = 0;
      while (
        labelLanes[lane]?.some(pos => Math.abs(pos - centerX) < 50)
      ) {
        lane++;
      }
      if (!labelLanes[lane]) labelLanes[lane] = [];
      labelLanes[lane].push(centerX);

      const labelY = 10 - lane * laneSpacing;

      svg.append("text")
        .attr("x", centerX)
        .attr("y", labelY)
        .attr("text-anchor", "middle")
        .attr("fill", "#ccc")
        .attr("font-size", "9px")
        .text(label)
        .style("opacity", 0)
        .transition()
        .duration(transitionDuration)
        .style("opacity", 1);

      svg.append("line")
        .attr("x1", centerX)
        .attr("x2", centerX)
        .attr("y1", labelY + 2)
        .attr("y2", 20)
        .attr("stroke", "#999")
        .attr("stroke-width", 1)
        .style("opacity", 0)
        .transition()
        .duration(transitionDuration)
        .style("opacity", 1);
    }
  });

  d3.ticks(bandData.start, bandData.end, 5).forEach((freq) => {
    const x = scale(freq);
    svg.append("line")
      .attr("x1", x)
      .attr("x2", x)
      .attr("y1", 32)
      .attr("y2", 42)
      .attr("stroke", "#aaa");

    svg.append("text")
      .attr("x", x)
      .attr("y", 55)
      .attr("text-anchor", "middle")
      .attr("fill", "#ccc")
      .attr("font-size", "10px")
      .text((freq / 1e6).toFixed(3) + " MHz");
  });
}
