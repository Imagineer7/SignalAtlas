// src/components/SpectrumView.js
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import bands from '../data/bands.json';
import allocations from '../data/allocations.json';
import signals from '../data/detailedbands.json';

const SpectrumView = () => {
  const ref = useRef();
  const zoomRef = useRef();
  const xScaleRef = useRef();
  const markerRef = useRef();
  const markerLabelRef = useRef();
  const hoverLineRef = useRef();
  const margin = { top: 20, right: 20, bottom: 40, left: 20 };
  const [showAllocations, setShowAllocations] = useState(true);
  const [showSignals, setShowSignals] = useState(true);

  useEffect(() => {
    const width = 1200;
    const height = 300;

    d3.select(ref.current).selectAll("*").remove();

    const svg = d3.select(ref.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background", "#1e1e1e");

    svg.append("defs")
      .append("pattern")
      .attr("id", "diagonal-stripes")
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 8)
      .attr("height", 8)
      .append("path")
      .attr("d", "M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4")
      .attr("stroke", "white")
      .attr("stroke-opacity", 0.05)
      .attr("stroke-width", 1);

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    const allocLayer = svg.append("g").attr("class", "alloc-layer");
    const allocTextLayer = svg.append("g").attr("class", "alloc-text-layer");
    const labelLayer = svg.append("g").attr("class", "label-layer");
    const markerLayer = svg.append("g").attr("class", "marker-layer");
    const signalGroup = svg.append("g").attr("class", "signal-group");

    const x = d3.scaleLinear()
      .domain([0, 300_000_000_000])
      .range([margin.left, width - margin.right]);

    xScaleRef.current = x;

    const xAxis = d3.axisBottom(x).ticks(12);

    zoomLayer.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .attr("class", "x-axis")
      .call(xAxis)
      .selectAll("text")
      .attr("fill", "#ccc");

    const formatAxis = (scale) => {
      const visibleHz = scale.domain()[1] - scale.domain()[0];
      if (visibleHz < 1_000) return d => `${d.toFixed(0)} Hz`;
      if (visibleHz < 1_000_000) return d => `${(d / 1e3).toFixed(2)} kHz`;
      if (visibleHz < 1_000_000_000) return d => `${(d / 1e6).toFixed(2)} MHz`;
      return d => `${(d / 1e9).toFixed(2)} GHz`;
    };

    allocLayer.selectAll("rect")
      .data(allocations)
      .enter()
      .append("rect")
      .attr("x", d => x(d.start))
      .attr("y", 30)
      .attr("width", d => x(d.end) - x(d.start))
      .attr("height", 150)
      .attr("fill", d => d.color || "#555")
      .attr("fill-opacity", 0.15)
      .attr("class", "allocation-band")
      .style("display", showAllocations ? "block" : "none")
      .append("title")
      .text(d => `${d.label}: ${d.usage}`);

      // ❶ bind data
      const allocLabels = allocTextLayer.selectAll("text").data(allocations);

      // ❷ remove any old labels
      allocLabels.exit().remove();

      // ❸ append any new labels, then merge to get full update selection
      allocLabels.enter()
        .append("text")
          .attr("text-anchor", "middle")
          .attr("fill", "#aaa")
          .attr("font-size", "10px")
        .merge(allocLabels)
          // (we’ll set x/y & opacity via styleAllocLabels)
          .text(d => d.label);
        
      // Collision‐avoidant positioning for allocation labels
      function styleAllocLabels(scale) {
        const lanes      = [];
        const minSpacing = 50;   // px between adjacent labels
        const baseY      = 190;  // first row Y
        const lineH      = 14;   // row height increment
        const minWidthPx = 30;   // hide labels narrower than 30px
      
        allocTextLayer.selectAll("text")
          .each(function(d) {
            const cx      = (scale(d.start) + scale(d.end)) / 2;
            const widthPx = scale(d.end) - scale(d.start);
      
            // 1) if toggled off or too narrow, hide and skip lane logic entirely
            if (!showAllocations || widthPx < minWidthPx) {
              return d3.select(this).style("opacity", 0);
            }
      
            // 2) find the first lane with enough room
            let lane = 0;
            while (lanes[lane] != null && cx - lanes[lane] < minSpacing) {
              lane++;
            }
            lanes[lane] = cx;
      
            // 3) position & show
            d3.select(this)
              .attr("x", cx)
              .attr("y", baseY + lane * lineH)
              .style("opacity", 1);
          });
      }      

      // Initial call at load
      styleAllocLabels(x);

    const bandsGroup = zoomLayer.append("g");

    bandsGroup.selectAll("rect")
      .data(bands)
      .enter()
      .append("rect")
      .attr("x", d => x(d.start))
      .attr("y", 50)
      .attr("width", d => x(d.end) - x(d.start))
      .attr("height", 100)
      .attr("fill", "url(#diagonal-stripes)")
      .attr("fill-opacity", 1)
      .attr("stroke", d => d.color)
      .attr("stroke-width", 2)
      .append("title")
      .text(d => d.label);

    labelLayer.selectAll("text")
      .data(bands)
      .enter()
      .append("text")
      .attr("x", d => x((d.start + d.end) / 2))
      .attr("y", 140)
      .attr("text-anchor", "middle")
      .attr("fill", "#fff")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text(d => d.label);

    const hoverLine = markerLayer.append("line")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#888")
      .attr("stroke-dasharray", "4 2")
      .attr("stroke-width", 1)
      .style("display", "none");

    hoverLineRef.current = hoverLine;

    signalGroup.selectAll("rect")
      .data(signals)
      .enter()
      .append("rect")
      .attr("x", d => x(d.start))
      .attr("y", 160)
      .attr("width", d => x(d.end) - x(d.start))
      .attr("height", 8)
      .attr("fill", d => d.color || "#ff0")
      .attr("opacity", 0.8)
      .append("title")
      .text(d => `${d.label}\n${d.description || ''}`);

    signalGroup.selectAll("text")
      .data(signals)
      .enter()
      .append("text")
      .attr("x", d => (x(d.start) + x(d.end)) / 2)
      .attr("y", 167)
      .attr("text-anchor", "middle")
      .attr("fill", "#ccc")
      .attr("font-size", "9px")
      .text(d => d.label);

    const marker = markerLayer.append("line")
      .attr("y1", 30)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "#ff4081")
      .attr("stroke-width", 2)
      .style("display", "none")
      .style("cursor", "pointer")
      .on("click", () => {
        marker.style("display", "none");
        markerLabel.style("display", "none");
      });

    const markerLabel = markerLayer.append("text")
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", "#ff4081")
      .attr("font-size", "12px")
      .style("display", "none")
      .style("pointer-events", "none");

    markerRef.current = marker;
    markerLabelRef.current = markerLabel;

    const zoom = d3.zoom()
      .scaleExtent([1, 1e8])
      .translateExtent([[0, 0], [width, height]])
      .extent([[0, 0], [width, height]])
      .on("zoom", (event) => {
        const transform = event.transform;
        const zx = transform.rescaleX(x);
        const zoomLevel = transform.k;

        xAxis.tickFormat(formatAxis(zx));
        zoomLayer.select(".x-axis").call(xAxis.scale(zx)).selectAll("text").attr("fill", "#ccc");

        allocLayer.selectAll("rect")
          .attr("x", d => zx(d.start))
          .attr("width", d => zx(d.end) - zx(d.start));

          styleAllocLabels(zx);      

        zoomLayer.selectAll("rect")
          .attr("x", d => zx(d.start))
          .attr("width", d => zx(d.end) - zx(d.start));

        labelLayer.selectAll("text")
          .attr("x", d => (zx(d.start) + zx(d.end)) / 2)
          .style("display", d => (zx(d.end) - zx(d.start)) < 40 ? "none" : "block");

        const showDetailedSignals = zoomLevel > 5000;

        signalGroup.selectAll("rect")
          .attr("x", d => zx(d.start))
          .attr("width", d => zx(d.end) - zx(d.start))
          .style("opacity", d => showSignals && (zx(d.end) - zx(d.start)) > 1 ? 0.8 : 0);

        signalGroup.selectAll("text")
          .attr("x", d => (zx(d.start) + zx(d.end)) / 2)
          .style("opacity", d => {
            const width = zx(d.end) - zx(d.start);
            return showSignals && width > 40 ? 1 : 0;
          });

        if (markerRef.current && markerRef.current.style("display") !== "none") {
          const markerX = +markerRef.current.attr("data-freq");
          const fx = zx(markerX);
          markerRef.current.attr("x1", fx).attr("x2", fx);
          markerLabelRef.current.attr("x", fx);
        }

        if (hoverLineRef.current) hoverLineRef.current.style("display", "none");

        //hide any that are too close to the last one
        if (showAllocations) {
        let lastX = -Infinity;
        const minSpacing = 50; // px between labels—you can tweak this

        allocTextLayer.selectAll("text")
          .each(function(d) {
            const cx = (zx(d.start) + zx(d.end)) / 2;
            if (cx - lastX > minSpacing) {
              d3.select(this).style("opacity", 1);
              lastX = cx;
            }
          });
        }
      });

    svg.call(zoom);
    zoomRef.current = zoom;
  }, [showAllocations, showSignals]);

  const resetZoom = () => {
    const svg = d3.select(ref.current);
    svg.transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
    if (markerRef.current) markerRef.current.style("display", "none");
    if (markerLabelRef.current) markerLabelRef.current.style("display", "none");
  };

  const zoomToBand = (band) => {
    const svg = d3.select(ref.current);
    const width = svg.node().getBoundingClientRect().width;
    const x = xScaleRef.current;
    const scale = width / (x(band.end) - x(band.start));
    const tx = -x(band.start) * scale + margin.left;
    const transform = d3.zoomIdentity.translate(tx, 0).scale(scale);
    svg.transition().duration(500).call(zoomRef.current.transform, transform);
  };

  const goToFrequency = (e) => {
    e.preventDefault();
    const input = e.target.elements.freq.value.trim().toLowerCase();
    let freq = parseFloat(input);
    if (input.includes("ghz")) freq *= 1e9;
    else if (input.includes("mhz")) freq *= 1e6;
    else if (input.includes("khz")) freq *= 1e3;
    if (isNaN(freq)) return;

    const svg = d3.select(ref.current);
    const width = svg.node().getBoundingClientRect().width;
    const x = xScaleRef.current;

    const bandwidth = 100_000;
    const scale = width / (x(freq + bandwidth / 2) - x(freq - bandwidth / 2));
    const tx = -x(freq) * scale + width / 2;
    const transform = d3.zoomIdentity.translate(tx, 0).scale(scale);

    svg.transition().duration(500).call(zoomRef.current.transform, transform);

    if (markerRef.current) {
      markerRef.current
        .attr("x1", x(freq))
        .attr("x2", x(freq))
        .attr("data-freq", freq)
        .style("display", "block");
    }
    if (markerLabelRef.current) {
      const label = freq >= 1e9 ? `${(freq / 1e9).toFixed(3)} GHz`
        : freq >= 1e6 ? `${(freq / 1e6).toFixed(3)} MHz`
        : freq >= 1e3 ? `${(freq / 1e3).toFixed(3)} kHz`
        : `${freq.toFixed(0)} Hz`;
      markerLabelRef.current
        .attr("x", x(freq))
        .text(label)
        .style("display", "block");
    }
  };

  const toggleAllocations = () => {
    setShowAllocations(prev => !prev);
  };

  return (
    <div style={{ backgroundColor: '#121212', padding: '1rem', minHeight: '100vh', color: 'white' }}>
      <h2>SignalAtlas</h2>
  
      <form onSubmit={goToFrequency} style={{ marginBottom: '10px' }}>
        <input
          type="text"
          name="freq"
          placeholder="Enter frequency (e.g. 4625, 2.4GHz)"
          style={{ padding: '6px', marginRight: '8px', width: '200px' }}
        />
        <button type="submit" style={{ padding: '6px 12px', background: '#333', color: 'white' }}>Go</button>
        <button type="button" onClick={resetZoom} style={{ marginLeft: '10px', padding: '6px 12px' }}>Reset Zoom</button>
      </form>
  
      <div style={{ marginBottom: '10px' }}>
        <label style={{ marginRight: '20px' }}>
          <input
            type="checkbox"
            checked={showAllocations}
            onChange={() => setShowAllocations(!showAllocations)}
            style={{ marginRight: '6px' }}
          />
          Show Allocations
        </label>
        <label>
          <input
            type="checkbox"
            checked={showSignals}
            onChange={() => setShowSignals(!showSignals)}
            style={{ marginRight: '6px' }}
          />
          Show Band Markers
        </label>
      </div>
  
      <div style={{ marginBottom: '10px' }}>
        {bands.map((band, i) => (
          <button
            key={i}
            onClick={() => zoomToBand(band)}
            style={{
              marginRight: '6px',
              padding: '4px 8px',
              background: '#222',
              color: '#fff',
              border: '1px solid #444'
            }}
          >
            {band.name || band.label}
          </button>
        ))}
      </div>
  
      <svg ref={ref} width="100%" height="400px" />
    </div>
  );  
};

export default SpectrumView;