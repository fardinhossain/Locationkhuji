import React, { useEffect, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";

/**
 * BangladeshMask Component
 * 
 * Renders the authoritative Bangladesh boundary from the provided bd.json.
 * Uses native Leaflet GeoJSON handling to prevent coordinate order issues 
 * and geometry corruption (spirals/loops).
 */
export default function BangladeshMask() {
  const [geoData, setGeoData] = useState(null);
  const map = useMap();

  useEffect(() => {
    // Fetch the authoritative bd.json from public directory
    fetch("/data/bd.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch bd.json");
        return res.json();
      })
      .then((data) => {
        setGeoData(data);
        
        // Use Leaflet's native bounds calculation to fit the country perfectly
        const geojsonLayer = L.geoJSON(data);
        const bounds = geojsonLayer.getBounds();
        
        if (bounds.isValid()) {
          // Store bounds for MapView consistency if needed, 
          // but we fit the map initially here for precision.
          map.fitBounds(bounds, { padding: [30, 30], animate: false });
        }
      })
      .catch((err) => console.error("GIS Error: Could not load Bangladesh boundary:", err));
  }, [map]);

  if (!geoData) return null;

  return (
    <GeoJSON
      data={geoData}
      style={{
        color: "#00C9A7",
        weight: 2,
        opacity: 0.8,
        fillColor: "#00C9A7",
        fillOpacity: 0.05, // Subtle fill inside BD
        lineJoin: "round",
        lineCap: "round",
      }}
      interactive={false}
    />
  );
}

// These are general fallback bounds, though the component now 
// calculates them dynamically from the GeoJSON for accuracy.
export const BD_BOUNDS = [
  [20.3, 88.0],
  [26.7, 92.7],
];
