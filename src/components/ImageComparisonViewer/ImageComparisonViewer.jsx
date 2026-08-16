import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ComparisonSlider } from './ComparisonSlider';
import { ViewModeToggle } from './ViewModeToggle';
import { useDraggable } from '../../hooks/useDraggable';
import styles from './ImageComparisonViewer.module.css';

/**
 * Procedural Terrain Simulation generator
 * Used ONLY as fallback when real satellite imagery assets are unavailable
 */
function drawTerrainTexture(ctx, w, h, seed, isAfter, overlayMode, threshold) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#4A4237');
  grad.addColorStop(0.5, '#3D4537');
  grad.addColorStop(1, '#524739');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const step = 32;
  for (let x = 0; x < w; x += step) {
    for (let y = 0; y < h; y += step) {
      const cellHash = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
      const val = cellHash - Math.floor(cellHash);
      if (val > 0.65) ctx.fillStyle = `rgba(58, 77, 52, ${0.4 + val * 0.35})`;
      else if (val > 0.4) ctx.fillStyle = `rgba(92, 80, 64, ${0.3 + val * 0.3})`;
      else ctx.fillStyle = `rgba(120, 108, 88, ${0.2 + val * 0.25})`;
      ctx.fillRect(x, y, step - 1, step - 1);
    }
  }

  ctx.strokeStyle = '#232A26';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.4);
  ctx.bezierCurveTo(w * 0.3, h * 0.45, w * 0.7, h * 0.25, w, h * 0.35);
  ctx.stroke();

  const drawGrid = (startX, startY, rows, cols) => {
    const size = 12;
    const gap = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillRect(startX + c * (size + gap), startY + r * (size + gap), size, size);
      }
    }
  };

  ctx.fillStyle = '#A89F91';
  drawGrid(w * 0.25, h * 0.3, 4, 3);
  drawGrid(w * 0.65, h * 0.6, 5, 4);

  if (isAfter) {
    ctx.fillStyle = '#D6CFC4';
    drawGrid(w * 0.48, h * 0.42, 6, 5);
    drawGrid(w * 0.72, h * 0.25, 4, 3);

    // Sparse localized highlight fallback (~10% area)
    if (overlayMode === 1) {
      const alpha = Math.min(0.85, Math.max(0.3, (35 - threshold) / 25));
      ctx.fillStyle = `rgba(201, 111, 62, ${alpha})`;
      ctx.fillRect(w * 0.48, h * 0.42, 50, 40);
    } else if (overlayMode === 2) {
      ctx.fillStyle = 'rgba(201, 111, 62, 0.75)';
      ctx.fillRect(w * 0.48, h * 0.42, 50, 40);
    }
  }
}

export function ImageComparisonViewer({ location, threshold }) {
  const [viewMode, setViewMode] = useState('raw');
  const [cursorCoords, setCursorCoords] = useState('21.0542° N, 79.0518° E');
  
  const canvasBeforeRef = useRef(null);
  const canvasAfterRef = useRef(null);

  const {
    value: sliderPos,
    setValue: setSliderPos,
    containerRef,
    handlePointerDown,
    handleTouchStart
  } = useDraggable({ initialValue: 50, min: 2, max: 98 });

  // Render canvas layers with real Sentinel-2 PNGs or procedural fallback
  useEffect(() => {
    const width = 600;
    const height = 500;
    const canvasBefore = canvasBeforeRef.current;
    const canvasAfter = canvasAfterRef.current;
    if (!canvasBefore || !canvasAfter) return;

    canvasBefore.width = width;
    canvasBefore.height = height;
    canvasAfter.width = width;
    canvasAfter.height = height;

    const ctxBefore = canvasBefore.getContext('2d');
    const ctxAfter = canvasAfter.getContext('2d');

    // Pick image source based on current view mode
    let afterSrc = location.localImages?.after;
    if (viewMode === 'color') afterSrc = location.localImages?.colorOverlay || location.localImages?.after;
    if (viewMode === 'ssim') afterSrc = location.localImages?.ssimOverlay || location.localImages?.after;

    const beforeSrc = location.localImages?.before;

    // Reset background
    ctxBefore.fillStyle = '#1B1E1C';
    ctxBefore.fillRect(0, 0, width, height);
    ctxAfter.fillStyle = '#1B1E1C';
    ctxAfter.fillRect(0, 0, width, height);

    // 1. Draw Before Layer (Real PNG or fallback)
    if (beforeSrc) {
      const imgBefore = new Image();
      imgBefore.crossOrigin = 'anonymous';
      imgBefore.onload = () => {
        ctxBefore.drawImage(imgBefore, 0, 0, width, height);
      };
      imgBefore.onerror = () => {
        console.warn('Falling back for before image:', beforeSrc);
        const seed = location.id.charCodeAt(0) * 19 + location.id.length * 37;
        drawTerrainTexture(ctxBefore, width, height, seed, false, 0, threshold);
      };
      imgBefore.src = beforeSrc;
    } else {
      const seed = location.id.charCodeAt(0) * 19 + location.id.length * 37;
      drawTerrainTexture(ctxBefore, width, height, seed, false, 0, threshold);
    }

    // 2. Draw After/Overlay Layer (Real PNG or fallback)
    if (afterSrc) {
      const imgAfter = new Image();
      imgAfter.crossOrigin = 'anonymous';
      imgAfter.onload = () => {
        ctxAfter.drawImage(imgAfter, 0, 0, width, height);
      };
      imgAfter.onerror = () => {
        console.warn('Falling back for after/overlay image:', afterSrc);
        const seed = location.id.charCodeAt(0) * 19 + location.id.length * 37;
        const overlayType = viewMode === 'color' ? 1 : viewMode === 'ssim' ? 2 : 0;
        drawTerrainTexture(ctxAfter, width, height, seed, true, overlayType, threshold);
      };
      imgAfter.src = afterSrc;
    } else {
      const seed = location.id.charCodeAt(0) * 19 + location.id.length * 37;
      const overlayType = viewMode === 'color' ? 1 : viewMode === 'ssim' ? 2 : 0;
      drawTerrainTexture(ctxAfter, width, height, seed, true, overlayType, threshold);
    }
  }, [location, viewMode, threshold]);

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = Math.floor(e.clientX - rect.left);
    const py = Math.floor(e.clientY - rect.top);
    const baseLat = location.coordinates ? location.coordinates[0] : 21.05;
    const baseLon = location.coordinates ? location.coordinates[1] : 79.05;
    const lat = (baseLat + (0.5 - py / rect.height) * 0.04).toFixed(4);
    const lon = (baseLon + (px / rect.width - 0.5) * 0.04).toFixed(4);
    setCursorCoords(`${lat}° N, ${lon}° E`);
  }, [containerRef, location]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft') {
      setSliderPos((p) => Math.max(5, p - 3));
    } else if (e.key === 'ArrowRight') {
      setSliderPos((p) => Math.min(95, p + 3));
    }
  }, [setSliderPos]);

  return (
    <section className={styles.viewerSection} aria-label="Satellite Imagery Comparison">
      <div className={styles.headerBar}>
        <div className={styles.metaGroup}>
          <span className={styles.locationTitle}>{location.name}</span>
          {location.isPreview && <span className={styles.previewTag}>PREVIEW ESTIMATE</span>}
          {location.isLiveAnalyzed && <span className={styles.liveTag}>LIVE SENTINEL-2</span>}
          <span className={styles.coordsPill}>{location.coords}</span>
        </div>

        <ViewModeToggle currentMode={viewMode} onModeChange={setViewMode} />
      </div>

      {location.isPreview && (
        <div className={styles.previewNoticeBar}>
          <span className={styles.previewIcon}>ⓘ</span>
          <span>
            <strong>Preview mode:</strong> Simulated estimation. Full Sentinel-2 multispectral pipeline requires 15–20 min processing per AOI in production.
          </span>
        </div>
      )}

      <div
        className={styles.canvasCard}
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handlePointerDown}
      >
        <canvas ref={canvasAfterRef} className={styles.canvasLayer} />

        <div
          className={styles.clippedWrapper}
          style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
        >
          <canvas ref={canvasBeforeRef} className={styles.canvasLayer} />
        </div>

        <ComparisonSlider
          positionPct={sliderPos}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onTouchStart={handleTouchStart}
        />

        <div className={`${styles.cornerBadge} ${styles.left}`}>
          {location.beforeDate ? `Baseline (${location.beforeDate})` : 'Jan 2022 (Baseline)'}
        </div>
        <div className={`${styles.cornerBadge} ${styles.right}`}>
          {viewMode === 'raw'
            ? location.afterDate
              ? `Current (${location.afterDate})`
              : 'Jan 2025'
            : viewMode === 'color'
            ? 'Color-Diff Overlay'
            : 'SSIM Mask'}
        </div>
        <div className={styles.hudCoords}>{cursorCoords}</div>
      </div>
    </section>
  );
}
