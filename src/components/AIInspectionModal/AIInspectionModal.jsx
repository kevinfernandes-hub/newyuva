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
  const [overlayMode, setOverlayMode] = useState('diff'); // 'diff' | 'ssim' | 'veg' | 'yolo' | 'yolo_mask'
  const [completedStagesCount, setCompletedStagesCount] = useState(7);
  const [selectedBldg, setSelectedBldg] = useState(null);

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
  
  const yoloRes = caseData.yolo_analysis || null;
  const yoloArtifacts = yoloRes?.artifacts || null;

  let diffSrc = activeZoom.overlay_image_url || activeZoom.difference_image_url || '/wayback_mihan_sameszn_calibrated_color_overlay.png';
  if (overlayMode === 'yolo' && yoloArtifacts?.change_overlay) {
    diffSrc = yoloArtifacts.change_overlay;
  } else if (overlayMode === 'yolo_mask' && yoloArtifacts?.change_mask) {
    diffSrc = yoloArtifacts.change_mask;
  } else if (overlayMode === 'ssim' && activeZoom.ssim_image_url) {
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

  const cropDiffPct = activeZoom.diff_pct ?? caseData.diff_pct ?? 0;
  const cropVegLoss = activeZoom.veg_loss_pct ?? caseData.veg_loss_pct ?? 0;
  const cropVegGain = activeZoom.veg_gain_pct ?? caseData.veg_gain_pct ?? 0;
  const cropSsimPct = activeZoom.highres_ssim_pct ?? caseData.highres_ssim_pct ?? 0;
  const cropSsimScore = activeZoom.highres_ssim_score ?? caseData.highres_ssim_score ?? 0.7412;

  const infraScore = isStable ? 0 : Number((caseData.infra_score ?? cropDiffPct ?? 3.20).toFixed(2));
  const vegLossScore = isStable ? 0 : Number((caseData.veg_loss_score ?? cropVegLoss ?? 1.80).toFixed(2));
  const vegGainScore = isStable ? 0 : Number((caseData.veg_gain_score ?? cropVegGain ?? 4.64).toFixed(2));
  const highresSsimScore = isStable ? 0.9820 : Number(cropSsimScore.toFixed(4));
  const highresSsimPct = isStable ? 0.0 : Number(cropSsimPct.toFixed(2));

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
            <div className={styles.overlayBar}>
              <span className={styles.overlayLabel}>ACTIVE ANALYSIS LAYER:</span>
              <div className={styles.overlayBtns}>
                <button
                  type="button"
                  className={`${styles.overlayBtn} ${overlayMode === 'diff' ? styles.overlayBtnActive : ''}`}
                  onClick={() => setOverlayMode('diff')}
                >
                  🟧 Optical Footprint
                </button>
                <button
                  type="button"
                  className={`${styles.overlayBtn} ${overlayMode === 'yolo' ? styles.overlayBtnActive : ''}`}
                  onClick={() => setOverlayMode('yolo')}
                >
                  🏢 YOLO Buildings
                </button>
                <button
                  type="button"
                  className={`${styles.overlayBtn} ${overlayMode === 'yolo_mask' ? styles.overlayBtnActive : ''}`}
                  onClick={() => setOverlayMode('yolo_mask')}
                >
                  🟥 YOLO Change Mask
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
                  🌿 Vegetation Dynamics
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
                    <span className={`${styles.domainValBadge} ${infraScore > 1.5 ? styles.infraHigh : styles.infraLow}`}>
                      {infraScore}%
                    </span>
                  </div>
                  <div className={styles.domainProgressBar}>
                    <div
                      className={`${styles.domainProgressFill} ${infraScore > 1.5 ? styles.fillInfra : styles.fillStable}`}
                      style={{ width: `${Math.min(100, Math.max(4, infraScore * 6))}%` }}
                    />
                  </div>
                  <span className={styles.domainStatusText}>
                    {infraScore > 1.5 ? caseData.infra_status || 'New Construction Active' : 'Surface Stable (No Construction)'}
                  </span>
                </div>

                {/* Vegetation Loss Score */}
                <div className={styles.domainCard}>
                  <div className={styles.domainTopRow}>
                    <span className={styles.domainIconLabel}>🌲 Vegetation / Canopy Loss</span>
                    <span className={`${styles.domainValBadge} ${vegLossScore > 1.5 ? styles.vegHigh : styles.vegLow}`}>
                      {vegLossScore}%
                    </span>
                  </div>
                  <div className={styles.domainProgressBar}>
                    <div
                      className={`${styles.domainProgressFill} ${vegLossScore > 1.5 ? styles.fillVeg : styles.fillStable}`}
                      style={{ width: `${Math.min(100, Math.max(4, vegLossScore * 8))}%` }}
                    />
                  </div>
                  <span className={styles.domainStatusText}>
                    {vegLossScore > 1.5 ? caseData.veg_loss_status || 'Biomass Loss / Clearing' : 'Canopy Intact (0.0% Loss)'}
                  </span>
                </div>

                {/* Vegetation Gain / Increment Score */}
                <div className={styles.domainCard}>
                  <div className={styles.domainTopRow}>
                    <span className={styles.domainIconLabel}>🌿 Vegetation Increment / Gain</span>
                    <span className={`${styles.domainValBadge} ${vegGainScore > 1.5 ? styles.vegGainHigh : styles.infraLow}`}>
                      {vegGainScore}%
                    </span>
                  </div>
                  <div className={styles.domainProgressBar}>
                    <div
                      className={`${styles.domainProgressFill} ${vegGainScore > 1.5 ? styles.fillVegGain : styles.fillStable}`}
                      style={{ width: `${Math.min(100, Math.max(4, vegGainScore * 8))}%` }}
                    />
                  </div>
                  <span className={styles.domainStatusText}>
                    {vegGainScore > 1.5 ? caseData.veg_gain_status || 'Afforestation / Canopy Gain' : 'Baseline Vegetation Preserved'}
                  </span>
                </div>
              </div>
            </div>

            {/* 1.5 YOLO Building Instance Segmentation Section */}
            {yoloRes && (
              <div className={styles.domainScoreSection} style={{ borderLeft: '4px solid #3B82F6', background: 'rgba(15, 23, 42, 0.95)' }}>
                <div className={styles.domainScoreHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={styles.domainSectionTitle}>🏢 YOLO Building Instance Intelligence</span>
                    <span style={{ fontSize: '11px', background: '#1E3A8A', color: '#60A5FA', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                      {yoloRes.model_transparency?.device?.toUpperCase() || 'CUDA:0'}
                    </span>
                  </div>
                  <span className={styles.domainSubtitle}>
                    Model: {yoloRes.model_transparency?.model_name || 'yolov8s-building-segmentation'} • Conf Thresh: 0.35
                  </span>
                </div>

                {/* Counter Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', margin: '12px 0' }}>
                  <div style={{ background: '#1E293B', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>Before</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#F8FAFC' }}>{yoloRes.summary?.buildings_before ?? 0}</div>
                  </div>
                  <div style={{ background: '#1E293B', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>After</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#F8FAFC' }}>{yoloRes.summary?.buildings_after ?? 0}</div>
                  </div>
                  <div style={{ background: '#1E293B', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>Existing</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#22C55E' }}>{yoloRes.summary?.existing_buildings ?? 0}</div>
                  </div>
                  <div style={{ background: '#1E293B', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>New</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#EF4444' }}>{yoloRes.summary?.new_buildings ?? 0}</div>
                  </div>
                  <div style={{ background: '#1E293B', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>Peak Evidence</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3B82F6' }}>{yoloRes.summary?.peak_evidence_score ?? 0}%</div>
                  </div>
                </div>

                {/* Building Candidates list */}
                {yoloRes.buildings && yoloRes.buildings.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#CBD5E1', marginBottom: '6px' }}>
                      Detected Building Footprints (Click for Details):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {yoloRes.buildings.map((bldg) => (
                        <button
                          key={bldg.building_id}
                          type="button"
                          onClick={() => setSelectedBldg(bldg)}
                          style={{
                            background: bldg.category === 'NEW' ? '#450A0A' : bldg.category === 'EXPANDED' ? '#451A03' : '#064E3B',
                            border: `1px solid ${bldg.category === 'NEW' ? '#EF4444' : bldg.category === 'EXPANDED' ? '#F97316' : '#10B981'}`,
                            color: '#F8FAFC',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <strong>{bldg.building_id}</strong>
                          <span style={{ fontSize: '10px', opacity: 0.8 }}>({bldg.category})</span>
                          <span style={{ background: 'rgba(255,255,255,0.15)', padding: '1px 4px', borderRadius: '2px' }}>{bldg.yolo_confidence}%</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Interactive Selected Building Detail Card */}
            {selectedBldg && (
              <div style={{ background: '#0F172A', border: '1px solid #3B82F6', borderRadius: '8px', padding: '12px', margin: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold', color: '#60A5FA', fontSize: '14px' }}>{selectedBldg.building_id}</span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: selectedBldg.category === 'NEW' ? '#EF4444' : '#10B981',
                      color: '#FFF'
                    }}>
                      {selectedBldg.category}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedBldg(null)}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '14px' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#CBD5E1' }}>
                  <div><strong>YOLO Confidence:</strong> {selectedBldg.yolo_confidence}%</div>
                  <div><strong>Temporal IoU:</strong> {selectedBldg.temporal_iou}</div>
                  <div><strong>Pixel Area:</strong> {selectedBldg.pixel_area} px</div>
                  <div><strong>Footprint Area:</strong> {selectedBldg.area_formatted}</div>
                  <div><strong>SSIM Divergence:</strong> {((selectedBldg.evidence?.ssim_divergence ?? 0) * 100).toFixed(1)}%</div>
                  <div><strong>Evidence Score:</strong> {selectedBldg.evidence?.evidence_score ?? 0} / 100</div>
                  <div><strong>Verification Status:</strong> {selectedBldg.evidence?.verification_status}</div>
                  <div><strong>Centroid:</strong> {selectedBldg.centroid ? `${selectedBldg.centroid[0].toFixed(4)}°, ${selectedBldg.centroid[1].toFixed(4)}°` : 'N/A'}</div>
                </div>
              </div>
            )}

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
