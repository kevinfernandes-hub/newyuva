import React from 'react';
import { ConfidenceCard } from './ConfidenceCard';
import { PermitTable } from './PermitTable';
import styles from './MetricsPanel.module.css';

export function MetricsPanel({ location, currentScaledColorDiff, onOpenInspectionModal }) {
  return (
    <aside className={styles.rail} aria-label="Location Intelligence Readouts">
      {/* 1. Optical Pixel Delta */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Optical Pixel Delta</span>
        <div className={`${styles.heroNumber} tabular-nums`}>
          {currentScaledColorDiff.toFixed(2)}%
        </div>
        <p className={styles.heroSubtext}>
          Surface spectral change detected across the target bounds at current calibrated sensitivity.
        </p>
      </div>

      {/* 2. Structural Similarity */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Structural Similarity</span>
        <div className={`${styles.duoRow} tabular-nums`}>
          <div className={styles.duoItem}>
            <span className={styles.duoLabel}>SSIM Area</span>
            <span className={styles.duoVal}>{location.ssimArea.toFixed(2)}%</span>
          </div>
          <div className={styles.duoItem}>
            <span className={styles.duoLabel}>Similarity Index</span>
            <span className={styles.duoVal}>{location.ssimScore.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* 3. Sensor Convergence */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Sensor Convergence</span>
        <ConfidenceCard colorDiff={currentScaledColorDiff} ssimArea={location.ssimArea} />
      </div>

      {/* 4. Municipal Building Permit Audit */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Municipal Sanctions</span>
        <PermitTable permits={location.permits} />

        <button
          type="button"
          className={styles.inspectionBtn}
          onClick={onOpenInspectionModal}
          aria-haspopup="dialog"
        >
          Export Inspection Dispatch
        </button>
      </div>
    </aside>
  );
}
