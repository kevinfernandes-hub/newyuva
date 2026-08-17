import React from 'react';
import styles from './ImageComparisonViewer.module.css';

export function ViewModeToggle({ currentMode, onModeChange, selectedTier = '10m', tierNote = '' }) {
  const isHighRes = selectedTier === '0.6m';

  const defaultNote =
    'SSIM not used at this tier — decorrelates under sub-meter texture noise; radiometric differencing with scale-matched morphological filtering (7x7 kernel, ~4.2m) is the validated operator at this resolution.';

  return (
    <div className={styles.segmentedControl} role="group" aria-label="View Mode Toggle">
      <button
        type="button"
        className={`${styles.segmentBtn} ${currentMode === 'raw' ? styles.active : ''}`}
        onClick={() => onModeChange('raw')}
        title="View side-by-side / split slider of raw baseline and comparison imagery"
      >
        Raw Split
      </button>

      <button
        type="button"
        className={`${styles.segmentBtn} ${currentMode === 'color' ? styles.active : ''}`}
        onClick={() => onModeChange('color')}
        title="Spectral color-diff change overlay highlighting verified optical transitions"
      >
        Color-Diff Overlay
      </button>

      <button
        type="button"
        className={`${styles.segmentBtn} ${currentMode === 'ssim' ? styles.active : ''} ${
          isHighRes ? styles.segmentBtnDisabled : ''
        }`}
        onClick={() => !isHighRes && onModeChange('ssim')}
        disabled={isHighRes}
        title={
          isHighRes
            ? tierNote || defaultNote
            : 'Structural Similarity Index (SSIM) matrix detecting deep structural alterations'
        }
      >
        <span>SSIM Overlay</span>
        {isHighRes && <span className={styles.infoBadge} title={tierNote || defaultNote}>ⓘ N/A</span>}
      </button>
    </div>
  );
}

export default ViewModeToggle;
