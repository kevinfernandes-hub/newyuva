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
    }
  }, [isOpen, caseData?.case_id]);

  if (!isOpen || !caseData) return null;

  const zoomLevels = caseData.zoom_levels || {};
  const activeZoom = zoomLevels[activeZoomKey] || zoomLevels['level1'] || {};

  const beforeSrc = activeZoom.before_image_url || '/wayback_mihan_same_season_20190131_before.png';
  const afterSrc = activeZoom.after_image_url || '/wayback_mihan_same_season_20250130_after.png';
  const diffSrc = activeZoom.difference_image_url || activeZoom.overlay_image_url || '/wayback_mihan_sameszn_calibrated_color_overlay.png';

  const priorityClass =
    caseData.priority === 'CRITICAL'
      ? styles.critical
      : caseData.priority === 'HIGH'
      ? styles.high
      : styles.medium;

  const isPermitMatched = caseData.permit_status === 'MATCH FOUND';

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
            <span className={styles.casePill}>{caseData.case_id}</span>
            <div className={styles.titleGroup}>
              <h2 className={styles.title}>{caseData.name || caseData.location_name}</h2>
              <span className={styles.subtitle}>{caseData.coordinates} • {caseData.change_area_formatted}</span>
            </div>
          </div>

          <div className={styles.headerRight}>
            <span className={`${styles.priorityTag} ${priorityClass}`}>
              Priority: {caseData.priority}
            </span>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close AI inspection case">
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
              <span>{stage.name.split('(')[0].trim()}</span>
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

            {/* 3-Panel Synchronized Triptych View */}
            <div className={styles.triptychGrid}>
              <div className={styles.panelWrapper}>
                <div className={styles.panelHeader}>
                  <span>2019-01-31</span>
                  <span>0.6m Baseline</span>
                </div>
                <div className={styles.panelImageContainer}>
                  <img src={beforeSrc} alt="Historical Wayback 0.6m Baseline" className={styles.panelImage} />
                </div>
              </div>

              <div className={styles.panelWrapper}>
                <div className={styles.panelHeader}>
                  <span>2025-01-30</span>
                  <span>0.6m Current</span>
                </div>
                <div className={styles.panelImageContainer}>
                  <img src={afterSrc} alt="Current Wayback 0.6m High-Res" className={styles.panelImage} />
                </div>
              </div>

              <div className={styles.panelWrapper}>
                <div className={styles.panelHeader}>
                  <span>AI Difference</span>
                  <span>Calibrated Overlay</span>
                </div>
                <div className={styles.panelImageContainer}>
                  <img src={diffSrc} alt="Morphological Difference Overlay" className={styles.panelImage} />
                </div>
              </div>
            </div>
          </div>

          {/* Intelligence & Case Evaluation Column */}
          <div className={styles.intelCol}>
            {/* 4-Tier Multi-Modal Confidence Matrix */}
            <div className={styles.confidenceGrid}>
              <div className={styles.confCard}>
                <span className={styles.confLabel}>Initial 10m Detection</span>
                <span className={styles.confVal}>{caseData.initial_confidence}%</span>
              </div>
              <div className={styles.confCard}>
                <span className={styles.confLabel}>0.6m Wayback Check</span>
                <span className={styles.confVal}>{caseData.highres_confidence}%</span>
              </div>
              <div className={styles.confCard}>
                <span className={styles.confLabel}>AI Vision Inspection</span>
                <span className={styles.confVal}>{caseData.vision_confidence}%</span>
              </div>
              <div className={`${styles.confCard} ${styles.finalCard}`}>
                <span className={styles.confLabel}>EarthWatch Composite Confidence</span>
                <div className={styles.confValRow}>
                  <span className={styles.confVal}>{caseData.composite_confidence || caseData.final_confidence}%</span>
                  <span className={styles.confStatusPill}>{caseData.status}</span>
                </div>
              </div>
            </div>

            {/* AI Findings Card */}
            <div className={styles.findingsCard}>
              <div className={styles.findingsHeader}>
                <span className={styles.categoryBadge}>
                  {caseData.change_type_label || 'New Construction'}
                </span>
                <span className={styles.confLabel}>Growth Risk: {caseData.urban_growth_risk} ({caseData.growth_risk_score}/100)</span>
              </div>

              <p className={styles.findingText}>
                <strong>AI Finding:</strong> {caseData.finding || 'New large-scale institutional construction detected.'}
              </p>

              <p className={styles.evidenceText}>
                <strong>Visual Evidence:</strong> {caseData.evidence_summary}
              </p>

              {/* Municipal Permit Cross-Reference */}
              <div className={`${styles.permitRow} ${isPermitMatched ? styles.matched : ''}`}>
                <span className={styles.permitIcon}>{isPermitMatched ? '✓' : '⚠'}</span>
                <div className={styles.permitDetails}>
                  <span className={styles.permitTitle}>
                    {caseData.permit_status}
                  </span>
                  <span className={styles.permitSub}>
                    Development Record Cross-Reference — Demonstration Dataset: {caseData.permit_details}
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
              Export Field Dispatch Case 📄
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
