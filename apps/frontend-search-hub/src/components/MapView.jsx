import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap, ZoomControl } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { FaHome, FaPills, FaHospital, FaUtensils, FaBriefcase, FaWrench, FaBolt, FaBroom, FaPaintRoller, FaBug, FaCamera, FaTools } from "react-icons/fa";
import { Link } from "react-router-dom";
import { CategoryBadge, StarRating } from "./ListingCard";
import BangladeshMask from "./BangladeshMask";
import { useThemeStore, useLangStore } from "../store";
import { useTranslation } from "react-i18next";

const SERVICE_ICONS = {
  Plumber: FaWrench,
  Electrician: FaBolt,
  "AC Technician": FaTools,
  Cleaner: FaBroom,
  Carpenter: FaTools,
  "Event Manager": FaBriefcase,
  Photographer: FaCamera,
  "Pest Control": FaBug,
  "Fixing Service": FaWrench,
  Painter: FaPaintRoller
};

const ICON_MAP = { flat: FaHome, pharmacy: FaPills, hospital: FaHospital, restaurant: FaUtensils, service: FaBriefcase };

const makeIcon = (listing) => {
  let Icon = ICON_MAP[listing.category] || FaHome;
  let serviceClass = "";
  if (listing.category === "service" && listing.details?.service_type) {
    Icon = SERVICE_ICONS[listing.details.service_type] || FaBriefcase;
    serviceClass = " service-" + listing.details.service_type.toLowerCase().replace(/\s+/g, '-');
  }
  const html = `<div class="lk-marker ${listing.category}${serviceClass}">${renderToStaticMarkup(<Icon size={14} />)}</div>`;
  return L.divIcon({ html, className: "", iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -36] });
};

const userIcon = L.divIcon({
  html: `<div style="position:relative;width:24px;height:24px;">
    <div style="position:absolute;inset:0;border-radius:50%;background:rgba(0,201,167,0.4);" class="animate-pulse-ring"></div>
    <div style="position:absolute;inset:6px;border-radius:50%;background:#00C9A7;border:3px solid white;box-shadow:0 2px 8px rgba(0,201,167,0.5);"></div>
  </div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function MapClicker({ onClick }) {
  useMapEvents({ click: (e) => onClick && onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function MapUpdater({ center, radius }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      if (radius && radius > 0) {
        // Calculate bounds from radius mathematically (no L.circle needed)
        // 1 degree latitude ≈ 111.32 km everywhere on Earth
        const kmPerDeg = 111.32;
        const latOffset = radius / kmPerDeg;
        const lngOffset = radius / (kmPerDeg * Math.cos(center[0] * Math.PI / 180));
        const bounds = L.latLngBounds(
          [center[0] - latOffset, center[1] - lngOffset],
          [center[0] + latOffset, center[1] + lngOffset]
        );
        map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5, maxZoom: 16 });
      } else {
        map.flyTo(center, 13, { duration: 1.5 });
      }
    }
  }, [center, radius, map]);
  return null;
}

// Default center: Dhaka, Bangladesh
const DEFAULT_CENTER = [23.8103, 90.4125];

// Strict bounds for Bangladesh (GIS accurate)
const BD_BOUNDS = L.latLngBounds(
  L.latLng(20.3, 88.0), // South-West (includes St. Martins)
  L.latLng(26.7, 92.7)  // North-East
);

// Validate coordinates helper
const isValidCoords = (arr) => {
  if (!arr || !Array.isArray(arr) || arr.length < 2) return false;
  const [lat, lng] = arr;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  return true;
};

export default function MapView({ center, listings = [], userLocation, radius = 5, onClickMap, height = "100%", interactive = true }) {
  const [mapId] = React.useState(() => `map-${Math.random().toString(36).slice(2)}`);

  const validCenter = React.useMemo(() => {
    return isValidCoords(center) ? center : DEFAULT_CENTER;
  }, [center]);

  const validUserLocation = React.useMemo(() => {
    return isValidCoords(userLocation) ? userLocation : null;
  }, [userLocation]);

  // Handle map ready - set initial view
  const handleMapReady = React.useCallback((mapInstance) => {
    try {
      if (mapInstance && mapInstance.fitBounds) {
        // If center is default Dhaka, fit to country bounds for a better experience
        if (validCenter[0] === DEFAULT_CENTER[0] && validCenter[1] === DEFAULT_CENTER[1]) {
           mapInstance.fitBounds(BD_BOUNDS, { padding: [20, 20], animate: false });
        } else {
           mapInstance.setView(validCenter, 13, { animate: false });
        }
      }
    } catch (e) {
      console.error("Map initialization failed:", e);
    }
  }, [validCenter]);

  // Filter valid listings
  const validListings = (listings || []).filter(l => l && isValidCoords([l.lat, l.lng]));
  const { theme } = useThemeStore();
  const { lang } = useLangStore();
  const { t } = useTranslation();

  return (
    <div className={`relative w-full h-full overflow-hidden ${theme === 'dark' ? 'map-dark' : ''}`} style={{ height }}>
      <MapContainer
        id={mapId}
        center={validCenter}
        zoom={13}
        minZoom={6}
        maxBounds={BD_BOUNDS}
        maxBoundsViscosity={1.0}
        whenReady={handleMapReady}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
        zoomControl={false} // Custom positioning
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        tap={interactive}
      >
        <TileLayer
          key={theme}
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          noWrap={true}
        />
        <BangladeshMask />
        {onClickMap && <MapClicker onClick={onClickMap} />}
        <MapUpdater center={validCenter} radius={radius} />
        
        {/* Search Radius Visualization - only show when user has selected a location */}
        {validCenter && radius > 0 &&
         !(validCenter[0] === DEFAULT_CENTER[0] && validCenter[1] === DEFAULT_CENTER[1]) && (
           <Circle
              center={validCenter}
              radius={radius * 1000}
              pathOptions={{ color: "var(--color-primary)", weight: 1.5, dashArray: "8 6", fillColor: "var(--color-primary)", fillOpacity: 0.04 }}
              attribution=""
           />
        )}

        {validUserLocation && (
          <>
            <Marker position={validUserLocation} icon={userIcon} />
          </>
        )}

        {interactive && <ZoomControl position="bottomright" />}

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={40}
          spiderfyOnMaxZoom={true}
          iconCreateFunction={(cluster) => {
            const count = cluster.getChildCount();
            const displayCount = count < 10 ? `0${count}` : count;
            return L.divIcon({
              html: `<div class="lk-cluster">${displayCount}</div>`,
              className: "",
              iconSize: [40, 40],
            });
          }}
        >
          {validListings.map((l) => (
            <Marker
              key={l.id}
              position={[l.lat, l.lng]}
              icon={makeIcon(l)}
            >
              <Popup minWidth={220} maxWidth={280}>
                <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                  <CategoryBadge category={l.category} />
                  <h4 className="font-bold text-[15px] mt-2 leading-snug">{l.title}</h4>
                  <div className="text-[12px] mt-1 font-medium italic truncate" style={{ color: 'var(--text-secondary)' }}>
                    {l.area}, {l.thana || l.city}
                  </div>
                  <div className="mt-3 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-light)' }}>
                    <StarRating rating={l.average_rating} count={l.total_reviews} size={12} />
                    <Link
                      to={`/listing/${l.id}`}
                      className="text-[11px] font-bold text-primary uppercase tracking-wider hover:underline"
                    >
                      {t('viewDetails')} →
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}