// src/components/SpectrumLayout.js
import React, { useRef } from 'react';
import * as d3 from 'd3';
import Topbar from './Topbar';
import renderSubbands from '../utils/renderSubbands';

const SpectrumLayout = ({
  refProp,
  freqInput,
  setFreqInput,
  resetZoom,
  goToFrequency,
  showAllocations,
  setShowAllocations,
  showBands,
  setShowBands,
  region,
  setRegion,
  sidebarOpen,
  setSidebarOpen,
  bands,
  zoomToBand,
  selectedBand,
  setSelectedBand,
  instructionsOpen,
  setInstructionsOpen,
}) => {
  const instructionsRef = useRef(null);

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

      <button
        onClick={() => setInstructionsOpen(!instructionsOpen)}
        style={{
          position: 'fixed',
          bottom: '1rem',
          left: '1rem',
          backgroundColor: '#222',
          color: '#fff',
          border: 'none',
          padding: '6px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 1000,
        }}
      >
        {instructionsOpen ? 'Click Outside To Close' : '❔ Instructions'}
      </button>
  
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

      <div
        ref={instructionsRef}
        className="instructions-sidebar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '260px',
          height: '100%',
          backgroundColor: '#1e1e1e',
          color: '#fff',
          padding: '1rem',
          boxShadow: '2px 0 10px rgba(0,0,0,0.3)',
          zIndex: 999,
          transform: instructionsOpen ? 'translateX(0)' : 'translateX(-100%)',
          opacity: instructionsOpen ? 1 : 0,
          pointerEvents: instructionsOpen ? 'auto' : 'none',
          transition: 'transform 0.4s ease, opacity 0.4s ease',
        }}
      >
        <h3><span role="img" aria-label="Instructions book">📘</span> Instructions</h3>
        <ul style={{ paddingLeft: '1rem' }}>
          <li><span role="img" aria-label="magnifying glass">🔍</span> Use the search bar to jump to a frequency (e.g., "144.39 MHz").</li>
          <li><span role="img" aria-label="click">🖱️</span> Click a band to view its sub-band breakdown.</li>
          <li><span role="img" aria-label="palette">🎨</span> Hover to view allocation tooltips.</li>
          <li><span role="img" aria-label="zoom">🔎</span> Zoom in to reveal detailed signal data.</li>
          <li><span role="img" aria-label="moon">🌓</span> Dark mode UI optimized for low-glare usage.</li>
        </ul>
      </div>
  
      {/* 📊 Spectrum canvas */}
      <svg ref={refProp} width="100%" height="400px" />
  
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
              <svg
                ref={(el) => {
                  if (!el || !selectedBand) return;
                  const svg = d3.select(el);
                  svg.selectAll("*").remove();

                  const width = el.getBoundingClientRect().width;
                  const height = 70;
                  svg.attr("width", width).attr("height", height);

                  const scale = d3.scaleLinear()
                    .domain([selectedBand.start, selectedBand.end])
                    .range([0, width]);

                  // Background bar
                  svg.append("rect")
                    .attr("x", 0)
                    .attr("y", 20)
                    .attr("width", width)
                    .attr("height", 12)
                    .attr("fill", "#333");

                  // Subband bars and dynamic labels
                  renderSubbands(svg, selectedBand, scale, {
                    animate: true,
                    barHeight: 12,
                    externalLabelThreshold: 40,
                    transitionDuration: 500,
                  });                                    
                }}
                style={{ width: '100%', height: '70px', marginTop: '10px' }}
              />
  
              {/* Legend */}
              {/* Dynamic Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '0.5rem' }}>
                {(() => {
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
                    const parts = cleaned.split(/[\s/]+/);
                    for (const part of parts) {
                      if (baseModeColors[part]) return baseModeColors[part];
                    }
                    return '#999';
                  };

                  const seen = new Set();
                  return selectedBand.subbands
                    .map(sb => (sb.mode || '').trim().toLowerCase())
                    .flatMap(modeStr => modeStr.split(/[\s/]+/)) // split composite modes
                    .filter((mode, i, arr) => mode && !seen.has(mode) && seen.add(mode)) // dedupe
                    .map(mode => (
                      <div key={mode} style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem' }}>
                        <span style={{ width: '14px', height: '14px', backgroundColor: getModeColor(mode), display: 'inline-block', marginRight: '6px' }} />
                        {mode.toUpperCase()}
                      </div>
                    ));
                })()}
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

export default SpectrumLayout;
