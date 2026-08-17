import React, { useState, useEffect, useRef } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import styles from './ImageComparisonViewer.module.css';

/**
 * Normalizes image URLs to relative paths to prevent cross-origin issues
 */
const normalizeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('localhost:8000/static/')) {
    return url.replace('http://localhost:8000', '');
  }
  if (url.includes('127.0.0.1:8000/static/')) {
    return url.replace('http://127.0.0.1:8000', '');
  }
  return url;
};

export function ImageComparisonViewer({
  location,
  threshold = 20.0,
  selectedTier = '10m',
  onTierChange,
  hotspots = [],
  selectedHotspotId,
  onSelectHotspot,
  onInspectHotspot
}) {
  const [viewMode, setViewMode] = useState('raw'); // 'raw' | 'color' | 'ssim' | 'veg'
  const [cursorCoords, setCursorCoords] = useState('21.0542° N, 79.0518° E');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showHotspotBoxes, setShowHotspotBoxes] = useState(true);

  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasBeforeRef = useRef(null);
  const canvasAfterRef = useRef(null);

  const {
    value: sliderPos,
    setValue: setSliderPos,
    isDragging: isSliderDragging,
    containerRef,
    handlePointerDown: handleSliderPointerDown,
    handleTouchStart: handleSliderTouchStart
  } = useDraggable({ initialValue: 50, min: 2, max: 98 });

  const isHighRes = selectedTier === '0.6m';
  const tier06 = location?.tiers?.['0.6m'];
  const tier10 = location?.tiers?.['10m'];

  // Reset zoom and pan on location change
  useEffect(() => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, [location?.id, selectedTier]);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.5, 4.0));
  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.5, 1.0);
      if (next === 1.0) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (e.target.closest(`.${styles.sliderDivider}`) || e.target.closest(`.${styles.floatingControls}`)) {
      return;
    }
    if (zoomLevel <= 1.0) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panOffset.x,
      panY: panOffset.y
    };
  };

  const handleMouseMove = (e) => {
    if (isSliderDragging) return;

    if (isPanning && zoomLevel > 1.0) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      const maxPan = (zoomLevel - 1) * 350;
      setPanOffset({
        x: Math.max(-maxPan, Math.min(maxPan, panStartRef.current.panX + dx)),
        y: Math.max(-maxPan, Math.min(maxPan, panStartRef.current.panY + dy))
      });
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pctX = Math.max(0, Math.min(1, x / rect.width));
    const pctY = Math.max(0, Math.min(1, y / rect.height));

    const [lat, lng] = location?.coordinates || [21.0542, 79.0518];
    const latSpan = 0.048;
    const lngSpan = 0.048;
    const curLat = lat + latSpan / 2 - pctY * latSpan;
    const curLng = lng - lngSpan / 2 + pctX * lngSpan;

    setCursorCoords(`${curLat.toFixed(4)}° N, ${curLng.toFixed(4)}° E`);
  };

  const handleMouseUp = () => setIsPanning(false);

  // Canvas drawing loop
  useEffect(() => {
    const canvasBefore = canvasBeforeRef.current;
    const canvasAfter = canvasAfterRef.current;
    if (!canvasBefore || !canvasAfter) return;

    const ctxBefore = canvasBefore.getContext('2d');
    const ctxAfter = canvasAfter.getContext('2d');
    if (!ctxBefore || !ctxAfter) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const width = containerRef.current ? containerRef.current.clientWidth : 800;
    const height = containerRef.current ? containerRef.current.clientHeight : 540;

    canvasBefore.width = width * dpr;
    canvasBefore.height = height * dpr;
    canvasBefore.style.width = `${width}px`;
    canvasBefore.style.height = `${height}px`;

    canvasAfter.width = width * dpr;
    canvasAfter.height = height * dpr;
    canvasAfter.style.width = `${width}px`;
    canvasAfter.style.height = `${height}px`;

    let beforeSrc, afterSrc;

    const b06 = tier06?.beforeImage || tier06?.before_image;
    const a06 = tier06?.afterImage || tier06?.after_image;
    const c06 = tier06?.colorDiffOverlay || tier06?.color_diff_overlay || tier06?.colorOverlay;
    const s06 = tier06?.ssimOverlay || tier06?.ssim_overlay;
    const v06 = tier06?.vegOverlay || tier06?.veg_overlay;

    const b10 =
      tier10?.beforeImage ||
      tier10?.before_image ||
      location?.localImages?.before ||
      location?.local_images?.before ||
      location?.before_image_url ||
      b06;

    const a10 =
      tier10?.afterImage ||
      tier10?.after_image ||
      location?.localImages?.after ||
      location?.local_images?.after ||
      location?.after_image_url ||
      a06;

    const c10 =
      tier10?.colorDiffOverlay ||
      tier10?.color_diff_overlay ||
      location?.localImages?.colorOverlay ||
      location?.local_images?.color_diff_overlay ||
      location?.color_diff_overlay_url ||
      c06 ||
      a10;

    const s10 =
      tier10?.ssimOverlay ||
      tier10?.ssim_overlay ||
      location?.localImages?.ssimOverlay ||
      location?.local_images?.ssim_overlay ||
      location?.ssim_overlay_url ||
      s06 ||
      a10;

    if (isHighRes && b06 && a06) {
      beforeSrc = b06;
      if (viewMode === 'color') {
        afterSrc = c06 || c10 || a06;
      } else if (viewMode === 'ssim') {
        afterSrc = s06 || s10 || a06;
      } else if (viewMode === 'veg') {
        afterSrc = v06 || c06 || c10 || a06;
      } else {
        afterSrc = a06;
      }
    } else {
      beforeSrc = b10;
      if (viewMode === 'color') {
        afterSrc = c10;
      } else if (viewMode === 'ssim') {
        afterSrc = s10;
      } else if (viewMode === 'veg') {
        afterSrc = c10;
      } else {
        afterSrc = a10;
      }
    }

    ctxBefore.fillStyle = '#0F172A';
    ctxBefore.fillRect(0, 0, width * dpr, height * dpr);
    ctxAfter.fillStyle = '#0F172A';
    ctxAfter.fillRect(0, 0, width * dpr, height * dpr);

    const applyTransform = (ctx) => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(width / 2 + panOffset.x, height / 2 + panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);
      ctx.translate(-width / 2, -height / 2);
    };

    const drawBoxes = (ctx) => {
      if (!showHotspotBoxes || !hotspots || hotspots.length === 0) return;
      const [lat, lng] = location?.coordinates || [21.0542, 79.0518];
      const padding = 0.024;
      const [west, south, east, north] = (location?.id === 'mihan')
        ? [79.020, 21.030, 79.074, 21.090]
        : [lng - padding, lat - padding, lng + padding, lat + padding];

      hotspots.forEach((h) => {
        const isSelected = selectedHotspotId === h.hotspot_id;
        const [h_min_lon, h_min_lat, h_max_lon, h_max_lat] = h.bbox_wgs84 || [
          h.longitude - 0.005,
          h.latitude - 0.005,
          h.longitude + 0.005,
          h.latitude + 0.005
        ];

        const x1 = ((h_min_lon - west) / (east - west + 1e-7)) * width;
        const x2 = ((h_max_lon - west) / (east - west + 1e-7)) * width;
        const y1 = ((north - h_max_lat) / (north - south + 1e-7)) * height;
        const y2 = ((north - h_min_lat) / (north - south + 1e-7)) * height;

        const bx = Math.min(x1, x2);
        const by = Math.min(y1, y2);
        const bw = Math.max(20, Math.abs(x2 - x1));
        const bh = Math.max(20, Math.abs(y2 - y1));

        ctx.strokeStyle = isSelected ? '#EF4444' : '#EA580C';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        ctx.fillStyle = isSelected ? '#EF4444' : '#EA580C';
        ctx.fillRect(bx, Math.max(0, by - 16), 72, 16);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9.5px monospace';
        ctx.fillText(h.hotspot_id || 'HOTSPOT', bx + 4, Math.max(12, by - 4));
      });
    };

    let isSubscribed = true;

    const renderImages = async () => {
      try {
        const imgBefore = new Image();
        imgBefore.crossOrigin = 'anonymous';
        imgBefore.src = normalizeImageUrl(beforeSrc);

        const imgAfter = new Image();
        imgAfter.crossOrigin = 'anonymous';
        imgAfter.src = normalizeImageUrl(afterSrc);

        await Promise.all([
          new Promise((resolve) => { imgBefore.onload = resolve; imgBefore.onerror = resolve; }),
          new Promise((resolve) => { imgAfter.onload = resolve; imgAfter.onerror = resolve; })
        ]);

        if (!isSubscribed) return;

        applyTransform(ctxBefore);
        if (imgBefore.width > 0) {
          ctxBefore.drawImage(imgBefore, 0, 0, width, height);
        }
        ctxBefore.restore();

        applyTransform(ctxAfter);
        if (imgAfter.width > 0) {
          ctxAfter.drawImage(imgAfter, 0, 0, width, height);
        }
        drawBoxes(ctxAfter);
        ctxAfter.restore();
      } catch (err) {
        console.warn('Canvas render fallback:', err);
      }
    };

    renderImages();

    return () => {
      isSubscribed = false;
    };
  }, [
    location?.id,
    selectedTier,
    viewMode,
    zoomLevel,
    panOffset,
    showHotspotBoxes,
    hotspots,
    selectedHotspotId
  ]);

  const beforeDateLabel = isHighRes
    ? (location?.tiers?.['0.6m']?.beforeDate || '2019-01-31')
    : (location?.beforeDate || '2022-02-22');

  const afterDateLabel = isHighRes
    ? (location?.tiers?.['0.6m']?.afterDate || '2025-01-30')
    : (location?.afterDate || '2025-02-26');

  return (
    <section className={styles.viewerStage}>
      {/* 1. Top Stage Control Bar */}
      <div className={styles.stageTopBar}>
        <div className={styles.locationTitleGroup}>
          <h2 className={styles.locationHeading}>{location?.name || 'MIHAN / Outer Ring Road'}</h2>
          <span className={styles.locationSub}>{location?.subtitle || 'Nagpur Municipal Ward'}</span>
        </div>

        {/* Center: Resolution Selector */}
        <div className={styles.resolutionToggleGroup}>
          <button
            type="button"
            className={`${styles.resTab} ${selectedTier === '10m' ? styles.resTabActive : ''}`}
            onClick={() => onTierChange && onTierChange('10m')}
          >
            🛰️ Sentinel-2 (10m)
          </button>
          <button
            type="button"
            className={`${styles.resTab} ${selectedTier === '0.6m' ? styles.resTabActive : ''}`}
            onClick={() => onTierChange && onTierChange('0.6m')}
          >
            🔍 High-Res Aerial (~0.6m)
          </button>
        </div>

        {/* Right: Visual Analysis Overlays */}
        <div className={styles.modeToggleGroup}>
          <button
            type="button"
            className={`${styles.modeTab} ${viewMode === 'raw' ? styles.modeTabActive : ''}`}
            onClick={() => setViewMode('raw')}
          >
            ↔️ Split Slider
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${viewMode === 'color' ? styles.modeTabActive : ''}`}
            onClick={() => setViewMode('color')}
          >
            🔴 Optical Change
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${viewMode === 'ssim' ? styles.modeTabActive : ''}`}
            onClick={() => setViewMode('ssim')}
          >
            🔲 SSIM Matrix
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${viewMode === 'veg' ? styles.modeTabActive : ''}`}
            onClick={() => setViewMode('veg')}
          >
            🌿 Vegetation
          </button>
        </div>
      </div>

      {/* 2. Interactive Comparison Canvas Container */}
      <div
        className={styles.canvasContainer}
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Layer 1: Before Canvas (Full Width) */}
        <canvas ref={canvasBeforeRef} className={styles.satelliteCanvas} />

        {/* Layer 2: After Canvas (Clipped by Slider) */}
        <div
          className={styles.afterClippedContainer}
          style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
        >
          <canvas ref={canvasAfterRef} className={styles.satelliteCanvas} />
        </div>

        {/* Draggable Divider Handle */}
        <div
          className={styles.sliderDivider}
          style={{ left: `${sliderPos}%` }}
          onPointerDown={handleSliderPointerDown}
          onTouchStart={handleSliderTouchStart}
        >
          <div className={styles.sliderGrip}>
            <span>↔</span>
          </div>
        </div>

        {/* Human-Readable Date Labels */}
        <div className={styles.labelBefore}>
          <span className={styles.dateTag}>📅 BASELINE: {beforeDateLabel}</span>
          <span className={styles.sensorTag}>{isHighRes ? 'Maxar Orthophoto (0.6m)' : 'Sentinel-2 L2A'}</span>
        </div>

        <div className={styles.labelAfter}>
          <span className={styles.dateTag}>📅 CURRENT: {afterDateLabel}</span>
          <span className={styles.sensorTag}>
            {viewMode === 'color'
              ? 'Calibrated Optical Footprint'
              : viewMode === 'ssim'
                ? '0.6m SSIM Structural Disruption'
                : viewMode === 'veg'
                  ? 'ExG Vegetation Dynamics'
                  : isHighRes ? 'Maxar Orthophoto (0.6m)' : 'Sentinel-2 L2A'}
          </span>
        </div>

        {/* Floating Zoom & Action Controls */}
        <div className={styles.floatingControls}>
          <div className={styles.zoomPills}>
            <button type="button" className={styles.ctrlBtn} onClick={handleZoomIn} title="Zoom In">+</button>
            <span className={styles.zoomVal}>{zoomLevel.toFixed(1)}x</span>
            <button type="button" className={styles.ctrlBtn} onClick={handleZoomOut} title="Zoom Out">-</button>
            <button type="button" className={styles.ctrlBtn} onClick={handleResetZoom} title="Reset">Reset</button>
          </div>

          <button
            type="button"
            className={`${styles.boxToggleBtn} ${showHotspotBoxes ? styles.boxToggleActive : ''}`}
            onClick={() => setShowHotspotBoxes(!showHotspotBoxes)}
          >
            {showHotspotBoxes ? 'Hide Parcels' : 'Show Parcels'}
          </button>
        </div>
      </div>

      {/* 3. Micro Status Footer */}
      <div className={styles.stageFooter}>
        <span className={styles.coordText}>📍 Center: {cursorCoords}</span>
        <span className={styles.extentText}>
          Monitored Extent: 5.0 km × 5.0 km ({isHighRes ? '~0.6m Sub-Meter Resolution' : '10m Multi-Spectral'})
        </span>
      </div>
    </section>
  );
}

export default ImageComparisonViewer;
