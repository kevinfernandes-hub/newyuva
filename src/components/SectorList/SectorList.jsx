import React, { useState } from 'react';
import { SectorCard } from './SectorCard';
import { LocationSearch } from '../LocationSearch/LocationSearch';
import { LocationMap } from '../LocationMap/LocationMap';
import styles from './SectorList.module.css';

export function SectorList({
  locations,
  selectedId,
  onSelectLocation,
  searchQuery,
  onSearchChange,
  onRequestLiveAnalysis,
  isScanning,
  scanningStatusText,
  scanningSteps = [],
  errorMessage,
  onClearError,
  hotspots = [],
  selectedHotspotId,
  onSelectHotspot,
  onInspectHotspot
}) {
  const [viewMode, setViewMode] = useState('dual'); // 'list' | 'map' | 'dual'

  // Token-based matching: handles "dharampeth nagpur", commas, extra spaces, etc.
  const filteredLocations = locations.filter((loc) => {
    const rawQ = searchQuery.toLowerCase().trim();
    if (!rawQ) return true;

    const tokens = rawQ.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    const locText = `${loc.name} ${loc.subtitle || ''} ${loc.id || ''}`.toLowerCase().replace(/[^a-z0-9]/g, ' ');

    return tokens.every((token) => locText.includes(token));
  });

  const selectedLocation = locations.find((l) => l.id === selectedId) || locations[0];

  return (
    <aside className={styles.rail} aria-label="Monitored Sectors and Geospatial Map">
      {/* Tier 1 / Live Location Search Header */}
      <LocationSearch
        locations={locations}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onSelectLocation={onSelectLocation}
        onRequestLiveAnalysis={onRequestLiveAnalysis}
        isScanning={isScanning}
        errorMessage={errorMessage}
        onClearError={onClearError}
      />

      {/* View Mode Switcher: Dual / List / Map */}
      <div className={styles.subHeaderRow}>
        <div className={styles.countGroup}>
          <span className={styles.heading}>Sectors</span>
          <span className={`${styles.countBadge} tabular-nums`}>
            {filteredLocations.length} of {locations.length}
          </span>
        </div>

        <div className={styles.viewToggleGroup} role="radiogroup" aria-label="Sector panel layout">
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === 'dual' ? styles.activeViewBtn : ''}`}
            onClick={() => setViewMode('dual')}
            title="Split map and list view"
          >
            Dual
          </button>
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === 'list' ? styles.activeViewBtn : ''}`}
            onClick={() => setViewMode('list')}
            title="Compact sector cards list"
          >
            List
          </button>
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === 'map' ? styles.activeViewBtn : ''}`}
            onClick={() => setViewMode('map')}
            title="Interactive Nagpur district map"
          >
            Map
          </button>
        </div>
      </div>

      {/* Embedded Map Section */}
      {(viewMode === 'map' || viewMode === 'dual') && (
        <div className={viewMode === 'dual' ? styles.mapSectionDual : styles.mapSectionFull}>
          <LocationMap
            locations={locations}
            selectedLocation={selectedLocation}
            onSelectLocation={onSelectLocation}
            hotspots={hotspots}
            selectedHotspotId={selectedHotspotId}
            onSelectHotspot={onSelectHotspot}
            onInspectHotspot={onInspectHotspot}
          />
        </div>
      )}

      {/* Sector Cards Feed */}
      {(viewMode === 'list' || viewMode === 'dual') && (
        <div className={styles.list}>
          {filteredLocations.length > 0 ? (
            filteredLocations.map((loc) => {
              const isSelected = loc.id === selectedId;
              return (
                <SectorCard
                  key={loc.id}
                  location={loc}
                  isSelected={isSelected}
                  onClick={() => onSelectLocation(loc.id)}
                />
              );
            })
          ) : (
            <div className={styles.empty}>
              <p>No pre-analyzed sectors match "{searchQuery}".</p>
              <p className={styles.emptySub}>
                Click <strong>RUN EARTHWATCH AGENT</strong> above to analyze this area dynamically.
              </p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

export default SectorList;
