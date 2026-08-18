import React from 'react';
import styles from './SectorList.module.css';

export function SectorCard({ location, isSelected, onSelect, onClick, viewMode = 'officer' }) {
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

  const evidenceStrength = isStable ? 'STABLE' : location.colorDiff > 10.0 || location.ssimArea > 10.0 ? 'STRONG' : 'MODERATE';
  const recommendedAction = isStable ? 'ROUTINE MONITORING' : 'FIELD INSPECTION';

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
          {isStable ? 'STABLE' : (location.colorDiff > 12.0 ? 'CRITICAL' : 'HIGH PRIORITY')}
        </span>
      </div>

      <div className={styles.subtitle}>{location.subtitle}</div>

      {viewMode === 'officer' ? (
        /* Municipal Officer View Card */
        <div className={styles.officerCardGrid}>
          <div className={styles.officerMetric}>
            <span className={styles.officerLabel}>Observed Change</span>
            <span className={`${styles.officerValue} ${isStable ? styles.textStable : styles.textAlert}`}>
              {isStable ? 'No Change Detected' : '🏗️ Physical Change Detected'}
            </span>
          </div>
          <div className={styles.officerMetric}>
            <span className={styles.officerLabel}>Evidence Strength</span>
            <span className={`${styles.evidenceTag} ${evidenceStrength === 'STRONG' ? styles.tagStrong : evidenceStrength === 'MODERATE' ? styles.tagModerate : styles.tagStable}`}>
              ● {evidenceStrength}
            </span>
          </div>
          <div className={styles.officerMetricFull}>
            <span className={styles.officerLabel}>Recommended Action</span>
            <span className={styles.actionValue}>🏛️ {recommendedAction}</span>
          </div>
        </div>
      ) : (
        /* Technical Analyst View Card */
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
      )}

      <div className={styles.cardFooter}>
        <span className={styles.timelineTag}>
          📅 Observation: {location.beforeDate || '2022-02-22'} → {location.afterDate || '2025-02-26'}
        </span>
        <span className={styles.selectArrow}>→</span>
      </div>
    </div>
  );
}

export default SectorCard;
