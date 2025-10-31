import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L, { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './VehicleMap.css'; // ✅ Make sure this file exists (see below)
import { reverseGeocode } from './utils';

// Marker icons
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import startIconImg from './assets/start.png';
import stopIconImg from './assets/stop.png';
import vehicleIconImg from './assets/vehicle.png';

// ✅ Fix default Leaflet icon issue (important for React builds)
const DefaultIcon = L.icon({
  iconUrl,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// ✅ Utility: Create custom icon
const createIcon = (iconUrl, iconSize = [32, 32]) => {
  return L.icon({
    iconUrl,
    iconSize,
    iconAnchor: [iconSize[0] / 2, iconSize[1]],
    popupAnchor: [0, -iconSize[1]],
  });
};

// Helper component to fit bounds
function FitBounds({ path }) {
  const map = useMap();
  React.useEffect(() => {
    if (path && path.length > 1) {
      const bounds = path.map(([lat, lng]) => [lat, lng]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, path]);
  return null;
}

const VehicleMap = ({ path, vehiclePosition, waypoints, distance, duration }) => {
  const mapRef = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [placeName, setPlaceName] = useState('');

  // CSS-based waypoint marker
  const createWaypointIcon = (index) =>
    divIcon({
      className: 'waypoint-marker',
      html: `
        <div class="waypoint-container">
          <div class="waypoint-dot"></div>
          <div class="waypoint-label">${index + 1}</div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });

  // Memoize waypoints for performance
  const memoizedWaypoints = React.useMemo(() => {
    if (!path || path.length < 10) return [];
    const step = Math.max(1, Math.floor(path.length / 10));
    return path
      .map((point, index) => ({ point, index }))
      .filter(
        ({ index }) =>
          index % step === 0 && index !== 0 && index !== path.length - 1
      );
  }, [path]);

  // Animation effect for vehicle movement
  useEffect(() => {
    if (!isAnimating || !path || path.length < 2) return;
    let currentIndex = currentPositionIndex;
    let animationFrame;
    const animate = () => {
      if (!isAnimating) return;
      currentIndex = (currentIndex + 1) % path.length;
      setCurrentPositionIndex(currentIndex);
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.setLatLng(path[currentIndex]);
      }
      if (mapRef.current) {
        mapRef.current.flyTo(path[currentIndex], mapRef.current.getZoom(), {
          duration: 0.5,
          easeLinearity: 0.1,
        });
      }
      if (currentIndex < path.length - 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isAnimating, path, currentPositionIndex]);

  // Live reverse geocode for current vehicle position
  useEffect(() => {
    let intervalId;
    const updateLocation = () => {
      const pos = isAnimating && path && path[currentPositionIndex]
        ? path[currentPositionIndex]
        : vehiclePosition || (path && path[0]);
      if (pos && pos.length === 2) {
        reverseGeocode(pos[0], pos[1])
          .then(name => setPlaceName(name))
          .catch(() => setPlaceName('Unknown location'));
      }
    };
    updateLocation();
    intervalId = setInterval(updateLocation, 5000); // Update every 5 seconds
    return () => clearInterval(intervalId);
  }, [isAnimating, currentPositionIndex, vehiclePosition, path]);

  // Handle empty route
  if (!path || path.length === 0) {
    return <div className="map-loading" role="status">Loading map or no route available...</div>;
  }

  const start = path[0];
  const stop = path[path.length - 1];
  const isRoundTrip = JSON.stringify(start) === JSON.stringify(stop);
  const currentPosition =
    isAnimating && path[currentPositionIndex]
      ? path[currentPositionIndex]
      : vehiclePosition || start;

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      {/* Live place name display */}
      <div style={{
        position: 'absolute',
        top: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
        background: 'rgba(255,255,255,0.95)',
        borderRadius: 8,
        padding: '0.6rem 1.2rem',
        fontWeight: 600,
        color: '#2563eb',
        boxShadow: '0 2px 8px 0 rgba(60,72,88,0.07)',
        fontSize: '1.08rem',
        maxWidth: '90vw',
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        {placeName ? `Current Location: ${placeName}` : 'Locating...'}
      </div>
      <MapContainer
        center={path && path.length > 0 ? path[0] : [0, 0]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        whenCreated={(map) => (mapRef.current = map)}
        aria-label="Vehicle Map"
      >
        {path && path.length > 1 && <FitBounds path={path} />}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Polyline
          positions={path}
          color="blue"
          weight={4}
          opacity={0.7}
          className="route-path"
        />
        {/* Start Marker */}
        <Marker position={start} icon={createIcon(startIconImg)}>
          <Popup>
            <h3>Start Point</h3>
            <p>Lat: {start[0].toFixed(6)}</p>
            <p>Lng: {start[1].toFixed(6)}</p>
          </Popup>
        </Marker>
        {/* Waypoints */}
        {memoizedWaypoints.map(({ point, index }) => (
          <Marker
            key={`wp-${index}`}
            position={point}
            icon={createWaypointIcon(index)}
          >
            <Popup>
              <strong>Waypoint {index + 1}</strong>
              <p>Lat: {point[0].toFixed(6)}</p>
              <p>Lng: {point[1].toFixed(6)}</p>
            </Popup>
          </Marker>
        ))}
        {/* Vehicle Marker */}
        <Marker
          position={currentPosition}
          icon={createIcon(vehicleIconImg)}
          ref={vehicleMarkerRef}
        >
          <Popup>
            <h3>Vehicle</h3>
            <p>Lat: {currentPosition[0].toFixed(6)}</p>
            <p>Lng: {currentPosition[1].toFixed(6)}</p>
            {distance > 0 && (
              <p>Total Distance: {(distance / 1000).toFixed(2)} km</p>
            )}
            {duration > 0 && (
              <p>
                Duration: {Math.floor(duration / 60)}m {Math.floor(duration % 60)}s
              </p>
            )}
            <p>
              Progress: {Math.round((currentPositionIndex / path.length) * 100)}%
            </p>
          </Popup>
        </Marker>
        {/* Destination Marker */}
        {!isRoundTrip && (
          <Marker position={stop} icon={createIcon(stopIconImg)}>
            <Popup>
              <h3>Destination</h3>
              <p>Lat: {stop[0].toFixed(6)}</p>
              <p>Lng: {stop[1].toFixed(6)}</p>
            </Popup>
          </Marker>
        )}
      </MapContainer>
      {/* Start/Stop Button */}
      <button
        onClick={() => setIsAnimating((prev) => !prev)}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 1000,
          padding: '8px 16px',
          backgroundColor: isAnimating ? '#e63946' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}
        aria-pressed={isAnimating}
        aria-label={isAnimating ? 'Stop Vehicle Animation' : 'Start Vehicle Animation'}
      >
        {isAnimating ? 'Stop Vehicle' : 'Start Vehicle'}
      </button>
    </div>
  );
};

VehicleMap.propTypes = {
  path: PropTypes.arrayOf(
    PropTypes.arrayOf(PropTypes.number)
  ),
  vehiclePosition: PropTypes.arrayOf(PropTypes.number),
  waypoints: PropTypes.array,
  distance: PropTypes.number,
  duration: PropTypes.number,
};

VehicleMap.defaultProps = {
  path: [],
  vehiclePosition: null,
  waypoints: [],
  distance: 0,
  duration: 0,
};

export default VehicleMap;