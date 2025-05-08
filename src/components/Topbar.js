import React, { useState, useEffect, useRef } from 'react';
import './Topbar.css';

function Topbar({
  frequency,
  onFrequencyChange,
  onGo,
  onReset,
  showAllocations,
  setShowAllocations,
  showBands,
  setShowBands,
  region,
  setRegion,
  bands,
  detailedBands,
  suggestions,
  setSuggestions,
  zoomToBand
}) {

  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [bandDropdownOpen, setBandDropdownOpen] = useState(false);
  const dropdownRef = useRef();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setBandDropdownOpen(false);
      }
    };
  
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <img src={process.env.PUBLIC_URL + '/soundwave.png'} alt="waveform image" className="topbar-logo" />
        <h1 className="topbar-title">Spectrum Explorer</h1>
      </div>
      <div className="dropdown-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          className="topbar-button"
          onClick={() => setBandDropdownOpen((prev) => !prev)}
          aria-label={bandDropdownOpen ? 'Hide band list' : 'Show band list'}
          style={{ position: 'relative', zIndex: 21 }}
        >
          Bands ▼
        </button>

        {bandDropdownOpen && (
          <div
            className="band-dropdown"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              backgroundColor: '#1e1e1e',
              border: '1px solid #333',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              zIndex: 20,
              padding: '6px 0',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '250px',
              overflowY: 'auto',
              minWidth: '160px',
              borderRadius: '6px',
            }}
          >
            {bands.slice(0, 8).map((band, i) => (
              <button
                key={i}
                className="band-dropdown-button"
                onClick={() => {
                  zoomToBand(band);
                  setBandDropdownOpen(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  textAlign: 'left',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  width: '100%',
                  fontSize: '0.95rem',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#333')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {band.name || band.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="topbar-controls">
      <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={frequency}
            onChange={(e) => {
              const val = e.target.value;
              onFrequencyChange(val);

              const lowerVal = val.toLowerCase();
              const combined = [...bands, ...detailedBands];
              const filtered = combined
                .filter(b => (b.label || b.name || '').toLowerCase().includes(lowerVal))
                .slice(0, 5);

              setSuggestions(filtered);
              setHighlightedIndex(-1);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            onKeyDown={(e) => {
              if (suggestions.length === 0) return;

              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                  prev <= 0 ? suggestions.length - 1 : prev - 1
                );
              } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                const selected = suggestions[highlightedIndex];
                onFrequencyChange((selected.label || selected.name) || '');
                setSuggestions([]);
                const fakeEvent = {
                  preventDefault: () => {},
                  target: {
                    elements: { freq: { value: selected.start.toString() } }
                  }
                };
                onGo(fakeEvent);
              }
            }}
            placeholder="Enter frequency or label (e.g. 144.39 MHz)"
            className="topbar-input"
          />
          <button className="topbar-button" onClick={onGo}>Go</button>

          {isFocused && suggestions.length > 0 && (
            <ul
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                width: '100%',
                backgroundColor: '#1e1e1e',
                color: '#fff',
                listStyle: 'none',
                margin: 0,
                padding: '4px 0',
                border: '1px solid #333',
                zIndex: 10,
                maxHeight: '150px',
                overflowY: 'auto',
              }}
            >
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    backgroundColor: i === highlightedIndex ? '#444' : 'transparent'
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur
                    onFrequencyChange((s.label || s.name) || '');
                    setSuggestions([]);
                    const fakeEvent = {
                      preventDefault: () => {},
                      target: {
                        elements: { freq: { value: s.start.toString() } }
                      }
                    };
                    onGo(fakeEvent);
                  }}
                >
                  {(s.label || s.name)} — {(s.start / 1e6).toFixed(3)} MHz
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="topbar-button" onClick={onReset}>Reset Zoom</button>

        <label className="topbar-checkbox">
          <input
            type="checkbox"
            checked={showAllocations}
            onChange={(e) => setShowAllocations(e.target.checked)}
          />
          Show Allocations
        </label>

        <label className="topbar-checkbox">
          <input
            type="checkbox"
            checked={showBands}
            onChange={(e) => setShowBands(e.target.checked)}
          />
          Show Band Markers
        </label>

        <select
          className="topbar-select"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="ITU1">Europe & Africa</option>
          <option value="ITU2">Americas</option>
          <option value="ITU3">APAC</option>
        </select>
      </div>
    </div>
  );
}

export default Topbar;
