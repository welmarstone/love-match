import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation } from 'lucide-react';

export default function MapTracker({ locations, userId, userName, partnerName, onLocationUpdate }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const polylineRef = useRef(null);
  const [distance, setDistance] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const watchIdRef = useRef(null);

  const partner1 = locations.partner1 || { lat: 50.0755, lng: 14.4378, name: 'Prague' };
  const partner2 = locations.partner2 || { lat: 39.3008, lng: 16.2521, name: 'Cosenza' };

  // Calculate distance
  useEffect(() => {
    if (partner1.lat && partner2.lat) {
      const dist = calculateHaversine(partner1.lat, partner1.lng, partner2.lat, partner2.lng);
      setDistance(dist);
    }
  }, [partner1, partner2]);

  // Haversine formula
  const calculateHaversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create map instance
    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([44.5, 15.0], 5); // Midpoint Europe (Prague-Cosenza range)

    // Add Dark Matter Tile Layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers & line
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Custom Marker Icons
    const createHtmlIcon = (color, name) => {
      return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="
              background-color: ${color}; 
              width: 14px; 
              height: 14px; 
              border-radius: 50%; 
              border: 2px solid #fff; 
              box-shadow: 0 0 10px ${color}, 0 0 20px ${color};
              animation: heartPulseGlow 2s infinite;
            "></div>
            <div style="
              background: rgba(0,0,0,0.85);
              color: #f0e6e7;
              padding: 2px 6px;
              border-radius: 6px;
              font-size: 10px;
              font-family: 'Outfit';
              border: 1px solid ${color}55;
              white-space: nowrap;
              margin-top: 4px;
            ">${name}</div>
          </div>
        `,
        iconSize: [60, 40],
        iconAnchor: [30, 7],
      });
    };

    // Remove existing markers if any
    if (markersRef.current.partner1) map.removeLayer(markersRef.current.partner1);
    if (markersRef.current.partner2) map.removeLayer(markersRef.current.partner2);
    if (polylineRef.current) map.removeLayer(polylineRef.current);

    // Create markers
    const name1 = userId === 'partner1' ? userName || 'Me' : partnerName || 'Partner';
    const name2 = userId === 'partner2' ? userName || 'Me' : partnerName || 'Partner';

    const p1Marker = L.marker([partner1.lat, partner1.lng], {
      icon: createHtmlIcon('#e5b3a6', name1),
    }).addTo(map);

    const p2Marker = L.marker([partner2.lat, partner2.lng], {
      icon: createHtmlIcon('#8ed0f8', name2),
    }).addTo(map);

    markersRef.current = { partner1: p1Marker, partner2: p2Marker };

    // Draw dashed connecting line
    const linePoints = [
      [partner1.lat, partner1.lng],
      [partner2.lat, partner2.lng],
    ];

    const polyline = L.polyline(linePoints, {
      color: '#e5b3a6',
      dashArray: '5, 10',
      weight: 2.5,
      opacity: 0.7,
    }).addTo(map);

    polylineRef.current = polyline;

    // Fit map bounds to show both markers
    const group = new L.featureGroup([p1Marker, p2Marker]);
    map.fitBounds(group.getBounds().pad(0.2));
  }, [partner1, partner2, userId, userName, partnerName]);

  // Geolocation trigger
  const updateLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onLocationUpdate(latitude, longitude);
        setErrorMsg('');
      },
      (error) => {
        console.error('Error fetching GPS:', error);
        setErrorMsg('Could not fetch location. Please enable location services.');
      },
      { enableHighAccuracy: true }
    );
  };

  // Watch position toggle
  useEffect(() => {
    if (isTracking) {
      if (!navigator.geolocation) {
        setErrorMsg('Geolocation not supported');
        setIsTracking(false);
        return;
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          onLocationUpdate(latitude, longitude);
        },
        (error) => {
          console.error(error);
          setErrorMsg('GPS Tracking error. Turned off.');
          setIsTracking(false);
        },
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
    } else {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isTracking]);

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h2 className="romantic-title" style={{ fontSize: '24px', marginBottom: '4px' }}>Space Between Us</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '15px' }}>
        Live coordinates mapping your connection
      </p>

      {/* Map Element */}
      <div className="map-container-wrapper">
        {/* Distance Banner */}
        <div className="distance-overlay">
          <div className="partner-names">
            {userId === 'partner1' ? userName || 'Me' : partnerName || 'Partner'} 
            <span> &harr; </span>
            {userId === 'partner2' ? userName || 'Me' : partnerName || 'Partner'}
          </div>
          <div className="distance-value">
            {distance.toFixed(2)} km
          </div>
        </div>
        <div ref={mapContainerRef}></div>
      </div>

      {errorMsg && (
        <p style={{ color: '#ff6666', fontSize: '12px', marginTop: '10px', textAlign: 'center' }}>
          {errorMsg}
        </p>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
        <button className="btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={updateLocation}>
          <MapPin size={16} /> Update Location
        </button>
        <button
          className={`btn-secondary ${isTracking ? 'btn-primary' : ''}`}
          style={{ flex: 1, padding: '10px', background: isTracking ? 'rgba(142,208,248,0.2)' : '' }}
          onClick={() => setIsTracking(!isTracking)}
        >
          <Navigation size={16} className={isTracking ? 'animate-pulse' : ''} />
          {isTracking ? 'Tracking ON' : 'Live Tracking'}
        </button>
      </div>
    </div>
  );
}
