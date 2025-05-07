import React from 'react';
import SpectrumView from './components/SpectrumView';

function App() {
  return (
    <div className="App">
      {/* Header container with logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '20px' }}>
      <img 
        src={process.env.PUBLIC_URL + '/favicon.png'}
        alt="SignalAtlas Logo"
        style={{ width: '40px', height: '40px', objectFit: 'contain' }}
      />
        <h1 style={{ margin: '0', fontSize: '2rem', fontWeight: 'bold', color: 'white' }}>
          SignalAtlas
        </h1>
      </div>
      <SpectrumView />
    </div>
  );
}

export default App;
