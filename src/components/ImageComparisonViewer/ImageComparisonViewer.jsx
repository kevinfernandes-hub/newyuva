import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ComparisonSlider } from './ComparisonSlider';
import { ViewModeToggle } from './ViewModeToggle';
import { ResolutionTierToggle } from './ResolutionTierToggle';
import { TimelineSelector } from '../TimelineSelector/TimelineSelector';
import { useDraggable } from '../../hooks/useDraggable';
import styles from './ImageComparisonViewer.module.css';

/**
 * Normalizes image URLs to relative proxy paths to prevent cross-origin issues
 */
const normalizeImageUrl = (url) => {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  if (url.includes('localhost:8000/static/')) {
    return url.replace('http://localhost:8000', '');
  }
  if (url.includes('127.0.0.1:8000/static/')) {
    return url.replace('http://127.0.0.1:8000', '');
  }
  return url;
};

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

export function ImageComparisonViewer({
  location,
  threshold,
  selectedTier = '10m',
  onTierChange,
  onAnalyzeDates,
  isAnalyzing,
  onResetDates,
  onOpenDetailModal,
  hotspots = [],
  selectedHotspotId,
  onSelectHotspot,
  onInspectHotspot
}) {
  const [viewMode, setViewMode] = useState('raw');
  const [cursorCoords, setCursorCoords] = useState('21.0542° N, 79.0518° E');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [activeFocusKey, setActiveFocusKey] = useState('overview');
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

  const hasHighResTier = Boolean(location?.tiers?.['0.6m'] || location?.id === 'mihan');
  const isHighRes = selectedTier === '0.6m';
  const tier06 = location?.tiers?.['0.6m'];
  const tier10 = location?.tiers?.['10m'];

  // Reset zoom when switching locations or tiers
  useEffect(() => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
    setActiveFocusKey('overview');
  }, [location?.id, selectedTier]);

  // If user switches to 0.6m and was on 'ssim', switch to 'color'
  useEffect(() => {
    if (isHighRes && viewMode === 'ssim') {
      setViewMode('color');
    }
  }, [isHighRes, viewMode]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 4.5));
  };

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
    setActiveFocusKey('overview');
  };

  const handleSetFocusPreset = (key, zoom, x, y, hotspotId) => {
    setActiveFocusKey(key);
    setZoomLevel(zoom);
    setPanOffset({ x, y });
    if (hotspotId && onSelectHotspot) {
      onSelectHotspot(hotspotId);
    }
  };

  const handleMouseDown = (e) => {
    // If clicking on slider handle/divider or zoom HUD, do not start canvas pan
    if (
      e.target.closest(`.${styles.sliderDivider}`) ||
      e.target.closest(`.${styles.sliderHandle}`) ||
      e.target.closest(`.${styles.zoomControlGroup}`)
    ) {
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
    if (isSliderDragging) {
      return;
    }

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

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      setSliderPos((prev) => Math.max(prev - 2, 2));
    } else if (e.key === 'ArrowRight') {
      setSliderPos((prev) => Math.min(prev + 2, 98));
    }
  };

  // Canvas render loop
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

    if (isHighRes) {
      beforeSrc =
        tier06?.beforeImage ||
        tier10?.beforeImage ||
        location?.localImages?.before;

      if (viewMode === 'color') {
        afterSrc =
          tier06?.colorDiffOverlay ||
          tier06?.colorOverlay ||
          tier10?.colorDiffOverlay ||
          location?.localImages?.colorOverlay ||
          location?.localImages?.after;
      } else {
        afterSrc =
          tier06?.afterImage ||
          tier10?.afterImage ||
          location?.localImages?.after;
      }
    } else {
      beforeSrc =
        tier10?.beforeImage ||
        location?.localImages?.before;

      if (viewMode === 'color') {
        afterSrc =
          tier10?.colorDiffOverlay ||
          location?.localImages?.colorOverlay ||
          location?.localImages?.after;
      } else if (viewMode === 'ssim') {
        afterSrc =
          tier10?.ssimOverlay ||
          location?.localImages?.ssimOverlay ||
          location?.localImages?.after;
      } else {
        afterSrc =
          tier10?.afterImage ||
          location?.localImages?.after;
      }
    }

    // Reset background & configure high-definition rendering
    ctxBefore.fillStyle = '#0E1110';
    ctxBefore.fillRect(0, 0, width * dpr, height * dpr);
    ctxBefore.imageSmoothingEnabled = true;
    ctxBefore.imageSmoothingQuality = 'high';

    ctxAfter.fillStyle = '#0E1110';
    ctxAfter.fillRect(0, 0, width * dpr, height * dpr);
    ctxAfter.imageSmoothingEnabled = true;
    ctxAfter.imageSmoothingQuality = 'high';

    const applyTransform = (ctx) => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(width / 2 + panOffset.x, height / 2 + panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);
      ctx.translate(-width / 2, -height / 2);
    };

    const calculateDrawBox = (imgW, imgH) => {
      const imgAspect = imgW / imgH;
      let drawW, drawH, drawX, drawY;

      if (isHighRes && location?.id === 'mihan') {
        drawW = width;
        drawH = width / imgAspect;
        drawX = 0;
        drawY = (height - drawH) * 0.48;
      } else {
        drawW = width;
        drawH = height;
        drawX = 0;
        drawY = 0;
      }
      return { drawX, drawY, drawW, drawH };
    };

    const drawHotspotBoxes = (ctx, drawBox) => {
      if (!showHotspotBoxes || !hotspots || hotspots.length === 0) return;

      const [lat, lng] = location?.coordinates || [21.0542, 79.0518];
      const padding = 0.024;
      const baseBounds = (location?.id === 'mihan')
        ? [79.020, 21.030, 79.074, 21.090]
        : [lng - padding, lat - padding, lng + padding, lat + padding];

      const [west, south, east, north] = baseBounds;
      const { drawX, drawY, drawW, drawH } = drawBox;

      hotspots.forEach((h) => {
        const isSelected = selectedHotspotId === h.hotspot_id;
        const [h_min_lon, h_min_lat, h_max_lon, h_max_lat] = h.bbox_wgs84 || [
          h.longitude - 0.005,
          h.latitude - 0.005,
          h.longitude + 0.005,
          h.latitude + 0.005
        ];

        const x1 = drawX + ((h_min_lon - west) / (east - west + 1e-7)) * drawW;
        const x2 = drawX + ((h_max_lon - west) / (east - west + 1e-7)) * drawW;
        const y1 = drawY + ((north - h_max_lat) / (north - south + 1e-7)) * drawH;
        const y2 = drawY + ((north - h_min_lat) / (north - south + 1e-7)) * drawH;

        const bx = Math.min(x1, x2);
        const by = Math.min(y1, y2);
        const bw = Math.max(16, Math.abs(x2 - x1));
        const bh = Math.max(16, Math.abs(y2 - y1));

        ctx.strokeStyle = isSelected ? '#DC2626' : 'rgba(201, 111, 62, 0.9)';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        // Label pill
        ctx.fillStyle = isSelected ? 'rgba(220, 38, 38, 0.95)' : 'rgba(201, 111, 62, 0.9)';
        ctx.fillRect(bx, Math.max(0, by - 16), 64, 15);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(h.hotspot_id || 'HOTSPOT', bx + 4, Math.max(11, by - 5));
      });
    };

    let isSubscribed = true;

    const loadAndRender = async () => {
      try {
        const normBefore = normalizeImageUrl(beforeSrc);
        const normAfter = normalizeImageUrl(afterSrc);

        const imgB = new Image();
        const imgA = new Image();

        const [loadedB, loadedA] = await Promise.all([
          new Promise((resolve) => {
            if (!normBefore) {
              resolve(null);
              return;
            }
            imgB.onload = () => resolve(imgB);
            imgB.onerror = () => resolve(null);
            imgB.src = normBefore;
          }),
          new Promise((resolve) => {
            if (!normAfter) {
              resolve(null);
              return;
            }
            imgA.onload = () => resolve(imgA);
            imgA.onerror = () => resolve(null);
            imgA.src = normAfter;
          })
        ]);

        if (!isSubscribed) return;

        // Render Before Layer
        applyTransform(ctxBefore);
        if (loadedB) {
          const boxB = calculateDrawBox(loadedB.naturalWidth, loadedB.naturalHeight);
          ctxBefore.drawImage(loadedB, boxB.drawX, boxB.drawY, boxB.drawW, boxB.drawH);
          drawHotspotBoxes(ctxBefore, boxB);
        } else {
          drawTerrainTexture(ctxBefore, width, height, 42, false, 0, threshold);
        }
        ctxBefore.restore();

        // Render After Layer
        applyTransform(ctxAfter);
        if (loadedA) {
          const boxA = calculateDrawBox(loadedA.naturalWidth, loadedA.naturalHeight);
          ctxAfter.drawImage(loadedA, boxA.drawX, boxA.drawY, boxA.drawW, boxA.drawH);
          drawHotspotBoxes(ctxAfter, boxA);
        } else {
          const overlayMode = viewMode === 'color' ? 1 : viewMode === 'ssim' ? 2 : 0;
          drawTerrainTexture(ctxAfter, width, height, 42, true, overlayMode, threshold);
        }
        ctxAfter.restore();
      } catch (err) {
        console.warn('Canvas render fallback:', err);
      }
    };

    loadAndRender();

    return () => {
      isSubscribed = false;
    };
  }, [
    location,
    isHighRes,
    viewMode,
    threshold,
    zoomLevel,
    panOffset,
    showHotspotBoxes,
    hotspots,
    selectedHotspotId,
    selectedTier
  ]);

  return (
    <section className={styles.viewerContainer} aria-label="Satellite Imagery Inspection Workspace">
      {/* Top Header & Resolution Tier Toggle Bar */}
      <div className={styles.viewerHeader}>
        <div className={styles.titleInfo}>
          <div className={styles.sectorTitleRow}>
            <h1 className={styles.sectorTitle}>{location?.name}</h1>
            <span className={`${styles.sourceTag} ${isHighRes ? styles.sourceHighRes : ''}`}>
              {isHighRes ? 'Maxar 0.6m High-Res' : location?.isLiveAnalyzed ? 'Live Sentinel-2 (10m)' : 'Sentinel-2 L2A'}
            </span>
          </div>
          <span className={styles.sectorMeta}>
            {location?.coords || 'Nagpur AOI'} • {isHighRes ? 'Historical Sub-Meter Optical Capture' : 'Multispectral ESA Granule'}
          </span>
        </div>

        <div className={styles.controlsRow}>
          <ResolutionTierToggle
            selectedTier={selectedTier}
            onTierChange={onTierChange}
            hasHighRes={hasHighResTier}
            hasHighResTier={hasHighResTier}
          />

          <ViewModeToggle
            viewMode={viewMode}
            currentMode={viewMode}
            onModeChange={setViewMode}
            selectedTier={selectedTier}
            isHighRes={isHighRes}
          />
        </div>
      </div>

      {/* Focus & Verify Candidate Hotspots Toolbar */}
      {isHighRes && (
        <div className={styles.focusBar} role="toolbar" aria-label="Development Parcel Focus Bar">
          <div className={styles.focusPillsGroup}>
            <span className={styles.focusLabel}>📍 Focus Area:</span>
            <button
              type="button"
              className={`${styles.focusPill} ${activeFocusKey === 'overview' ? styles.activeFocus : ''}`}
              onClick={() => handleSetFocusPreset('overview', 1.0, 0, 0)}
            >
              Full Extent (1.0x)
            </button>
            {hotspots.slice(0, 4).map((h, idx) => {
              const hLon = h.longitude;
              const hLat = h.latitude;
              const [lat, lng] = location?.coordinates || [21.0542, 79.0518];
              const padding = 0.024;
              const [west, south, east, north] = (location?.id === 'mihan')
                ? [79.020, 21.030, 79.074, 21.090]
                : [lng - padding, lat - padding, lng + padding, lat + padding];

              const normX = ((hLon - west) / (east - west + 1e-7)) - 0.5;
              const normY = ((north - hLat) / (north - south + 1e-7)) - 0.5;
              const panX = -normX * 320;
              const panY = -normY * 260;

              return (
                <button
                  key={h.hotspot_id || idx}
                  type="button"
                  className={`${styles.focusPill} ${activeFocusKey === h.hotspot_id ? styles.activeFocus : ''}`}
                  onClick={() => handleSetFocusPreset(h.hotspot_id, 2.2, panX, panY, h.hotspot_id)}
                >
                  Parcel #{idx + 1} (2.2x)
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              className={styles.focusPill}
              onClick={() => setShowHotspotBoxes((s) => !s)}
              title="Toggle bounding box outlines on canvas"
            >
              {showHotspotBoxes ? 'Hide Outlines' : 'Show Outlines'}
            </button>
            {tier06?.detailCrop && (
              <button type="button" className={styles.detailBannerBtn} onClick={onOpenDetailModal}>
                High-Res Crop ↗
              </button>
            )}
          </div>
        </div>
      )}

      {location?.isPreview && (
        <div className={styles.previewNoticeBar}>
          <span className={styles.previewIcon}>ⓘ</span>
          <span>
            <strong>Preview mode:</strong> Simulated estimation. Full Sentinel-2 multispectral pipeline requires 15–20 min processing per AOI in production.
          </span>
        </div>
      )}

      {/* Centerpiece Image Split Canvas Card with Full-Bleed Edge-to-Edge Imagery */}
      <div
        className={`${styles.canvasCard} ${zoomLevel > 1.0 ? styles.canPan : ''} ${isPanning ? styles.isPanning : ''}`}
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
          onPointerDown={handleSliderPointerDown}
          onTouchStart={handleSliderTouchStart}
        />

        {/* Floating Zoom HUD Controls */}
        <div className={styles.zoomControlGroup} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1.0}
            title="Zoom out (or scroll down)"
          >
            −
          </button>
          <span className={styles.zoomPill}>{zoomLevel.toFixed(1)}x</span>
          <button
            type="button"
            className={styles.zoomBtn}
            onClick={handleZoomIn}
            disabled={zoomLevel >= 4.5}
            title="Zoom in (or scroll up)"
          >
            +
          </button>
          {zoomLevel > 1.0 && (
            <button
              type="button"
              className={styles.zoomResetBtn}
              onClick={handleResetZoom}
              title="Reset to 1.0x overview"
            >
              Reset
            </button>
          )}
        </div>

        {/* Pan Guide Indicator */}
        {zoomLevel > 1.0 && (
          <div className={styles.panIndicator}>
            <span>🖱 Drag to Pan • Scroll to Zoom</span>
          </div>
        )}

        <div className={`${styles.cornerBadge} ${styles.left}`}>
          {isHighRes
            ? `2019-01-31 (0.6m Baseline @ ${zoomLevel.toFixed(1)}x)`
            : location?.beforeDate
            ? `Baseline (${location.beforeDate})`
            : `Jan 2022 (10m @ ${zoomLevel.toFixed(1)}x)`}
        </div>
        <div className={`${styles.cornerBadge} ${styles.right}`}>
          {isHighRes
            ? viewMode === 'raw'
              ? `2025-01-30 (0.6m Current @ ${zoomLevel.toFixed(1)}x)`
              : `0.6m Calibrated Color-Diff (${(tier06?.colorDiffPct || location?.colorDiff || 6.15).toFixed(2)}% @ ${zoomLevel.toFixed(1)}x)`
            : viewMode === 'raw'
            ? location?.afterDate
              ? `Current (${location.afterDate})`
              : `Jan 2025 (10m Current @ ${zoomLevel.toFixed(1)}x)`
            : viewMode === 'color'
            ? '10m Color-Diff Overlay'
            : '10m SSIM Mask'}
        </div>
        <div className={styles.hudCoords}>{cursorCoords}</div>
      </div>

      {/* Sentinel-2 Interactive Timeline Selector (Only on 10m tier) */}
      {!isHighRes && (
        <TimelineSelector
          location={location}
          onAnalyzeDates={onAnalyzeDates}
          isAnalyzing={isAnalyzing}
          currentBeforeDate={location?.beforeDate}
          currentAfterDate={location?.afterDate}
          onResetDates={onResetDates}
        />
      )}
    </section>
  );
}

export default ImageComparisonViewer;
