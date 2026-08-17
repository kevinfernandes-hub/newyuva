import React from 'react';
import styles from './ImageComparisonViewer.module.css';

export function ResolutionTierToggle({ selectedTier, onTierChange, hasHighResTier }) {
  return (
    <div className={styles.tierSegmentedControl} role="group" aria-label="Resolution Tier Toggle">
      <button
        type="button"
        className={`${styles.tierSegmentBtn} ${selectedTier === '10m' ? styles.tierActive : ''}`}
        onClick={() => onTierChange('10m')}
        title="10m spatial resolution from Copernicus Sentinel-2 (Multispectral L2A)"
      >
        <span className={styles.tierBadge}>10m</span>
        <span>Sentinel-2</span>
      </button>

      <button
        type="button"
        className={`${styles.tierSegmentBtn} ${selectedTier === '0.6m' ? styles.tierActive : ''} ${
          !hasHighResTier ? styles.tierDisabled : ''
        }`}
        onClick={() => hasHighResTier && onTierChange('0.6m')}
        disabled={!hasHighResTier}
        title={
          hasHighResTier
            ? '0.6m sub-meter optical resolution from Esri Wayback Archive (Maxar Imagery)'
            : 'High-resolution pass not yet processed for this location'
        }
      >
        <span className={`${styles.tierBadge} ${hasHighResTier ? styles.badgeHighRes : ''}`}>0.6m</span>
        <span>Wayback (Maxar)</span>
        {!hasHighResTier && <span className={styles.lockIcon}>🔒</span>}
      </button>
    </div>
  );
}

export default ResolutionTierToggle;
