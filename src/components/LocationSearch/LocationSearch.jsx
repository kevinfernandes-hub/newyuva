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
  const [locationInput, setLocationInput] = useState('');
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
    const q = (locationInput || searchQuery).toLowerCase().trim();
    if (!q) return true;
    return (
      loc.name.toLowerCase().includes(q) ||
      loc.subtitle.toLowerCase().includes(q) ||
      loc.id.toLowerCase().includes(q)
    );
  });

  const handleAgentSubmit = (e) => {
    e.preventDefault();
    const query = locationInput.trim() || searchQuery.trim();
    if (!query || isScanning) return;
    onRequestLiveAnalysis(query);
    setIsOpen(false);
  };

  return (
    <div className={styles.searchContainer} ref={containerRef}>
      {/* Search Bar & Primary Agent Trigger */}
      <form onSubmit={handleAgentSubmit} className={styles.agentSearchForm}>
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
            placeholder="Search any Nagpur location (e.g. Civil Lines, MIHAN, Sadar)..."
            value={locationInput}
            onChange={(e) => {
              setLocationInput(e.target.value);
              onSearchChange(e.target.value);
              setIsOpen(true);
              if (onClearError) onClearError();
            }}
            onFocus={() => setIsOpen(true)}
            disabled={isScanning}
            aria-label="Search arbitrary Nagpur location"
          />
          {locationInput && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setLocationInput('');
                onSearchChange('');
                setIsOpen(false);
              }}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {/* Primary Agent Action Button */}
        <button
          type="submit"
          className={styles.runAgentBtn}
          disabled={!locationInput.trim() || isScanning}
          title="Executes: SEARCH → PLAN → SCAN → REASON → ZOOM → VERIFY → CROSS-CHECK → REPORT"
        >
          {isScanning ? (
            <>
              <span className={styles.spinnerMini} />
              <span>AGENT RUNNING...</span>
            </>
          ) : (
            <>
              <span className={styles.agentSparkle}>⚡</span>
              <span>RUN EARTHWATCH AGENT</span>
            </>
          )}
        </button>
      </form>

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

      {/* Autocomplete / Recent AOI Dropdown */}
      {isOpen && locationInput && (
        <div className={styles.dropdown}>
          {filteredLocations.length > 0 ? (
            <>
              <div className={styles.dropdownHeader}>Verified Analyzed Sectors</div>
              {filteredLocations.map((loc) => (
                <div
                  key={loc.id}
                  className={styles.dropdownItem}
                  onClick={() => {
                    onSelectLocation(loc.id);
                    setLocationInput(loc.name);
                    setIsOpen(false);
                  }}
                >
                  <div className={styles.dropdownItemHeader}>
                    <span className={styles.dropdownName}>{loc.name}</span>
                    <span className={`${styles.statusDot} ${styles[loc.status]}`} />
                  </div>
                  <span className={styles.dropdownSubtitle}>{loc.subtitle}</span>
                </div>
              ))}
            </>
          ) : null}

          {/* Prompt to run full autonomous agent on new unanalyzed location */}
          <div className={styles.dynamicPromptCard}>
            <span className={styles.dynamicPromptText}>
              Autonomous Investigation for <strong>&ldquo;{locationInput}&rdquo;</strong>
            </span>
            <button
              type="button"
              className={styles.triggerDynamicAgentBtn}
              onClick={() => {
                onRequestLiveAnalysis(locationInput);
                setIsOpen(false);
              }}
            >
              Run End-to-End EarthWatch Agent for &ldquo;{locationInput}&rdquo; &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationSearch;
