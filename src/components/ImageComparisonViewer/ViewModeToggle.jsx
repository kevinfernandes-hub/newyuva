import React from 'react';
import styles from './ImageComparisonViewer.module.css';

export function ViewModeToggle({
  viewMode,
  currentMode,
  onModeChange,
  selectedTier = '10m',
  isHighRes = false,
  tierNote = ''
}) {
  const activeMode = viewMode || currentMode || 'raw';
  const highResActive = isHighRes || selectedTier === '0.6m';

  const defaultNote =
    'SSIM is disabled at 0.6m tier (SSIM decorrelates under sub-meter natural texture noise). Switch to 10m Sentinel-2 to view SSIM structural dissimilarity matrix.';

  return (
    <div className={styles.segmentedControl} role="group" aria-label="View Mode Toggle">
      <button
        type="button"
        className={`${styles.segmentBtn} ${activeMode === 'raw' ? styles.active : ''}`}
        onClick={() => onModeChange && onModeChange('raw')}
        title="View side-by-side / split slider of raw baseline and comparison imagery"
      >
        Raw Split
      </button>

      <button
        type="button"
        className={`${styles.segmentBtn} ${activeMode === 'color' ? styles.active : ''}`}
        onClick={() => onModeChange && onModeChange('color')}
        title="Spectral color-diff change overlay highlighting verified optical transitions"
      >
        Color-Diff Overlay
      </button>

      <button
        type="button"
        className={`${styles.segmentBtn} ${activeMode === 'ssim' ? styles.active : ''} ${
          highResActive ? styles.segmentBtnDisabled : ''
        }`}
        onClick={() => {
          if (!highResActive && onModeChange) {
            onModeChange('ssim');
          }
        }}
        disabled={highResActive}
        title={
          highResActive
            ? tierNote || defaultNote
            : 'Structural Similarity Index (SSIM) matrix detecting structural alterations'
        }
      >
        <span>SSIM Overlay</span>
        {highResActive && <span className={styles.infoBadge} title={tierNote || defaultNote}>ⓘ N/A</span>}
      </button>
    </div>
  );
}

export default ViewModeToggle;
