import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import styles from './LocationMap.module.css';

/**
 * Controller to smoothly center map when selected location changes
 */
function MapCenterController({ selectedLocation }) {
  const map = useMap();

  useEffect(() => {
    if (selectedLocation?.coordinates) {
      map.setView(selectedLocation.coordinates, Math.max(map.getZoom(), 12), {
        animate: true,
        duration: 0.8
      });
    }
  }, [selectedLocation, map]);

  return null;
}

/**
 * Generates custom minimalist SVG pin icon based on status
 */
function createCustomPin(status, isSelected, isPreview) {
  let fillColor = '#C96F3E'; // flagged / default
  if (status === 'stable') fillColor = '#3D8B7A';
  if (status === 'elevated') fillColor = '#C98638';

  const pulseRing = isSelected
    ? `<div style="position: absolute; top: -4px; left: -4px; width: 26px; height: 26px; border-radius: 50%; border: 2px solid ${fillColor}; opacity: 0.6; animation: pinPulse 2s infinite ease-out;"></div>`
    : '';

  const dashedClass = isPreview ? 'border-style: dashed;' : '';

  const html = `
    <div style="position: relative; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;">
      ${pulseRing}
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: ${fillColor};
        border: 2px solid #FFFFFF;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        cursor: pointer;
        transition: transform 0.15s ease;
        ${dashedClass}
        transform: ${isSelected ? 'scale(1.3)' : 'scale(1)'};
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-map-pin',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });
}

export function LocationMap({ locations, selectedLocation, onSelectLocation }) {
  // Center of Nagpur
  const defaultCenter = [21.1458, 79.0882];
  const defaultZoom = 11;

  return (
    <div className={styles.mapWrapper} aria-label="Nagpur Sector Geospatial Map">
      <MapContainer
        center={selectedLocation?.coordinates || defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className={styles.mapCanvas}
        zoomControl={true}
        attributionControl={false}
      >
        {/* CartoDB Positron Muted Neutral Map Tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        <MapCenterController selectedLocation={selectedLocation} />

        {locations.map((loc) => {
          if (!loc.coordinates) return null;
          const isSelected = loc.id === selectedLocation?.id;
          const icon = createCustomPin(loc.status, isSelected, loc.isPreview);

          return (
            <Marker
              key={loc.id}
              position={loc.coordinates}
              icon={icon}
              eventHandlers={{
                click: () => onSelectLocation(loc.id)
              }}
            >
              <Popup className={styles.mapPopup}>
                <div className={styles.popupContent}>
                  <div className={styles.popupHeader}>
                    <strong>{loc.name}</strong>
                    {loc.isPreview && <span className={styles.previewTag}>Preview</span>}
                  </div>
                  <span className={styles.popupSub}>{loc.subtitle}</span>
                  <div className={styles.popupStats}>
                    <span>Color Diff: <strong>{loc.colorDiff.toFixed(2)}%</strong></span>
                    <span>SSIM Area: <strong>{loc.ssimArea.toFixed(2)}%</strong></span>
                  </div>
                  <button
                    type="button"
                    className={styles.popupSelectBtn}
                    onClick={() => onSelectLocation(loc.id)}
                  >
                    Select Sector
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className={styles.mapLegend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.stable}`} /> Stable
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.elevated}`} /> Elevated
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.flagged}`} /> Flagged
        </div>
      </div>
    </div>
  );
}
