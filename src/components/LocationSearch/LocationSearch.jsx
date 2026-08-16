import React, { useState, useRef, useEffect } from 'react';
import styles from './LocationSearch.module.css';

export function LocationSearch({
  locations,
  searchQuery,
  onSearchChange,
  onSelectLocation,
  onRequestLiveAnalysis,
  isScanning,
  errorMessage,
  onClearError
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newAreaInput, setNewAreaInput] = useState('');
  const [activeTab, setActiveTab] = useState('filter'); // 'filter' | 'live'
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLocations = locations.filter((loc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      loc.name.toLowerCase().includes(q) ||
      loc.subtitle.toLowerCase().includes(q) ||
      loc.id.toLowerCase().includes(q)
    );
  });

  const handleLiveSubmit = (e) => {
    e.preventDefault();
    if (!newAreaInput.trim() || isScanning) return;
    onRequestLiveAnalysis(newAreaInput.trim());
    setNewAreaInput('');
    setIsOpen(false);
  };

  return (
    <div className={styles.searchContainer} ref={containerRef}>
      {/* Tab Switcher: Filter vs Live Analysis */}
      <div className={styles.searchTabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'filter'}
          className={`${styles.tabBtn} ${activeTab === 'filter' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('filter');
            if (onClearError) onClearError();
          }}
        >
          Filter Sectors
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'live'}
          className={`${styles.tabBtn} ${activeTab === 'live' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('live');
            if (onClearError) onClearError();
          }}
        >
          <span className={styles.liveTag}>LIVE</span> Request Analysis
        </button>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <div className={styles.errorHeader}>
            <span className={styles.errorTitle}>Analysis Notice</span>
            <button type="button" className={styles.errorClose} onClick={onClearError}>
              &times;
            </button>
          </div>
          <span className={styles.errorText}>{errorMessage}</span>
        </div>
      )}

      {activeTab === 'filter' ? (
        <div className={styles.inputWrapper}>
          <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search sectors, wards, landmarks..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setIsOpen(true);
              if (onClearError) onClearError();
            }}
            onFocus={() => setIsOpen(true)}
            aria-label="Search analyzed locations"
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                onSearchChange('');
                setIsOpen(false);
              }}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {isOpen && searchQuery && (
            <div className={styles.dropdown}>
              {filteredLocations.length > 0 ? (
                filteredLocations.map((loc) => (
                  <div
                    key={loc.id}
                    className={styles.dropdownItem}
                    onClick={() => {
                      onSelectLocation(loc.id);
                      setIsOpen(false);
                    }}
                  >
                    <div className={styles.dropdownItemHeader}>
                      <span className={styles.dropdownName}>{loc.name}</span>
                      <span className={`${styles.statusDot} ${styles[loc.status]}`} />
                    </div>
                    <span className={styles.dropdownSubtitle}>{loc.subtitle}</span>
                  </div>
                ))
              ) : (
                <div className={styles.noMatchCard}>
                  <span>No preset sector matching &ldquo;{searchQuery}&rdquo;</span>
                  <button
                    type="button"
                    className={styles.triggerLiveBtn}
                    onClick={() => {
                      onRequestLiveAnalysis(searchQuery);
                      onSearchChange('');
                      setIsOpen(false);
                    }}
                  >
                    Run Live Sentinel-2 Analysis for &ldquo;{searchQuery}&rdquo; &rarr;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Live Analysis Input */
        <form onSubmit={handleLiveSubmit} className={styles.requestForm}>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="e.g. Wardha Road, Dharampeth, Manewada..."
              value={newAreaInput}
              onChange={(e) => {
                setNewAreaInput(e.target.value);
                if (onClearError) onClearError();
              }}
              disabled={isScanning}
              aria-label="Request live Sentinel-2 analysis"
            />
            <button
              type="submit"
              className={styles.analyzeBtn}
              disabled={!newAreaInput.trim() || isScanning}
            >
              {isScanning ? 'Processing...' : 'Analyze'}
            </button>
          </div>
          <span className={styles.liveCaveat}>
            Live CDSE Sentinel-2 Pipeline: Geocodes &rarr; Checks Catalog (&lt;15% CC) &rarr; Fetches 10m L2A &rarr; Computes SSIM.
          </span>
        </form>
      )}
    </div>
  );
}
