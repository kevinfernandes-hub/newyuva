import React, { useState } from 'react';
import styles from './Header.module.css';

export function Header({
  selectedLocationId = 'mihan',
  onSelectLocation,
  onRequestLiveAnalysis,
  isScanning = false,
  activeViewMode = 'satellite', // 'satellite' | 'map'
  onViewModeChange,
  locationsList = []
}) {
  const [searchInput, setSearchInput] = useState('');

  const quickWards = [
    { id: 'mihan', label: 'MIHAN / SEZ' },
    { id: 'sadar', label: 'Sadar Ward' },
    { id: 'hingna', label: 'Hingna MIDC' },
    { id: 'civil-lines', label: 'Civil Lines' },
    { id: 'dharampeth', label: 'Dharampeth' },
    { id: 'sitabuldi', label: 'Sitabuldi' },
    { id: 'nandanvan', label: 'Nandanvan' }
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    if (onRequestLiveAnalysis) {
      onRequestLiveAnalysis(searchInput.trim());
    }
  };

  return (
    <header className={styles.navbar}>
      {/* 1. Official Brand Identity */}
      <div className={styles.brandGroup}>
        <div className={styles.logoBadge}>
          <span className={styles.logoIcon}>🏛</span>
          <span className={styles.logoText}>NMC</span>
        </div>
        <div className={styles.brandTitles}>
          <div className={styles.titleRow}>
            <span className={styles.mainTitle}>NAGPUR EARTHWATCH</span>
            <span className={styles.officialBadge}>MUNICIPAL INTELLIGENCE</span>
          </div>
          <span className={styles.subtitle}>
            Autonomous Dual-Tier Satellite Surveillance & Town Planning Enforcement
          </span>
        </div>
      </div>

      {/* 2. Universal Search & Quick Ward Chips */}
      <div className={styles.searchAndWards}>
        <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
          <div className={styles.searchBox}>
            <svg className={styles.searchSvg} viewBox="0 0 20 20" fill="none" stroke="currentColor">
              <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search Nagpur locality, ward, or plot (e.g. Besa, Pardi, Manewada)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className={styles.scanBtn}
              disabled={isScanning || !searchInput.trim()}
            >
              {isScanning ? (
                <>
                  <span className={styles.spinner} />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <span>Scan Ward</span>
                  <span className={styles.shortcutTag}>↵</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className={styles.wardChips}>
          <span className={styles.wardChipsLabel}>QUICK WARDS:</span>
          {quickWards.map((w) => {
            const isActive = selectedLocationId?.toLowerCase().includes(w.id);
            return (
              <button
                key={w.id}
                type="button"
                className={`${styles.wardChip} ${isActive ? styles.wardChipActive : ''}`}
                onClick={() => onSelectLocation && onSelectLocation(w.id)}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Navigation View Toggles & Agent Status */}
      <div className={styles.navRight}>
        <div className={styles.viewModeSwitch}>
          <button
            type="button"
            className={`${styles.viewTab} ${activeViewMode === 'satellite' ? styles.viewTabActive : ''}`}
            onClick={() => onViewModeChange && onViewModeChange('satellite')}
          >
            🛰️ Satellite View
          </button>
          <button
            type="button"
            className={`${styles.viewTab} ${activeViewMode === 'map' ? styles.viewTabActive : ''}`}
            onClick={() => onViewModeChange && onViewModeChange('map')}
          >
            🗺️ District Map
          </button>
        </div>

        <div className={styles.statusPill}>
          <span className={`${styles.statusDot} ${isScanning ? styles.dotScanning : styles.dotActive}`} />
          <span className={styles.statusLabel}>
            {isScanning ? 'SCANNING WARD...' : 'SATELLITE SYNC: LIVE'}
          </span>
        </div>
      </div>
    </header>
  );
}

export default Header;
