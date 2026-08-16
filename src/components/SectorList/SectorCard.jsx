import React from 'react';
import styles from './SectorList.module.css';

export function SectorCard({ location, isSelected, onSelect }) {
  return (
    <li
      className={`${styles.card} ${isSelected ? styles.active : ''} ${location.isPreview ? styles.previewCard : ''} ${location.isLiveAnalyzed ? styles.liveCard : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="option"
      aria-selected={isSelected}
    >
      <div className={styles.cardHeader}>
        <div className={styles.nameGroup}>
          <span className={styles.locationName}>{location.name}</span>
          {location.isLiveAnalyzed && <span className={styles.liveBadge}>LIVE ANALYZED</span>}
          {location.isPreview && <span className={styles.previewBadge}>PREVIEW</span>}
        </div>
        <span className={styles.statusIndicator}>
          <span className={`${styles.statusDot} ${styles[location.status]}`} />
          {location.statusLabel}
        </span>
      </div>

      <div className={styles.subtitle}>{location.subtitle}</div>

      <div className={`${styles.metricsGrid} tabular-nums`}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>Color Delta</span>
          <span className={styles.metricValue}>{location.colorDiff.toFixed(2)}%</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>SSIM Area</span>
          <span
            className={styles.metricValue}
            style={{ color: location.ssimArea > 15 ? 'var(--accent-primary)' : 'var(--text-primary)' }}
          >
            {location.ssimArea.toFixed(2)}%
          </span>
        </div>
      </div>

      {location.isLiveAnalyzed && (
        <div className={styles.liveMeta}>
          Analyzed live ({location.beforeDate || '2022'} &rarr; {location.afterDate || '2025'})
        </div>
      )}

      {location.isPreview && (
        <div className={styles.previewNote}>
          Estimate mode — full pipeline takes ~15–20 min in production.
        </div>
      )}
    </li>
  );
}
