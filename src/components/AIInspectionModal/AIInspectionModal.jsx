import React, { useState, useEffect } from 'react';
import styles from './AIInspectionModal.module.css';

export function AIInspectionModal({
  isOpen,
  onClose,
  caseData,
  isLoading = false,
  onExportDispatch
}) {
  const [activeZoomKey, setActiveZoomKey] = useState('level1');
  const [overlayMode, setOverlayMode] = useState('diff'); // 'diff' | 'ssim' | 'veg'
  const [completedStagesCount, setCompletedStagesCount] = useState(7);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Reset to level1 when opening a new case
  useEffect(() => {
    if (isOpen) {
      setActiveZoomKey('level1');
      setOverlayMode('diff');
    }
  }, [isOpen, caseData?.case_id]);

  if (!isOpen || !caseData) return null;

  const zoomLevels = caseData.zoom_levels || {};
  const activeZoom = zoomLevels[activeZoomKey] || zoomLevels['level1'] || {};

  const beforeSrc = activeZoom.before_image_url || '/wayback_mihan_same_season_20190131_before.png';
  const afterSrc = activeZoom.after_image_url || '/wayback_mihan_same_season_20250130_after.png';
  
  let diffSrc = activeZoom.overlay_image_url || activeZoom.difference_image_url || '/wayback_mihan_sameszn_calibrated_color_overlay.png';
  if (overlayMode === 'ssim' && activeZoom.ssim_image_url) {
    diffSrc = activeZoom.ssim_image_url;
  } else if (overlayMode === 'veg' && activeZoom.veg_overlay_image_url) {
    diffSrc = activeZoom.veg_overlay_image_url;
  }

  const priorityClass =
    caseData.priority === 'CRITICAL'
      ? styles.critical
      : caseData.priority === 'HIGH'
        ? styles.high
        : styles.medium;

  const isPermitMatched = caseData.permit_status === 'MATCH FOUND';
  const isStable = caseData.change_type === 'NO_SIGNIFICANT_CHANGE' || caseData.physical_change === 'NO';
  const changeTypesList = caseData.change_types && caseData.change_types.length > 0
    ? caseData.change_types
    : [
        {
          label: isStable ? 'Surface Stable / Canopy Intact' : caseData.change_type_label || 'New Construction',
          confidence: caseData.vision_confidence || (isStable ? 96 : 91),
          domain: isStable ? 'OTHER' : 'INFRASTRUCTURE'
        }
      ];

  const infraScore = caseData.infra_score ?? (isStable ? 0 : 88);
  const vegLossScore = caseData.veg_loss_score ?? (isStable ? 0 : 75);
  const vegGainScore = caseData.veg_gain_score ?? 0;
  const highresSsimScore = caseData.highres_ssim_score ?? 0.864;
  const highresSsimPct = caseData.highres_ssim_pct ?? (isStable ? 0.0 : 12.5);

  const handlePrintDispatch = () => {
    if (onExportDispatch) {
      onExportDispatch(caseData);
    } else {
      window.print();
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.casePill}>NMC DOSSIER #{caseData.case_id}</span>
            <div className={styles.titleGroup}>
              <h2 className={styles.title}>{caseData.name || caseData.location_name}</h2>
              <span className={styles.subtitle}>
                {caseData.coordinates} • Measured Area: {caseData.change_area_formatted || `${caseData.change_area_m2?.toLocaleString() || 0} m²`}
              </span>
            </div>
          </div>

          <div className={styles.headerRight}>
            <span className={`${styles.priorityTag} ${priorityClass}`}>
              Priority: {caseData.priority || 'HIGH'}
            </span>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close Case">
              ✕
            </button>
          </div>
        </div>

        {/* Multi-Stage Inspection Progress Bar */}
        <div className={styles.stagesBar}>
          {(caseData.stages || []).map((stage, idx) => (
            <div
              key={stage.id || idx}
              className={`${styles.stageChip} ${idx < completedStagesCount ? styles.completed : styles.active}`}
              title={stage.detail}
            >
              <span className={styles.stageCheck}>✓</span>
              <span>{stage.name.replace(/AI /gi, '').split('(')[0].trim()}</span>
            </div>
          ))}
        </div>

        {/* Modal Body: Left Visual Evidence + Right Intelligence Panel */}
        <div className={styles.modalBody}>
          {/* Visual Evidence Column */}
          <div className={styles.visualCol}>
            <div className={styles.zoomLevelBar}>
              <div className={styles.zoomLevelTabs}>
                {Object.keys(zoomLevels).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`${styles.zoomTab} ${activeZoomKey === k ? styles.activeTab : ''}`}
                    onClick={() => setActiveZoomKey(k)}
                  >
                    {zoomLevels[k].name || k.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className={styles.scaleBadge}>{activeZoom.scale || '~500m × 500m'}</span>
            </div>

            {/* Overlay Mode Selector */}
            <div className={styles.overlayModeBar}>
              <span className={styles.overlayModeLabel}>Active Analysis Layer:</span>
              <div className={styles.overlayBtnGroup}>
                <button
                  type="button"
                  className={`${styles.overlayBtn} ${overlayMode === 'diff' ? styles.overlayBtnActive : ''}`}
                  onClick={() => setOverlayMode('diff')}
                >
                  🟧 Optical Footprint
                </button>
                <button
                  type="button"
                  className={`${styles.overlayBtn} ${overlayMode === 'ssim' ? styles.overlayBtnActive : ''}`}
                  onClick={() => setOverlayMode('ssim')}
                >
                  🔲 0.6m SSIM Structure
                </button>
                <button
                  type="button"
                  className={`${styles.overlayBtn} ${overlayMode === 'veg' ? styles.overlayBtnActive : ''}`}
                  onClick={() => setOverlayMode('veg')}
                >
                  🌿 Vegetation Dynamics (Loss/Gain)
                </button>
              </div>
            </div>

            {/* 3-Panel Synchronized View */}
            <div className={styles.triptychGrid}>
              <div className={styles.panelWrapper}>
                <div className={styles.panelHeader}>
                  <span>{(caseData.before_date || activeZoom.before_date || '2019-01-31').split(' ')[0]}</span>
                  <span>0.6m Baseline</span>
                </div>
                <div className={styles.panelImageContainer}>
                  <img src={beforeSrc} alt="Historical Baseline" className={styles.panelImage} />
                </div>
              </div>

              <div className={styles.panelWrapper}>
                <div className={styles.panelHeader}>
                  <span>{(caseData.after_date || activeZoom.after_date || '2025-01-30').split(' ')[0]}</span>
                  <span>0.6m Current</span>
                </div>
                <div className={styles.panelImageContainer}>
                  <img src={afterSrc} alt="Current State" className={styles.panelImage} />
                </div>
              </div>

              <div className={styles.panelWrapper}>
                <div className={styles.panelHeader}>
                  <span>
                    {overlayMode === 'ssim'
                      ? 'SSIM Structural Matrix'
                      : overlayMode === 'veg'
                        ? 'ExG Canopy Dynamics'
                        : 'Ground Transformation'}
                  </span>
                  <span>{overlayMode === 'ssim' ? `SSIM: ${highresSsimScore}` : '0.6m Aligned'}</span>
                </div>
                <div className={styles.panelImageContainer}>
                  <img src={diffSrc} alt="Detected Footprint" className={styles.panelImage} />
                </div>
              </div>
            </div>

            {/* Dynamic Cadastral Polygon Meta */}
            {caseData.polygons && caseData.polygons.length > 0 ? (
              <div className={styles.polygonSummaryBar}>
                <span className={styles.polygonIcon}>📐</span>
                <span>
                  <strong>{caseData.polygons.length} Cadastral Polygons Vectorized</strong> — Total Measured Ground Change:{' '}
                  <strong>{(caseData.total_segmented_area_m2 || caseData.change_area_m2)?.toLocaleString()} m²</strong>
                </span>
              </div>
            ) : (
              <div className={styles.polygonSummaryBar}>
                <span className={styles.polygonIcon}>✓</span>
                <span>
                  <strong>Surface Stability Confirmed</strong> — 0 Vector Encroachment Polygons (0.0 m² alteration)
                </span>
              </div>
            )}
          </div>

          {/* Intelligence & Case Evaluation Column */}
          <div className={styles.intelCol}>
            {/* 1. Explicit Domain Scores: Infrastructure vs. Vegetation Loss vs. Vegetation Gain */}
            <div className={styles.domainScoreSection}>
              <div className={styles.domainScoreHeader}>
                <span className={styles.domainSectionTitle}>Domain Change Breakdown</span>
                <span className={styles.domainSubtitle}>Infrastructure & Environmental Indices</span>
              </div>

              <div className={styles.domainGrid}>
                {/* Infrastructure Score */}
                <div className={styles.domainCard}>
                  <div className={styles.domainTopRow}>
                    <span className={styles.domainIconLabel}>🏗 Infrastructure Change</span>
                    <span className={`${styles.domainValBadge} ${infraScore > 50 ? styles.infraHigh : styles.infraLow}`}>
                      {infraScore}%
                    </span>
                  </div>
                  <div className={styles.domainProgressBar}>
                    <div
                      className={`${styles.domainProgressFill} ${infraScore > 50 ? styles.fillInfra : styles.fillStable}`}
                      style={{ width: `${Math.max(4, infraScore)}%` }}
                    />
                  </div>
                  <span className={styles.domainStatusText}>
                    {infraScore > 50 ? caseData.infra_status || 'New Construction Active' : 'Surface Stable (No Construction)'}
                  </span>
                </div>

                {/* Vegetation Loss Score */}
                <div className={styles.domainCard}>
                  <div className={styles.domainTopRow}>
                    <span className={styles.domainIconLabel}>🌲 Vegetation / Canopy Loss</span>
                    <span className={`${styles.domainValBadge} ${vegLossScore > 50 ? styles.vegHigh : styles.vegLow}`}>
                      {vegLossScore}%
                    </span>
                  </div>
                  <div className={styles.domainProgressBar}>
                    <div
                      className={`${styles.domainProgressFill} ${vegLossScore > 50 ? styles.fillVeg : styles.fillStable}`}
                      style={{ width: `${Math.max(4, vegLossScore)}%` }}
                    />
                  </div>
                  <span className={styles.domainStatusText}>
                    {vegLossScore > 50 ? caseData.veg_loss_status || 'Biomass Loss / Clearing' : 'Canopy Intact (0.0% Loss)'}
                  </span>
                </div>

                {/* Vegetation Gain / Increment Score */}
                <div className={styles.domainCard}>
                  <div className={styles.domainTopRow}>
                    <span className={styles.domainIconLabel}>🌿 Vegetation Increment / Gain</span>
                    <span className={`${styles.domainValBadge} ${vegGainScore > 40 ? styles.vegGainHigh : styles.infraLow}`}>
                      {vegGainScore}%
                    </span>
                  </div>
                  <div className={styles.domainProgressBar}>
                    <div
                      className={`${styles.domainProgressFill} ${vegGainScore > 40 ? styles.fillVegGain : styles.fillStable}`}
                      style={{ width: `${Math.max(4, vegGainScore)}%` }}
                    />
                  </div>
                  <span className={styles.domainStatusText}>
                    {vegGainScore > 40 ? caseData.veg_gain_status || 'Afforestation / Canopy Gain' : 'Baseline Vegetation Preserved'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Multi-Sensor Evidence Confidence Matrix */}
            <div className={styles.confidenceGrid}>
              <div className={styles.confCard}>
                <span className={styles.confLabel}>Sentinel-2 (10m)</span>
                <span className={styles.confVal}>{caseData.initial_confidence}%</span>
              </div>
              <div className={styles.confCard}>
                <span className={styles.confLabel}>Wayback SSIM (0.6m)</span>
                <span className={styles.confVal}>{highresSsimPct}%</span>
                <span className={styles.confSub}>Index: {highresSsimScore}</span>
              </div>
              <div className={styles.confCard}>
                <span className={styles.confLabel}>AI Vision Audit</span>
                <span className={styles.confVal}>{caseData.vision_confidence}%</span>
              </div>
              <div className={`${styles.confCard} ${styles.finalCard}`}>
                <span className={styles.confLabel}>Composite Confidence</span>
                <div className={styles.confValRow}>
                  <span className={styles.confVal}>{caseData.composite_confidence || caseData.final_confidence}%</span>
                  <span className={styles.confStatusPill}>{caseData.status}</span>
                </div>
                <span className={styles.prototypeTag}>Prototype evidence-fusion score</span>
              </div>
            </div>

            {/* 3. Evidence Rationale & Formula Explanation */}
            <div className={styles.rationaleCard}>
              <div className={styles.rationaleHeader}>
                <span className={styles.rationaleTitle}>🔍 Scoring Rationale & Evidence Fusion</span>
              </div>
              <p className={styles.rationaleFormula}>
                <strong>Formula:</strong>{' '}
                {caseData.how_formula ||
                  '0.25 × (10m Spectral) + 0.35 × (0.6m Wayback SSIM & ExG) + 0.30 × (AI Vision) + 0.10 × (Spatial)'}
              </p>
              <p className={styles.rationaleText}>
                <strong>Why this score:</strong>{' '}
                {caseData.why_rationale ||
                  (isStable
                    ? 'Sub-meter 0.6m Wayback orthophotos and SSIM confirm structural stability and zero tree canopy loss across the baseline.'
                    : 'Sub-meter Wayback optical differencing, SSIM divergence, and Excess-Green indices confirm physical development on target parcel.')}
              </p>
            </div>

            {/* 4. Case Findings Card */}
            <div className={styles.findingsCard}>
              <div className={styles.findingsHeader}>
                <div className={styles.multiTypeBadgesGroup}>
                  {changeTypesList.map((ct, idx) => (
                    <span
                      key={idx}
                      className={`${styles.typeBadge} ${
                        ct.domain === 'ENVIRONMENTAL' ? styles.envBadge : styles.infraBadge
                      }`}
                    >
                      {ct.label} ({ct.confidence}%)
                    </span>
                  ))}
                </div>
                <span className={styles.riskLabel}>Ward Risk: {caseData.urban_growth_risk || 'LOW / STABLE'}</span>
              </div>

              <p className={styles.findingText}>
                <strong>Municipal Finding:</strong> {caseData.finding || 'Surface stability verified.'}
              </p>

              {/* Municipal Permit Cross-Reference */}
              <div className={`${styles.permitRow} ${isPermitMatched ? styles.matched : ''}`}>
                <span className={styles.permitIcon}>{isPermitMatched ? '✓' : isStable ? '✓' : '⚠'}</span>
                <div className={styles.permitDetails}>
                  <span className={styles.permitTitle}>
                    {caseData.permit_status}
                  </span>
                  <span className={styles.permitSub}>
                    NMC Town Planning Record: {caseData.permit_details}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className={styles.footerBar}>
          <div className={styles.actionPillGroup}>
            <span className={styles.actionLabel}>Recommended Action:</span>
            <span className={styles.actionBadge}>{caseData.recommended_action}</span>
          </div>

          <div className={styles.footerButtons}>
            <button type="button" className={styles.dispatchBtn} onClick={handlePrintDispatch}>
              Export Field Notice (PDF) 📄
            </button>
            <button type="button" className={styles.dismissBtn} onClick={onClose}>
              Close Case
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIInspectionModal;
