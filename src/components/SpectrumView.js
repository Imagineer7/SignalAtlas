// src/components/SpectrumView.js
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import SpectrumLayout from './SpectrumLayout';
import bands from '../data/bands.json';
import detailedBands from '../data/detailedbands.json';
import allocationsUS from '../data/allocations-us.json';
import allocationsEU from '../data/allocations-eu.json';
import allocationsAPAC from '../data/allocations-apac.json';
import subbandDetails from '../data/subbands.json';
import '../styles.css';

/*function getTruncatedLabel(label, pixelWidth) {
  if (pixelWidth < 30) return label.slice(0, 5) + '…';
  if (pixelWidth < 50) return label.slice(0, 10) + '…';
  return label;
}*/

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
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef();

  const zoomToFrequency = (freq) => {
    const svg = d3.select(ref.current);
    const width = svg.node().getBoundingClientRect().width;
    const x = xScaleRef.current;
  
    let bandwidth;
    if (freq < 1e6) bandwidth = 20_000;                  // < 1 MHz: narrow view
    else if (freq < 30e6) bandwidth = 1_000_000;           // HF: zoom close
    else if (freq < 300e6) bandwidth = 10_000_000;          // VHF
    else if (freq < 1e9) bandwidth = 150_000_000;          // UHF
    else if (freq < 5e9) bandwidth = 500_000_000;         // SHF
    else bandwidth = 10_000_000_000;                         // EHF and beyond

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

  const instructionsRef = useRef();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        instructionsOpen &&
        instructionsRef.current &&
        !instructionsRef.current.contains(e.target)
      ) {
        setInstructionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [instructionsOpen]);

  const regionMap = {
    US: allocationsUS,
    EU: allocationsEU,
    APAC: allocationsAPAC,
  };
  
  // Ensure allocations are updated when the region changes
  const allocations = regionMap[region] || [];  // Fallback to an empty array if allocations not found
  
  useEffect(() => {
    console.log('Region changed:', region);
    console.log('Allocations:', allocations);
  
    const width = 1200;
    const height = 300;
  
    // Clear the SVG
    d3.select(ref.current).selectAll("*").remove();
  
    const svg = d3.select(ref.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background", "#1e1e1e");
  
    // Add glow effect for hover
    svg.append("defs").append("filter")
      .attr("id", "glow")
      .append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 0)
      .attr("stdDeviation", 2)
      .attr("flood-color", "#fff")
      .attr("flood-opacity", 0.7);
  
    // Add diagonal stripes pattern
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
  
    // Layers for different parts of the spectrum
    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    const allocLayer = svg.append("g").attr("class", "alloc-layer");
    const allocTextLayer = svg.append("g").attr("class", "alloc-text-layer");
    const labelLayer = svg.append("g").attr("class", "label-layer");
    const markerLayer = svg.append("g").attr("class", "marker-layer");
    const bandGroup = svg.append("g").attr("class", "band-group");
  
    // Define the scale for the x-axis
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
  
    // Helper function to format the axis labels
    const formatAxis = (scale) => {
      const visibleHz = scale.domain()[1] - scale.domain()[0];
      if (visibleHz < 1_000) return d => `${d.toFixed(0)} Hz`;
      if (visibleHz < 1_000_000) return d => `${(d / 1e3).toFixed(2)} kHz`;
      if (visibleHz < 1_000_000_000) return d => `${(d / 1e6).toFixed(2)} MHz`;
      return d => `${(d / 1e9).toFixed(2)} GHz`;
    };
  
    // Render the allocations
    allocLayer.selectAll("rect")
      .data(allocations)  // Using the updated allocations data
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
  
    // Render the allocation labels
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
        .on("mouseover", function () {
          d3.select(this)
            .transition()
            .duration(150)
            .attr("height", 12)
            .attr("y", detailedBandBaseY + lane * detailedBandLineHeight - 2)
            .attr("opacity", 1)
            .attr("filter", "url(#glow)");
        })
        .on("mouseout", function () {
          d3.select(this)
            .transition()
            .duration(150)
            .attr("height", 8)
            .attr("y", detailedBandBaseY + lane * detailedBandLineHeight)
            .attr("opacity", 0.8)
            .attr("filter", null);
        })        
        .on("click", () => {
          const found = subbandDetails.find(b =>
            b.label === d.label || (b.start === d.start && b.end === d.end)
          );
          setSelectedBand(found || d);
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
    .style("pointer-events", "none")
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
      .scaleExtent([1, 1e8]) // Define zoom scale extent
      .translateExtent([[0, 0], [width, height]]) // Limit translation to the width and height of the container
      .extent([[0, 0], [width, height]]) // Define zooming extent (for both X and Y axes)
      .on("zoom", (event) => {
        const transform = event.transform;

        // Prevent negative X translation and set a minimum scale of 0
        const tx = Math.max(transform.x, 0); // Prevent negative X translation (pan to left)
        const zx = transform.rescaleX(x); // Apply rescaling to X axis
        // const zoomLevel = transform.k; // Uncomment if you need to track the zoom level

        svg.attr("transform", transform.translate(tx).scale(transform.k)); // Apply translation and scaling

        xAxis.tickFormat(formatAxis(zx));
        zoomLayer.select(".x-axis")
          .call(xAxis.scale(zx))
          .selectAll("text")
          .attr("fill", "#ccc");

        // Adjusting the width and position of the allocation rectangles
        allocLayer.selectAll("rect")
          .attr("x", d => zx(d.start))
          .attr("width", d => zx(d.end) - zx(d.start));

        styleAllocLabels(zx);

        // Update other layers accordingly
        zoomLayer.selectAll("rect")
          .attr("x", d => zx(d.start))
          .attr("width", d => zx(d.end) - zx(d.start));

        labelLayer.selectAll("text")
          .attr("x", d => (zx(d.start) + zx(d.end)) / 2)
          .style("display", d => (zx(d.end) - zx(d.start)) < 40 ? "none" : "block");

        // Zooming behavior for frequency bands
        bandGroup.selectAll("rect")
          .attr("x", d => zx(d.start))
          .attr("width", d => zx(d.end) - zx(d.start))
          .style("opacity", d => showBands && (zx(d.end) - zx(d.start)) > 1 ? 0.8 : 0);

        bandGroup.selectAll("text")
          .attr("x", d => (zx(d.start) + zx(d.end)) / 2)
          .each(function(d) {
            const widthPx = zx(d.end) - zx(d.start);
            truncateToFit(this, d.label, widthPx); // Truncate labels if needed
          })
          .style("opacity", d => {
            const width = zx(d.end) - zx(d.start);
            return showBands && width > 40 ? 1 : 0; // Only show labels if width is large enough
          });

        // Handle the marker position and visibility
        if (markerRef.current && markerRef.current.style("display") !== "none") {
          const markerX = +markerRef.current.attr("data-freq");
          const fx = zx(markerX);
          markerRef.current.attr("x1", fx).attr("x2", fx);
          markerLabelRef.current.attr("x", fx);
        }

        if (hoverLineRef.current) hoverLineRef.current.style("display", "none");

        // Hide allocations that are too close to each other
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

  }, [region, allocations, showAllocations, margin.bottom, margin.left, margin.right]);

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
  
    // Prevent negative frequency translation
    const tx = Math.max(-x(freq) * scale + width / 2, 0);  // Ensure tx is >= 0
  
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

  //const toggleAllocations = () => {
  //  setShowAllocations(prev => !prev);
  //};

  return (
    <SpectrumLayout
      refProp={ref}
      freqInput={freqInput}
      setFreqInput={setFreqInput}
      resetZoom={resetZoom}
      goToFrequency={goToFrequency}
      showAllocations={showAllocations}
      setShowAllocations={setShowAllocations}
      showBands={showBands}
      setShowBands={setShowBands}
      region={region}
      setRegion={setRegion}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      bands={bands}
      zoomToBand={zoomToBand}
      selectedBand={selectedBand}
      setSelectedBand={setSelectedBand}
      instructionsOpen={instructionsOpen}
      setInstructionsOpen={setInstructionsOpen}
      detailedBands={detailedBands}
      suggestions={suggestions}
      setSuggestions={setSuggestions}
      allocations={allocations}
    />
  );        
};

export default SpectrumView;