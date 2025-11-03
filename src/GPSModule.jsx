import React, { useState, useRef } from 'react';
import { reverseGeocode } from './utils';

const GPSModule = ({ simulatedPath }) => {
  const [running, setRunning] = useState(false);
  const [vehicleId, setVehicleId] = useState(1);
  const [intervalMs, setIntervalMs] = useState(5000);
  const [status, setStatus] = useState('idle');
  const [lastPosition, setLastPosition] = useState(null);
  const [placeName, setPlaceName] = useState('');
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);

  const postPosition = async (lat, lng) => {
    try {
      await fetch('http://localhost:8000/positions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_id: Number(vehicleId), latitude: lat, longitude: lng })
      });
    } catch (err) {
      console.error('Error sending position:', err);
    }
  };

  const handlePositionSuccess = async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    setLastPosition({ lat, lng, timestamp: new Date().toISOString() });
    try {
      const name = await reverseGeocode(lat, lng);
      setPlaceName(name);
    } catch {
      setPlaceName('Unknown location');
    }
    postPosition(lat, lng);
  };

  const handlePositionError = (err) => {
    console.error('Geolocation error:', err);
    setStatus(`error: ${err.message}`);
  };

  const startTracking = () => {
    if (!('geolocation' in navigator)) {
      setStatus('Geolocation not available');
      return;
    }

    // Use watchPosition for continuous updates
    const id = navigator.geolocation.watchPosition(handlePositionSuccess, handlePositionError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    });

    watchIdRef.current = id;

    // Also set an interval fallback that reads currentPosition and re-sends (helps in some browsers)
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(handlePositionSuccess, handlePositionError, { enableHighAccuracy: true });
    }, Number(intervalMs));

    setRunning(true);
    setStatus('tracking');
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
    setStatus('stopped');
  };

  const toggleTracking = () => {
    if (running) stopTracking(); else startTracking();
  };

  const sendOnce = () => {
    if (!('geolocation' in navigator)) {
      setStatus('Geolocation not available');
      return;
    }
    navigator.geolocation.getCurrentPosition(handlePositionSuccess, handlePositionError, { enableHighAccuracy: true });
  };

  const sendSimulatedPosition = () => {
    if (!simulatedPath || simulatedPath.length === 0) {
      setStatus('No simulated path available');
      return;
    }
    // Send the first point of the simulated path (or random/current for demo)
    const idx = Math.floor(Math.random() * simulatedPath.length);
    const [lat, lng] = simulatedPath[idx];
    setLastPosition({ lat, lng, timestamp: new Date().toISOString() });
    reverseGeocode(lat, lng)
      .then(name => setPlaceName(name))
      .catch(() => setPlaceName('Unknown location'));
    postPosition(lat, lng);
  };

  return (
    <div className="gps-module">
      <h3>GPS Module</h3>
      <div className="input-row">
        <label>Vehicle ID:</label>
        <input
          type="number"
          id="vehicleId"
          value={vehicleId}
          onChange={e => setVehicleId(e.target.value)}
          placeholder="Enter Vehicle ID"
          style={{ border: vehicleId ? '2px solid #f472b6' : '1px solid #cfd8e3', background: '#fff', color: '#222' }}
          disabled={false}
        />
      </div>
      <div className="input-row">
        <label>Interval (ms):</label>
        <input
          type="number"
          id="interval"
          value={intervalMs}
          onChange={e => setIntervalMs(e.target.value)}
          placeholder="Interval (ms)"
          style={{ background: '#fff', color: '#222' }}
          disabled={false}
        />
      </div>
      <div className="gps-controls">
        <button type="button" onClick={toggleTracking}>{running ? 'Stop Tracking' : 'Start Tracking'}</button>
        <button type="button" onClick={sendOnce}>Send Current Position</button>
        <button
          onClick={sendSimulatedPosition}
          disabled={!(simulatedPath && simulatedPath.length > 0)}
          style={{
            background: simulatedPath && simulatedPath.length > 0 ? 'linear-gradient(90deg,#6366f1,#f472b6)' : '#a5b4fc',
            color: '#fff',
            cursor: simulatedPath && simulatedPath.length > 0 ? 'pointer' : 'not-allowed',
            opacity: simulatedPath && simulatedPath.length > 0 ? 1 : 0.7
          }}
        >
          Send Simulated Route Position
        </button>
      </div>
      <div className="gps-status">
        <p>Status: {(!simulatedPath || simulatedPath.length === 0) ? 'No simulated route loaded. Enter From/To and Start Journey.' : status}</p>
        {lastPosition && (
          <>
            {/* Remove display of last location completely */}
            {/* <p>Last: {placeName ? placeName : `${lastPosition.lat.toFixed(6)}, ${lastPosition.lng.toFixed(6)}`}</p> */}
            {/* <p>@ {lastPosition.timestamp}</p> */}
          </>
        )}
      </div>
    </div>
  );
};

GPSModule.defaultProps = {
  simulatedPath: [],
};

export default GPSModule;

