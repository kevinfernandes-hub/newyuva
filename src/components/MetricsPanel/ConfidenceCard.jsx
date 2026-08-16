import React from 'react';
import styles from './MetricsPanel.module.css';

export function ConfidenceCard({ colorDiff, ssimArea }) {
  const divergence = Math.abs(colorDiff - ssimArea);
  const isHighConfidence = divergence <= 3.0;

  return (
    <div className={styles.confidenceCard}>
      <div className={styles.confidenceHeader}>
        <span>Model Convergence</span>
        <span
          className={styles.confidenceBadge}
          style={{ color: isHighConfidence ? 'var(--status-stable)' : 'var(--accent-primary)' }}
        >
          {isHighConfidence ? 'High Confidence' : 'Needs Review'}
        </span>
      </div>
      <div className={styles.confidenceDesc}>
        {isHighConfidence
          ? `Optical differencing (${colorDiff.toFixed(2)}%) and structural SSIM (${ssimArea.toFixed(2)}%) agree closely within ±${divergence.toFixed(2)}%, indicating verified physical construction.`
          : `Structural SSIM change (${ssimArea.toFixed(2)}%) diverges from optical pixel delta (${colorDiff.toFixed(2)}%) by ±${divergence.toFixed(2)}%. Indicates deep ground alteration or geometry change requiring field verification.`}
      </div>
    </div>
  );
}
