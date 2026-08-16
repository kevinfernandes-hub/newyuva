import React from 'react';
import styles from './ImageComparisonViewer.module.css';

export function ViewModeToggle({ currentMode, onModeChange }) {
  return (
    <div className={styles.segmentedControl} role="group" aria-label="View Mode Toggle">
      <button
        type="button"
        className={`${styles.segmentBtn} ${currentMode === 'raw' ? styles.active : ''}`}
        onClick={() => onModeChange('raw')}
      >
        Raw Split
      </button>
      <button
        type="button"
        className={`${styles.segmentBtn} ${currentMode === 'color' ? styles.active : ''}`}
        onClick={() => onModeChange('color')}
      >
        Color-Diff Overlay
      </button>
      <button
        type="button"
        className={`${styles.segmentBtn} ${currentMode === 'ssim' ? styles.active : ''}`}
        onClick={() => onModeChange('ssim')}
      >
        SSIM Overlay
      </button>
    </div>
  );
}
