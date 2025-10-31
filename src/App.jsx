import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VehicleMap from './VehicleMap';
import GPSModule from './GPSModule';
import './App.css';

// Polyline decoder utility
const decodePolyline = (encoded) => {
  const poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    poly.push([lat * 1e-5, lng * 1e-5]);
  }
  
  return poly;
};

const geocodePlace = async (place) => {
  // Use Nominatim OpenStreetMap API for geocoding
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data && data.length > 0) {
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  }
  throw new Error(`Could not geocode: ${place}`);
};

const App = () => {
  const [path, setPath] = useState([]);
  const [vehiclePosition, setVehiclePosition] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [waypoints, setWaypoints] = useState([]);
  const [liveLocation, setLiveLocation] = useState('');

  // Fetch optimal route from OSRM
  const fetchOptimalRoute = useCallback(async (coords) => {
    try {
      const coordsString = coords.map(c => `${c[1]},${c[0]}`).join(';');
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&alternatives=false&steps=true`
      );
      if (!response.ok) throw new Error('Failed to fetch route from OSRM');
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        setDistance(data.routes[0].distance);
        setDuration(data.routes[0].duration);
        return data.routes[0].geometry;
      }
      return null;
    } catch (error) {
      setError('Error fetching route. Please try again.');
      return null;
    }
  }, []);

  // Handle place input
  const handlePlaceSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (!from.trim() || !to.trim()) {
        setError('Please enter both From and To places.');
        setIsLoading(false);
        return;
      }
      // Geocode both places
      const fromCoord = await geocodePlace(from);
      const toCoord = await geocodePlace(to);
      const coords = [fromCoord, toCoord];
      setWaypoints(coords);
      // Get optimal road route
      const routeGeometry = await fetchOptimalRoute(coords);
      const displayPath = routeGeometry 
        ? decodePolyline(routeGeometry) 
        : coords;
      setPath(displayPath);
      if (displayPath.length > 0) {
        setVehiclePosition(displayPath[0]);
      }
    } catch (err) {
      setError(err.message || 'Failed to process places.');
    } finally {
      setIsLoading(false);
    }
  }, [from, to, fetchOptimalRoute]);

  // Smooth vehicle animation
  useEffect(() => {
    if (path.length < 2) return;
    const totalPoints = path.length;
    let currentIndex = 0;
    let animationFrame;
    const interval = duration ? (duration * 1000) / totalPoints : 100;
    const animate = () => {
      currentIndex = (currentIndex + 1) % totalPoints;
      setVehiclePosition(path[currentIndex]);
      animationFrame = setTimeout(animate, interval);
    };
    animationFrame = setTimeout(animate, interval);
    return () => clearTimeout(animationFrame);
  }, [path, duration]);

  // Fetch current live location from backend
  const fetchLiveLocation = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/positions/latest/1'); // vehicle_id=1
      if (!response.ok) throw new Error('Failed to fetch live location');
      const data = await response.json();
      setLiveLocation(data.live_location || 'Unknown location');
    } catch {
      setLiveLocation('Unknown location');
    }
  }, []);

  useEffect(() => {
    fetchLiveLocation();
    const interval = setInterval(fetchLiveLocation, 5000); // update every 5s
    return () => clearInterval(interval);
  }, [fetchLiveLocation]);

  return (
    <Router>
      <div className="app-container">
        <div className="control-panel">
          <h2>Vehicle Route Planner</h2>
          <div style={{marginBottom: '1rem', fontWeight: 500, color: '#2563eb'}}>
            Current Live Location: {liveLocation}
          </div>
          <form onSubmit={handlePlaceSubmit} autoComplete="off" aria-label="Route Input Form">
            <div className="input-group">
              <label htmlFor="from">From:</label>
              <input
                type="text"
                id="from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="e.g., Coimbatore Railway Station"
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="to">To:</label>
              <input
                type="text"
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="e.g., Karunya University"
                required
              />
            </div>
            <button type="submit" disabled={isLoading} aria-busy={isLoading}>
              {isLoading ? 'Calculating Route...' : 'Start Journey'}
            </button>
          </form>
          {error && <div className="error" role="alert">{error}</div>}
          {distance > 0 && (
            <div className="route-info">
              <h3>Route Information</h3>
              <p>Distance: {(distance/1000).toFixed(2)} km</p>
              <p>Estimated Duration: {Math.floor(duration/60)} min {Math.floor(duration%60)} sec</p>
              <p>Waypoints: {waypoints.length}</p>
            </div>
          )}
          <GPSModule />
        </div>
        <div className="map-container">
          <Routes>
            <Route path="/" element={
              <>
                <VehicleMap 
                  path={path} 
                  vehiclePosition={vehiclePosition}
                  waypoints={waypoints}
                  distance={distance}
                  duration={duration}
                />
                <GPSModule simulatedPath={path} />
              </>
            } />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;