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
  errorMessage,
  onClearError
}) {
  const [viewMode, setViewMode] = useState('dual'); // 'list' | 'map' | 'dual'

  const filteredLocations = locations.filter((loc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      loc.name.toLowerCase().includes(q) ||
      loc.subtitle.toLowerCase().includes(q) ||
      loc.id.toLowerCase().includes(q)
    );
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

        <div className={styles.viewModeTabs} role="group" aria-label="Rail View Mode">
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === 'dual' ? styles.viewBtnActive : ''}`}
            onClick={() => setViewMode('dual')}
            title="Split Map & List"
          >
            Dual
          </button>
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
            onClick={() => setViewMode('list')}
            title="List Only"
          >
            List
          </button>
          <button
            type="button"
            className={`${styles.viewBtn} ${viewMode === 'map' ? styles.viewBtnActive : ''}`}
            onClick={() => setViewMode('map')}
            title="Map Only"
          >
            Map
          </button>
        </div>
      </div>

      {/* Progressive Live Scanning Feedback Overlay */}
      {isScanning && (
        <div className={styles.scanningBanner}>
          <div className={styles.spinner} />
          <div className={styles.scanningText}>
            <strong>Running Live Sentinel-2 Analysis</strong>
            <span>{scanningStatusText || 'Connecting to Copernicus CDSE pipeline...'}</span>
          </div>
        </div>
      )}

      {/* Map Section (Shown in Dual or Map mode) */}
      {(viewMode === 'dual' || viewMode === 'map') && (
        <div className={`${styles.mapSection} ${viewMode === 'map' ? styles.mapFull : ''}`}>
          <LocationMap
            locations={filteredLocations}
            selectedLocation={selectedLocation}
            onSelectLocation={onSelectLocation}
          />
        </div>
      )}

      {/* Sector Cards List (Shown in Dual or List mode) */}
      {(viewMode === 'dual' || viewMode === 'list') && (
        <ul className={`${styles.list} ${viewMode === 'dual' ? styles.listCompact : ''}`} role="listbox">
          {filteredLocations.length > 0 ? (
            filteredLocations.map((loc) => (
              <SectorCard
                key={loc.id}
                location={loc}
                isSelected={loc.id === selectedId}
                onSelect={() => onSelectLocation(loc.id)}
              />
            ))
          ) : (
            <li className={styles.emptyState}>
              <span>No preset sector matching &ldquo;{searchQuery}&rdquo;</span>
              <button
                type="button"
                className={styles.resetFilterBtn}
                onClick={() => onSearchChange('')}
              >
                Reset Search Filter
              </button>
            </li>
          )}
        </ul>
      )}
    </aside>
  );
}
