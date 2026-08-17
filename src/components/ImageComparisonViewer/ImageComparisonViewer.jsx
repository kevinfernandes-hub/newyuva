import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ComparisonSlider } from './ComparisonSlider';
import { ViewModeToggle } from './ViewModeToggle';
import { ResolutionTierToggle } from './ResolutionTierToggle';
import { TimelineSelector } from '../TimelineSelector/TimelineSelector';
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
    containerRef,
    handlePointerDown: handleSliderPointerDown,
    handleTouchStart: handleSliderTouchStart
  } = useDraggable({ initialValue: 50, min: 2, max: 98 });

  const hasHighResTier = Boolean(location?.tiers?.['0.6m']);
  const isHighRes = selectedTier === '0.6m' && hasHighResTier;
  const tier06 = location?.tiers?.['0.6m'];
  const tier10 = location?.tiers?.['10m'];

  // Reset zoom when switching locations or tiers
  useEffect(() => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
    setActiveFocusKey('overview');
  }, [location?.id, selectedTier]);

  // Automatically switch viewMode to 'color' if on 0.6m and user was on 'ssim'
  useEffect(() => {
    if (isHighRes && viewMode === 'ssim') {
      setViewMode('color');
    }
  }, [isHighRes, viewMode]);

  // Zoom handlers
  const handleZoomIn = () => {
    setZoomLevel((z) => Math.min(4.5, Number((z + 0.35).toFixed(2))));
    setActiveFocusKey('custom');
  };

  const handleZoomOut = () => {
    setZoomLevel((z) => {
      const next = Math.max(1.0, Number((z - 0.35).toFixed(2)));
      if (next === 1.0) setPanOffset({ x: 0, y: 0 });
      return next;
    });
    setActiveFocusKey('custom');
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
    setActiveFocusKey('overview');
  };

  const handleSetFocusPreset = (key, zoom, panX, panY, hotspotId = null) => {
    setActiveFocusKey(key);
    setZoomLevel(zoom);
    setPanOffset({ x: panX, y: panY });
    if (hotspotId && onSelectHotspot) {
      onSelectHotspot(hotspotId);
    }
  };

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      setZoomLevel((z) => {
        const next = Math.min(4.5, Math.max(1.0, Number((z + delta).toFixed(2))));
        if (next === 1.0) setPanOffset({ x: 0, y: 0 });
        return next;
      });
      setActiveFocusKey('custom');
    },
    []
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel, containerRef]);

  // Render canvas layers with edge-to-edge balanced fill and zoom/pan
  useEffect(() => {
    const width = 800;
    const height = 600;
    const canvasBefore = canvasBeforeRef.current;
    const canvasAfter = canvasAfterRef.current;
    if (!canvasBefore || !canvasAfter) return;

    canvasBefore.width = width;
    canvasBefore.height = height;
    canvasAfter.width = width;
    canvasAfter.height = height;

    const ctxBefore = canvasBefore.getContext('2d');
    const ctxAfter = canvasAfter.getContext('2d');

    // Pick image source based on active resolution tier & view mode
    let beforeSrc = '';
    let afterSrc = '';

    if (isHighRes && tier06) {
      beforeSrc = tier06.beforeImage;
      afterSrc = viewMode === 'color' ? tier06.colorDiffOverlay : tier06.afterImage;
    } else {
      beforeSrc = tier10?.beforeImage || location.localImages?.before;
      if (viewMode === 'color') {
        afterSrc = tier10?.colorDiffOverlay || location.localImages?.colorOverlay || location.localImages?.after;
      } else if (viewMode === 'ssim') {
        afterSrc = tier10?.ssimOverlay || location.localImages?.ssimOverlay || location.localImages?.after;
      } else {
        afterSrc = tier10?.afterImage || location.localImages?.after;
      }
    }

    // Reset background
    ctxBefore.fillStyle = '#0E1110';
    ctxBefore.fillRect(0, 0, width, height);
    ctxAfter.fillStyle = '#0E1110';
    ctxAfter.fillRect(0, 0, width, height);

    const applyTransform = (ctx) => {
      ctx.save();
      ctx.translate(width / 2 + panOffset.x, height / 2 + panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);
      ctx.translate(-width / 2, -height / 2);
    };

    // Calculate balanced fill box so the satellite imagery fills the canvas without empty black side bars
    const calculateDrawBox = (imgW, imgH) => {
      const imgAspect = imgW / imgH; // 0.833 for Wayback (2083x2500)
      let drawW, drawH, drawX, drawY;

      if (isHighRes) {
        // Fill canvas width edge-to-edge, centered vertically on the primary development corridor
        drawW = width;
        drawH = width / imgAspect; // ~960px
        drawX = 0;
        drawY = (height - drawH) * 0.48; // Centered on AIIMS & Tech SEZ
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

      const baseBounds = [79.020, 21.030, 79.074, 21.090];
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

        const x1 = drawX + ((h_min_lon - west) / (east - west)) * drawW;
        const x2 = drawX + ((h_max_lon - west) / (east - west)) * drawW;
        const y1 = drawY + ((north - h_max_lat) / (north - south)) * drawH;
        const y2 = drawY + ((north - h_min_lat) / (north - south)) * drawH;

        const bx = Math.min(x1, x2);
        const by = Math.min(y1, y2);
        const bw = Math.abs(x2 - x1);
        const bh = Math.abs(y2 - y1);

        ctx.strokeStyle = isSelected ? '#DC2626' : 'rgba(201, 111, 62, 0.9)';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        // Label pill
        ctx.fillStyle = isSelected ? 'rgba(220, 38, 38, 0.95)' : 'rgba(201, 111, 62, 0.9)';
        ctx.fillRect(bx, Math.max(0, by - 16), 68, 15);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(h.hotspot_id || 'HOTSPOT', bx + 4, Math.max(11, by - 5));
      });
    };

    // 1. Draw Before Layer
    if (beforeSrc) {
      const imgBefore = new Image();
      imgBefore.crossOrigin = 'anonymous';
      imgBefore.onload = () => {
        const drawBox = calculateDrawBox(imgBefore.naturalWidth || imgBefore.width || 2083, imgBefore.naturalHeight || imgBefore.height || 2500);
        applyTransform(ctxBefore);
        ctxBefore.drawImage(imgBefore, drawBox.drawX, drawBox.drawY, drawBox.drawW, drawBox.drawH);
        drawHotspotBoxes(ctxBefore, drawBox);
        ctxBefore.restore();
      };
      imgBefore.onerror = () => {
        const drawBox = { drawX: 0, drawY: 0, drawW: width, drawH: height };
        applyTransform(ctxBefore);
        const seed = location.id.charCodeAt(0) * 19 + location.id.length * 37;
        drawTerrainTexture(ctxBefore, width, height, seed, false, 0, threshold);
        drawHotspotBoxes(ctxBefore, drawBox);
        ctxBefore.restore();
      };
      imgBefore.src = beforeSrc;
    } else {
      const drawBox = { drawX: 0, drawY: 0, drawW: width, drawH: height };
      applyTransform(ctxBefore);
      const seed = location.id.charCodeAt(0) * 19 + location.id.length * 37;
      drawTerrainTexture(ctxBefore, width, height, seed, false, 0, threshold);
      drawHotspotBoxes(ctxBefore, drawBox);
      ctxBefore.restore();
    }

    // 2. Draw After/Overlay Layer
    if (afterSrc) {
      const imgAfter = new Image();
      imgAfter.crossOrigin = 'anonymous';
      imgAfter.onload = () => {
        const drawBox = calculateDrawBox(imgAfter.naturalWidth || imgAfter.width || 2083, imgAfter.naturalHeight || imgAfter.height || 2500);
        applyTransform(ctxAfter);
        ctxAfter.drawImage(imgAfter, drawBox.drawX, drawBox.drawY, drawBox.drawW, drawBox.drawH);
        drawHotspotBoxes(ctxAfter, drawBox);
        ctxAfter.restore();
      };
      imgAfter.onerror = () => {
        const drawBox = { drawX: 0, drawY: 0, drawW: width, drawH: height };
        applyTransform(ctxAfter);
        const seed = location.id.charCodeAt(0) * 19 + location.id.length * 37;
        const overlayType = viewMode === 'color' ? 1 : viewMode === 'ssim' ? 2 : 0;
        drawTerrainTexture(ctxAfter, width, height, seed, true, overlayType, threshold);
        drawHotspotBoxes(ctxAfter, drawBox);
        ctxAfter.restore();
      };
      imgAfter.src = afterSrc;
    } else {
      const drawBox = { drawX: 0, drawY: 0, drawW: width, drawH: height };
      applyTransform(ctxAfter);
      const seed = location.id.charCodeAt(0) * 19 + location.id.length * 37;
      const overlayType = viewMode === 'color' ? 1 : viewMode === 'ssim' ? 2 : 0;
      drawTerrainTexture(ctxAfter, width, height, seed, true, overlayType, threshold);
      drawHotspotBoxes(ctxAfter, drawBox);
      ctxAfter.restore();
    }
  }, [
    location,
    viewMode,
    threshold,
    selectedTier,
    isHighRes,
    tier06,
    tier10,
    zoomLevel,
    panOffset,
    hotspots,
    selectedHotspotId,
    showHotspotBoxes
  ]);

  // Pan & Hover handler
  const handleMouseMove = useCallback(
    (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const px = Math.floor(e.clientX - rect.left);
      const py = Math.floor(e.clientY - rect.top);

      if (isPanning && zoomLevel > 1.0) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        const maxPanX = (zoomLevel - 1) * 350;
        const maxPanY = (zoomLevel - 1) * 450;
        const newX = Math.max(-maxPanX, Math.min(maxPanX, panStartRef.current.panX + dx));
        const newY = Math.max(-maxPanY, Math.min(maxPanY, panStartRef.current.panY + dy));
        setPanOffset({ x: newX, y: newY });
      }

      // Calculate dynamic geographical coordinates based on pan & zoom
      const baseLat = location.coordinates ? location.coordinates[0] : 21.05;
      const baseLon = location.coordinates ? location.coordinates[1] : 79.05;
      const normX = (px - rect.width / 2 - panOffset.x) / (rect.width * zoomLevel);
      const normY = (py - rect.height / 2 - panOffset.y) / (rect.height * zoomLevel);

      const lat = (baseLat - normY * 0.04).toFixed(4);
      const lon = (baseLon + normX * 0.04).toFixed(4);
      setCursorCoords(`${lat}° N, ${lon}° E`);
    },
    [containerRef, location, isPanning, zoomLevel, panOffset]
  );

  const handleMouseDown = (e) => {
    // If clicking near center slider handle, let slider handle it
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const sliderX = (sliderPos / 100) * rect.width;
      if (Math.abs(clickX - sliderX) < 20) {
        handleSliderPointerDown(e);
        return;
      }
    }

    // Otherwise initiate pan if zoomed
    if (zoomLevel > 1.0) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panOffset.x,
        panY: panOffset.y
      };
    }
  };

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false);
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowLeft') {
        setSliderPos((p) => Math.max(5, p - 3));
      } else if (e.key === 'ArrowRight') {
        setSliderPos((p) => Math.min(95, p + 3));
      }
    },
    [setSliderPos]
  );

  return (
    <section className={styles.viewerSection} aria-label="Satellite Imagery Comparison and Timeline">
      <div className={styles.headerBar}>
        <div className={styles.metaGroup}>
          <span className={styles.locationTitle}>{location.name}</span>
          {location.isPreview && <span className={styles.previewTag}>PREVIEW ESTIMATE</span>}
          {location.isLiveAnalyzed && <span className={styles.liveTag}>LIVE SENTINEL-2</span>}
          {isHighRes && <span className={styles.previewTag} style={{ background: 'var(--accent-primary)' }}>0.6m MAXAR</span>}
          <span className={styles.coordsPill}>{location.coords}</span>
        </div>

        <div className={styles.controlsRow}>
          <ResolutionTierToggle
            selectedTier={selectedTier}
            onTierChange={onTierChange}
            hasHighResTier={hasHighResTier}
          />
          <ViewModeToggle
            currentMode={viewMode}
            onModeChange={setViewMode}
            selectedTier={selectedTier}
            tierNote={tier06?.note}
          />
        </div>
      </div>

      {/* Sub-meter Sector Focus Toolbar (Only on 0.6m tier) */}
      {isHighRes && (
        <div className={styles.submeterToolbar}>
          <div className={styles.focusPillsGroup}>
            <span className={styles.focusLabel}>🎯 Focus & Verify:</span>
            <button
              type="button"
              className={`${styles.focusPill} ${activeFocusKey === 'overview' ? styles.activeFocus : ''}`}
              onClick={() => handleSetFocusPreset('overview', 1.0, 0, 0)}
            >
              1.0x Full Sector
            </button>
            <button
              type="button"
              className={`${styles.focusPill} ${activeFocusKey === 'aiims' ? styles.activeFocus : ''}`}
              onClick={() => handleSetFocusPreset('aiims', 2.2, -30, 20, 'MIHAN-042')}
            >
              2.2x #NGP-042 (AIIMS)
            </button>
            <button
              type="button"
              className={`${styles.focusPill} ${activeFocusKey === 'sez' ? styles.activeFocus : ''}`}
              onClick={() => handleSetFocusPreset('sez', 2.2, 50, -20, 'MIHAN-043')}
            >
              2.2x #NGP-043 (Logistics)
            </button>
            <button
              type="button"
              className={`${styles.focusPill} ${activeFocusKey === 'tech' ? styles.activeFocus : ''}`}
              onClick={() => handleSetFocusPreset('tech', 2.0, 20, -50, 'MIHAN-044')}
            >
              2.0x #NGP-044 (Tech SEZ)
            </button>
            <button
              type="button"
              className={`${styles.focusPill} ${activeFocusKey === 'hwy' ? styles.activeFocus : ''}`}
              onClick={() => handleSetFocusPreset('hwy', 2.0, -50, -40, 'MIHAN-045')}
            >
              2.0x #NGP-045 (Interchange)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              className={styles.focusPill}
              onClick={() => setShowHotspotBoxes((s) => !s)}
              title="Toggle bounding box outlines on canvas"
            >
              {showHotspotBoxes ? 'Hide Hotspots' : 'Show Hotspots'}
            </button>
            {tier06?.detailCrop && (
              <button type="button" className={styles.detailBannerBtn} onClick={onOpenDetailModal}>
                Building Detail ↗
              </button>
            )}
          </div>
        </div>
      )}

      {location.isPreview && (
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
            : location.beforeDate
            ? `Baseline (${location.beforeDate})`
            : `Jan 2022 (10m @ ${zoomLevel.toFixed(1)}x)`}
        </div>
        <div className={`${styles.cornerBadge} ${styles.right}`}>
          {isHighRes
            ? viewMode === 'raw'
              ? `2025-01-30 (0.6m Current @ ${zoomLevel.toFixed(1)}x)`
              : `0.6m Calibrated Color-Diff (6.15% @ ${zoomLevel.toFixed(1)}x)`
            : viewMode === 'raw'
            ? location.afterDate
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
          currentBeforeDate={location.beforeDate}
          currentAfterDate={location.afterDate}
          onResetDates={onResetDates}
        />
      )}
    </section>
  );
}

export default ImageComparisonViewer;
