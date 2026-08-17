import React from 'react';
import styles from './SectorList.module.css';

export function SectorCard({ location, isSelected, onSelect, onClick }) {
  const handleAction = onSelect || onClick;
  const isStable =
    location.isSurfaceStable ||
    location.evidenceVerdict === 'SURFACE_STABLE' ||
    (location.colorDiff < 1.0 && location.ssimArea < 1.0);

  const priorityClass = isStable
    ? styles.priorityStable
    : (location.colorDiff > 12.0 || location.ssimArea > 12.0)
      ? styles.priorityCritical
      : styles.priorityHigh;

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.active : ''} ${location.isLiveAnalyzed ? styles.liveCard : ''}`}
      onClick={handleAction}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (handleAction) handleAction();
        }
      }}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
    >
      <div className={styles.cardHeader}>
        <div className={styles.nameGroup}>
          <span className={styles.locationName}>{location.name}</span>
          {location.isLiveAnalyzed && <span className={styles.liveBadge}>LIVE CDSE</span>}
        </div>
        <span className={`${styles.priorityBadge} ${priorityClass}`}>
          {isStable ? 'STABLE' : (location.colorDiff > 12.0 ? 'CRITICAL' : 'HIGH')}
        </span>
      </div>

      <div className={styles.subtitle}>{location.subtitle}</div>

      <div className={`${styles.metricsGrid} tabular-nums`}>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>10m Optical Δ</span>
          <span className={styles.metricValue}>{(isStable ? 0.0 : location.colorDiff).toFixed(2)}%</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricLabel}>SSIM Divergence</span>
          <span className={styles.metricValue}>{(isStable ? 0.0 : location.ssimArea).toFixed(2)}%</span>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.timelineTag}>
          📅 {location.beforeDate || '2022-02-22'} → {location.afterDate || '2025-02-26'}
        </span>
        <span className={styles.selectArrow}>→</span>
      </div>
    </div>
  );
}

export default SectorCard;
