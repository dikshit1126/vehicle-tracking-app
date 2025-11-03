import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import VehicleMap from "./VehicleMap";
import GPSModule from "./GPSModule";
import Login from "./Login";
import "./App.css";
import markerIconImg from "./assets/marker.png";
import companyLogo from "./assets/company-logo.png"; // ✅ Added local logo import

// --- Polyline Decoder ---
const decodePolyline = (encoded) => {
  const poly = [];
  let index = 0,
    len = encoded.length,
    lat = 0,
    lng = 0;
  while (index < len) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    poly.push([lat * 1e-5, lng * 1e-5]);
  }
  return poly;
};

// --- Geocode helper ---
const geocodePlace = async (place) => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.length > 0)
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  throw new Error(`Could not find: ${place}`);
};

// --- Dashboard Page ---
const Dashboard = ({
  user,
  vehicleTypes,
  selectedType,
  setSelectedType,
  availableVehicles,
  vehicleId,
  setVehicleId,
  vehicleStatus,
  from,
  setFrom,
  to,
  setTo,
  isLoading,
  handleRoute,
  error,
  distance,
  duration,
  path,
  vehiclePosition,
  liveLocation,
  lastCoords,
  liveRoad,
  liveArea,
}) => (
  <div className="dashboard-container neon-bg">
    {/* Live Location Banner */}
    <div
      style={{
        position: "absolute",
        top: 18,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1200,
        background: "rgba(255,255,255,0.95)",
        borderRadius: 8,
        padding: "0.6rem 1.2rem",
        fontWeight: 600,
        color: "#2563eb",
        boxShadow: "0 2px 8px 0 rgba(60,72,88,0.07)",
        fontSize: "1.08rem",
        maxWidth: "90vw",
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      {liveRoad || liveArea ? (
        <>
          {liveRoad && (
            <span>
              Road: <b>{liveRoad}</b>
            </span>
          )}
          {liveRoad && liveArea && <span> &nbsp;|&nbsp; </span>}
          {liveArea && (
            <span>
              Area: <b>{liveArea}</b>
            </span>
          )}
        </>
      ) : liveLocation ? (
        `Current Location: ${liveLocation}`
      ) : lastCoords ? (
        `Current Location: ${lastCoords[0]},${lastCoords[1]}`
      ) : (
        "Locating..."
      )}
    </div>

    {/* Sidebar */}
    <aside className="sidebar neon-glass">
      <div className="brand neon-title">
        <img
          src={companyLogo} // ✅ Local logo
          alt="Company Vehicle Tracker Logo"
          className="logo neon-glow"
          style={{
            width: "48px",
            height: "48px",
            marginRight: "10px",
            filter: "drop-shadow(0 0 6px #00ffff)", // ✅ subtle neon glow
          }}
        />
        <h2>Company Vehicle Tracker</h2>
      </div>

      <div className="user-info neon-section">
        <p>
          <strong>User:</strong> {user?.username}
        </p>
        <p>
          <strong>Company Code:</strong> {user?.companyCode}
        </p>
      </div>

      <div className="selector neon-section">
        <label>Vehicle Type</label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="neon-input"
        >
          {vehicleTypes.map((v) => (
            <option key={v.type} value={v.type}>
              {v.type}
            </option>
          ))}
        </select>

        <label>Vehicle ID</label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="neon-input"
        >
          {availableVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <div className="vehicle-status">
          <span className={`status-dot ${vehicleStatus}`}></span>{" "}
          <b
            style={{
              color: vehicleStatus === "online" ? "#00ffe7" : "#ff3c7e",
            }}
          >
            {vehicleStatus.toUpperCase()}
          </b>
        </div>
      </div>
    </aside>

    {/* Control Panel */}
    <section className="control-panel neon-glass neon-section">
      <h3 className="neon-title">📍 Plan Your Vehicle Route</h3>
      <form onSubmit={handleRoute} className="route-form">
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="From Location"
          required
          className="neon-input"
        />
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="To Location"
          required
          className="neon-input"
        />
        <button type="submit" disabled={isLoading} className="neon-btn">
          {isLoading ? "Calculating..." : "Start Journey"}
        </button>
      </form>
      {error && <p className="error-text neon-error">{error}</p>}
      {distance > 0 && (
        <div className="route-info neon-section">
          <p>
            <b>Distance:</b> {(distance / 1000).toFixed(2)} km
          </p>
          <p>
            <b>Duration:</b> {Math.round(duration / 60)} mins
          </p>
        </div>
      )}
      <GPSModule simulatedPath={path} />
    </section>

    {/* Map */}
    <main className="map-area neon-glass neon-section">
      <VehicleMap
        path={path}
        vehiclePosition={vehiclePosition}
        waypoints={path}
        distance={distance}
        duration={duration}
        vehicleIcon={markerIconImg}
      />
    </main>

    <footer className="live-location neon-section">
      <p>
        <strong>Live Location:</strong> {liveLocation}
      </p>
    </footer>
  </div>
);

const App = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [path, setPath] = useState([]);
  const [vehiclePosition, setVehiclePosition] = useState(null);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vehicleStatus, setVehicleStatus] = useState("offline");
  const [liveLocation, setLiveLocation] = useState("");
  const [lastCoords, setLastCoords] = useState(null);
  const [liveRoad, setLiveRoad] = useState("");
  const [liveArea, setLiveArea] = useState("");

  const vehiclePositionRef = useRef(vehiclePosition);
  useEffect(() => {
    vehiclePositionRef.current = vehiclePosition;
  }, [vehiclePosition]);

  const vehicleTypesData = [
    { type: "Car", vehicles: Array.from({ length: 12 }, (_, i) => ({ id: `car${i + 1}`, name: `Car ${i + 1}` })) },
    { type: "Bike", vehicles: Array.from({ length: 12 }, (_, i) => ({ id: `bike${i + 1}`, name: `Bike ${i + 1}` })) },
    { type: "Bus", vehicles: Array.from({ length: 12 }, (_, i) => ({ id: `bus${i + 1}`, name: `Bus ${i + 1}` })) },
    { type: "Auto", vehicles: Array.from({ length: 12 }, (_, i) => ({ id: `auto${i + 1}`, name: `Auto ${i + 1}` })) },
    { type: "Lorry", vehicles: Array.from({ length: 12 }, (_, i) => ({ id: `lorry${i + 1}`, name: `Lorry ${i + 1}` })) },
  ];

  const [vehicleTypes] = useState(vehicleTypesData);
  const [selectedType, setSelectedType] = useState(vehicleTypesData[0].type);
  const [availableVehicles, setAvailableVehicles] = useState(vehicleTypesData[0].vehicles);
  const [vehicleId, setVehicleId] = useState(vehicleTypesData[0].vehicles[0].id);

  useEffect(() => {
    const found = vehicleTypes.find((vt) => vt.type === selectedType);
    setAvailableVehicles(found ? found.vehicles : []);
    setVehicleId(found?.vehicles[0]?.id || "");
  }, [selectedType, vehicleTypes]);

  useEffect(() => {
    if (path.length < 2) return;
    const totalPoints = path.length;
    let currentIndex = 0;
    let animationFrame;
    const interval = duration ? (duration * 1000) / totalPoints : 100;
    const animate = () => {
      currentIndex++;
      if (currentIndex < totalPoints) {
        setVehiclePosition(path[currentIndex]);
        animationFrame = setTimeout(animate, interval);
      } else {
        setVehicleStatus("completed");
      }
    };
    animationFrame = setTimeout(animate, interval);
    return () => clearTimeout(animationFrame);
  }, [path, duration]);

  useEffect(() => {
    let intervalId;
    const fetchLocationDetails = async () => {
      const pos = vehiclePositionRef.current;
      if (!pos) return;
      try {
        const [lat, lon] = pos;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
        );
        const data = await res.json();
        const road =
          data.address?.road ||
          data.address?.neighbourhood ||
          data.address?.pedestrian ||
          data.address?.highway ||
          "Unknown Road";
        const area =
          data.address?.suburb ||
          data.address?.village ||
          data.address?.town ||
          data.address?.city ||
          data.address?.county ||
          "Unknown Area";
        setLiveRoad(road);
        setLiveArea(area);
        setLiveLocation(`${road}, ${area}`);
        setLastCoords([lat.toFixed(5), lon.toFixed(5)]);
      } catch (err) {
        console.error("Reverse geocoding failed:", err);
      }
    };
    if (vehicleStatus === "online" && vehiclePositionRef.current) {
      fetchLocationDetails();
      intervalId = setInterval(fetchLocationDetails, 10000);
    }
    return () => intervalId && clearInterval(intervalId);
  }, [vehicleStatus]);

  const handleLogin = async (userData) => {
    setUser(userData);
    setLoggedIn(true);
    try {
      await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: userData.username,
          companyCode: userData.companyCode,
          vehicleId: userData.vehicleId,
          login_time: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error("Failed to save login info", e);
    }
  };

  const fetchOptimalRoute = useCallback(async (coords) => {
    try {
      const coordsString = coords.map((c) => `${c[1]},${c[0]}`).join(";");
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full`
      );
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        setDistance(data.routes[0].distance);
        setDuration(data.routes[0].duration);
        return data.routes[0].geometry;
      }
      return null;
    } catch {
      setError("Route fetch failed");
      return null;
    }
  }, []);

  const handleRoute = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const fromCoord = await geocodePlace(from);
      const toCoord = await geocodePlace(to);
      const geometry = await fetchOptimalRoute([fromCoord, toCoord]);
      let decoded = [fromCoord, toCoord];
      if (geometry) decoded = decodePolyline(geometry);
      setPath(decoded);
      setVehiclePosition(decoded[0]);
      setVehicleStatus("online");
      setLiveLocation("");
      setLiveRoad("");
      setLiveArea("");
      setLastCoords(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            loggedIn ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />
          }
        />
        <Route
          path="/dashboard"
          element={
            loggedIn ? (
              <Dashboard
                user={user}
                vehicleTypes={vehicleTypes}
                selectedType={selectedType}
                setSelectedType={setSelectedType}
                availableVehicles={availableVehicles}
                vehicleId={vehicleId}
                setVehicleId={setVehicleId}
                vehicleStatus={vehicleStatus}
                from={from}
                setFrom={setFrom}
                to={to}
                setTo={setTo}
                isLoading={isLoading}
                handleRoute={handleRoute}
                error={error}
                distance={distance}
                duration={duration}
                path={path}
                vehiclePosition={vehiclePosition}
                liveLocation={liveLocation}
                lastCoords={lastCoords}
                liveRoad={liveRoad}
                liveArea={liveArea}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
