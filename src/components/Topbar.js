import React from 'react';
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
  setRegion
}) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <img src="/favicon.png" alt="SignalAtlas Logo" className="topbar-logo" />
        <h1 className="topbar-title">SignalAtlas</h1>
      </div>
      <div className="topbar-controls">
        <input
          type="text"
          value={frequency}
          onChange={(e) => onFrequencyChange(e.target.value)}
          placeholder="Enter frequency (e.g. 4625, 2.4G)"
          className="topbar-input"
        />
        <button className="topbar-button" onClick={onGo}>Go</button>
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
          <option>United States</option>
          <option>Europe</option>
          <option>APAC</option>
        </select>
      </div>
    </div>
  );
}

export default Topbar;
