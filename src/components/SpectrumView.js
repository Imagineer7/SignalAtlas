// src/components/SpectrumView.js
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import bands from '../data/bands.json';
import detailedBands from '../data/detailedbands.json';
import allocationsUS from '../data/allocations-us.json';
import allocationsEU from '../data/allocations-eu.json';
import allocationsAPAC from '../data/allocations-apac.json';
import subbandDetails from '../data/subbands.json';
import '../styles.css';
import Topbar from './Topbar';

function formatHz(freq) {
  if (freq >= 1e9) return (freq / 1e9).toFixed(3) + ' GHz';
  if (freq >= 1e6) return (freq / 1e6).toFixed(3) + ' MHz';
  if (freq >= 1e3) return (freq / 1e3).toFixed(1) + ' kHz';
  return freq + ' Hz';
}

function getTruncatedLabel(label, pixelWidth) {
  if (pixelWidth < 30) return label.slice(0, 5) + '…';
  if (pixelWidth < 50) return label.slice(0, 10) + '…';
  return label;
}

function truncateToFit(textElem, fullLabel, maxWidthPx) {
  const textNode = d3.select(textElem);
  textNode.text(fullLabel);

  if (textNode.node().getComputedTextLength() <= maxWidthPx) return;

  let truncated = fullLabel;
  while (truncated.length > 1 && textNode.node().getComputedTextLength() > maxWidthPx) {
    truncated = truncated.slice(0, -1);
    textNode.text(truncated + "…");
  }
}

const SpectrumView = () => {
  const ref = useRef();
  const zoomRef = useRef();
  const xScaleRef = useRef();
  const markerRef = useRef();
  const markerLabelRef = useRef();
  const hoverLineRef = useRef();
  const margin = { top: 20, right: 20, bottom: 40, left: 20 };
  const [showAllocations, setShowAllocations] = useState(true);
  const [showBands, setShowBands] = useState(true);
  const [region, setRegion] = useState('US');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [freqInput, setFreqInput] = useState('');
  const [selectedBand, setSelectedBand] = useState(null);

  const regionMap = {
        US: allocationsUS,
        EU: allocationsEU,
        APAC: allocationsAPAC
      };
  const allocations = regionMap[region];

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
    const bandGroup = svg.append("g").attr("class", "band-group");

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

    const allocLabels = allocTextLayer.selectAll("text").data(allocations);
    allocLabels.exit().remove();
    allocLabels.enter()
      .append("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#aaa")
      .attr("font-size", "10px")
      .attr("x", -9999)
      .attr("y", -9999)
      .merge(allocLabels)
      .text(d => d.label);

    function styleAllocLabels(scale) {
      const lanes = [];
      const minSpacing = 50;
      const baseY = 190;
      const lineH = 14;
      const minWidthPx = 30;

      allocTextLayer.selectAll("text")
        .each(function(d) {
          const cx = (scale(d.start) + scale(d.end)) / 2;
          const widthPx = scale(d.end) - scale(d.start);

          if (!showAllocations || widthPx < minWidthPx) {
            return d3.select(this).style("opacity", 0);
          }

          let lane = 0;
          while (lanes[lane] != null && cx - lanes[lane] < minSpacing) {
            lane++;
          }
          lanes[lane] = cx;

          d3.select(this)
            .attr("x", cx)
            .attr("y", baseY + lane * lineH)
            .style("opacity", 1);

          if (widthPx < 10) {
            return d3.select(this).style("opacity", 0);
          }
          truncateToFit(this, d.label, widthPx);
        });
    }

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

    // === Render detailed bands with vertical stacking to avoid overlaps ===
    // Collision-avoidant rendering for detailed bands
    const detailedBandLanes = [];
    const detailedBandLineHeight = 10;
    const detailedBandBaseY = 55;

    // Rectangles for detailed bands
    bandGroup.selectAll("rect")
    .data(detailedBands)
    .enter()
    .append("rect")
    .each(function(d) {
      const startPx = x(d.start);
      const endPx = x(d.end);
      const widthPx = endPx - startPx;
  
      let lane = 0;
      while (
        detailedBandLanes[lane] &&
        detailedBandLanes[lane].some(({ start, end }) => !(endPx < start || startPx > end))
      ) {
        lane++;
      }
  
      if (!detailedBandLanes[lane]) detailedBandLanes[lane] = [];
      detailedBandLanes[lane].push({ start: startPx, end: endPx });
      d.lane = lane; // Store lane on data
  
      d3.select(this)
        .attr("x", startPx)
        .attr("y", detailedBandBaseY + lane * detailedBandLineHeight)
        .attr("width", widthPx)
        .attr("height", 8)
        .attr("fill", d.color || "#ff0")
        .attr("opacity", 0.8)
        .style("cursor", "pointer")
        .on("click", () => {
          const found = subbandDetails.find(b =>
            b.label === d.label || (b.start === d.start && b.end === d.end)
          );
          setSelectedBand(found || d); // fallback to showing d if no match
        })
        .append("title")
        .text(`${d.label}\n${d.description || ''}`);
    });  

    // Labels for detailed bands
    bandGroup.selectAll("text")
    .data(detailedBands)
    .enter()
    .append("text")
    .attr("x", d => (x(d.start) + x(d.end)) / 2)
    .attr("y", d => detailedBandBaseY + d.lane * detailedBandLineHeight + 5) // 4 centers in 8px bar
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle") // This keeps it centered vertically
    .attr("fill", "#ccc")
    .attr("font-size", "9px")
    .text(d => d.label)
    .each(function(d) {
      const widthPx = x(d.end) - x(d.start);
      truncateToFit(this, d.label, widthPx);
    });   

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

        const showDetailedBands = zoomLevel > 5000;

        bandGroup.selectAll("rect")
          .attr("x", d => zx(d.start))
          .attr("width", d => zx(d.end) - zx(d.start))
          .style("opacity", d => showBands && (zx(d.end) - zx(d.start)) > 1 ? 0.8 : 0);

        bandGroup.selectAll("text")
          .attr("x", d => (zx(d.start) + zx(d.end)) / 2)
          .each(function(d) {
            const widthPx = zx(d.end) - zx(d.start);
            truncateToFit(this, d.label, widthPx);
          })          
          .style("opacity", d => {
            const width = zx(d.end) - zx(d.start);
            return showBands && width > 40 ? 1 : 0;
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
    setTimeout(() => {
      svg.call(zoom.transform, d3.zoomIdentity);
    }, 0);

  }, [showAllocations, showBands, allocations]);

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
    <div
      className="spectrum-view-container"
      style={{ backgroundColor: '#121212', padding: '1rem', minHeight: '100vh', color: 'white' }}
    >
      {/* ⬆️ Topbar with all controls */}
      <Topbar
        frequency={freqInput}
        onFrequencyChange={setFreqInput}
        onGo={() => {
          const fakeEvent = {
            preventDefault: () => {},
            target: {
              elements: {
                freq: { value: freqInput },
              },
            },
          };
          goToFrequency(fakeEvent);
        }}
        onReset={resetZoom}
        showAllocations={showAllocations}
        setShowAllocations={setShowAllocations}
        showBands={showBands}
        setShowBands={setShowBands}
        region={region === 'US' ? 'United States' : region === 'EU' ? 'Europe' : region}
        setRegion={(r) => setRegion(r === 'United States' ? 'US' : r === 'Europe' ? 'EU' : r)}
      />
  
      {/* ⬅️ Collapsible sidebar with band jump buttons */}
      <div className={`band-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
          style={{
            background: '#222',
            color: '#fff',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '8px',
          }}
        >
          {sidebarOpen ? '«' : '»'}
        </button>
  
        {sidebarOpen && (
          <div className="buttons-container-wrapper">
            <div className="buttons-container">
              {bands.slice(0, 8).map((band, i) => (
                <button key={i} className="band-button" onClick={() => zoomToBand(band)}>
                  {band.name || band.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
  
      {/* 📊 Spectrum canvas */}
      <svg ref={ref} width="100%" height="400px" />
  
      {/* 📋 Detailed Band Information Box */}
      {selectedBand && (
        <div
          style={{
            background: '#1e1e1e',
            color: 'white',
            padding: '1rem',
            marginTop: '1rem',
            borderTop: '1px solid #333',
          }}
        >
          <h3 style={{ marginTop: 0 }}>{selectedBand.label}</h3>
          <p>
            <strong>Frequency:</strong>{' '}
            {(selectedBand.start / 1e6).toFixed(3)}–{(selectedBand.end / 1e6).toFixed(3)} MHz
          </p>
  
          {selectedBand.description && <p>{selectedBand.description}</p>}
  
          {selectedBand.subbands && (
            <>
              {/* Visual Subband Spectrum */}
              <svg width="100%" height="40" style={{ marginTop: '10px' }}>
                <rect x={0} y={15} width="100%" height={10} fill="#333" />
                {(() => {
                  const totalWidth = 1000;
                  const modeColors = {
                    RTTY: '#bf616a',
                    Phone: '#a3be8c',
                    Image: '#a3be8c',
                    CW: '#888888',
                    'SSB phone only': '#ebcb8b',
                    'USB phone CW RTTY and data': '#5e81ac',
                    'Fixed digital forwarding systems only': '#d08770',
                  };
                  const scale = d3.scaleLinear()
                    .domain([selectedBand.start, selectedBand.end])
                    .range([0, totalWidth]);
                  return selectedBand.subbands.map((sb, i) => (
                    <rect
                      key={i}
                      x={scale(sb.start)}
                      y={15}
                      width={scale(sb.end) - scale(sb.start)}
                      height={10}
                      fill={modeColors[sb.mode] || '#88c0d0'}
                    />
                  ));
                })()}
              </svg>
  
              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '0.5rem' }}>
                {[
                  ['RTTY', '#bf616a'],
                  ['Phone / Image', '#a3be8c'],
                  ['CW', '#888888'],
                  ['SSB phone only', '#ebcb8b'],
                  ['USB phone CW RTTY and data', '#5e81ac'],
                  ['Fixed digital forwarding systems only', '#d08770'],
                ].map(([label, color]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem' }}>
                    <span style={{ width: '14px', height: '14px', backgroundColor: color, display: 'inline-block', marginRight: '6px' }} />
                    {label}
                  </div>
                ))}
              </div>
  
              <table style={{ width: '100%', color: '#ddd', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #444' }}>
                    <th style={{ textAlign: 'left', padding: '4px' }}>Label</th>
                    <th style={{ textAlign: 'left', padding: '4px' }}>Start</th>
                    <th style={{ textAlign: 'left', padding: '4px' }}>End</th>
                    <th style={{ textAlign: 'left', padding: '4px' }}>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBand.subbands.map((sb, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '4px' }}>{sb.label}</td>
                      <td style={{ padding: '4px' }}>{(sb.start / 1e6).toFixed(3)} MHz</td>
                      <td style={{ padding: '4px' }}>{(sb.end / 1e6).toFixed(3)} MHz</td>
                      <td style={{ padding: '4px' }}>{sb.mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
  
          <button
            style={{
              marginTop: '1rem',
              backgroundColor: '#333',
              color: 'white',
              padding: '6px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={() => setSelectedBand(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );        
};

export default SpectrumView;