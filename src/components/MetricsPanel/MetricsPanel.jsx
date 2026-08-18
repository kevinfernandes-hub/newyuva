import React from 'react';
import styles from './MetricsPanel.module.css';
import { AIInsightCard } from '../AIInsightCard/AIInsightCard';

export function MetricsPanel({
  location,
  selectedTier = '10m',
  hotspots = [],
  selectedHotspotId,
  onSelectHotspot,
  onInspectHotspot
}) {
  const isStable =
    location?.isSurfaceStable ||
    location?.evidenceVerdict === 'SURFACE_STABLE' ||
    (location?.colorDiff < 1.0 && location?.ssimArea < 1.0);

  const activeHotspot =
    hotspots.find((h) => h.hotspot_id === selectedHotspotId) || hotspots[0] || null;

  const isHighRes = selectedTier === '0.6m';
  const tier06 = location?.tiers?.['0.6m'];
  const tier10 = location?.tiers?.['10m'];

  // Dynamically pull metrics corresponding to the active sensor tier
  const infraScore = isStable
    ? 0
    : isHighRes
      ? Number((tier06?.infraPct ?? Math.min(25, Number((location?.colorDiff || 3.11).toFixed(2)))).toFixed(2))
      : Number((tier10?.colorDiffPct ?? location?.colorDiff ?? 7.06).toFixed(2));

  const vegLossScore = isStable
    ? 0
    : isHighRes
      ? Number((tier06?.vegLossPct ?? 0.60).toFixed(2))
      : Number(((tier10?.ssimPct ?? location?.ssimArea ?? 9.20) * 0.25).toFixed(2));

  const vegGainScore = isStable
    ? 0
    : isHighRes
      ? Number((tier06?.vegGainPct ?? 2.87).toFixed(2))
      : 0;

  const ssimIndex = isHighRes
    ? (tier06?.ssimScore ?? 0.7412)
    : (tier10?.ssimScore ?? location?.ssimScore ?? 0.6840);

  const ssimDivergencePct = isHighRes
    ? (tier06?.ssimPct ?? 6.85)
    : (tier10?.ssimPct ?? location?.ssimArea ?? 9.20);

  const handleDownloadNotice = () => {
    const noticeContent = `
================================================================================
NAGPUR MUNICIPAL CORPORATION (NMC)
TOWN PLANNING & URBAN DEVELOPMENT CELL
CIVIL LINES, NAGPUR - 440001
================================================================================
OFFICIAL FIELD INSPECTION NOTICE (FORM-B)
Generated via Nagpur EarthWatch Autonomous Satellite Intelligence Platform

Date of Issue: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
Notice Reference: NMC/TPD/SURV/${new Date().getFullYear()}/${activeHotspot?.hotspot_id || 'NGP-043'}

1. TARGET WARD & PARCEL DETAILS:
--------------------------------------------------------------------------------
- Location / Corridor: ${location?.name || 'MIHAN / Outer Ring Road'} (${location?.subtitle || 'Ward IX'})
- Coordinates: ${activeHotspot?.coords_str || '21.0542° N, 79.0518° E'}
- Flagged Parcel ID: ${activeHotspot?.hotspot_id || 'MIHAN-043'}
- Ground Change Area: ${activeHotspot?.area_formatted || '18,450 m²'}
- Primary Typology: ${activeHotspot?.change_type_label || 'Industrial Facility Expansion'}

2. MULTI-SENSOR SATELLITE EVIDENCE:
--------------------------------------------------------------------------------
- Active Sensor Tier:   ${isHighRes ? 'Maxar / Esri Wayback (~0.6m Sub-Meter)' : 'Copernicus Sentinel-2 (10m Multi-Spectral)'}
- Baseline Acquisition: ${location?.beforeDate || (isHighRes ? '2019-01-31 (Maxar 0.6m)' : '2020-01-15 (Sentinel-2 10m)')}
- Latest Acquisition:   ${location?.afterDate || (isHighRes ? '2025-01-30 (Maxar 0.6m)' : '2025-01-20 (Sentinel-2 10m)')}
- ${isHighRes ? 'Infrastructure Envelope Score' : 'Multi-Spectral Delta (ΔE)'}: ${infraScore.toFixed(2)}%
- Canopy Loss Score:           ${vegLossScore.toFixed(2)}%
- Afforestation / Gain Score:  ${vegGainScore.toFixed(2)}%
- SSIM Structural Index:       ${ssimIndex.toFixed(4)} (Divergence: ${ssimDivergencePct.toFixed(2)}%)

3. COMPLIANCE & DIRECTIVE:
--------------------------------------------------------------------------------
Development record cross-reference indicates no active sanction on file for this
envelope (Reference Demonstration Dataset). 
ACTION REQUIRED: Field verification by Town Planning Officer within 48 hours.

Authorized Signatory,
Town Planning Directorate, Nagpur Municipal Corporation
================================================================================
`;

    const blob = new Blob([noticeContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NMC_Notice_${activeHotspot?.hotspot_id || 'NGP-043'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className={styles.rail}>
      {/* 1. Header of Intelligence Rail */}
      <div className={styles.railHeader}>
        <div className={styles.headerTitles}>
          <span className={styles.railTag}>
            {isHighRes ? '🔍 MAXAR 0.6M SUB-METER AUDIT' : '🛰️ SENTINEL-2 10M SCREENING'}
          </span>
          <h3 className={styles.railTitle}>{location?.name || 'MIHAN Corridor'}</h3>
        </div>
        <span className={`${styles.statusBadge} ${isStable ? styles.badgeStable : styles.badgeCritical}`}>
          {isStable ? '✓ SURFACE STABLE' : '⚠️ GROUND TRANSFORMATION'}
        </span>
      </div>

      <div className={styles.scrollContent}>
        {/* 2. Executive Ground Change Verdict */}
        <div className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <span className={styles.cardTitle}>
              {isHighRes ? '0.6m Aerial Change Breakdown' : '10m Multi-Spectral Breakdown'}
            </span>
            <span className={styles.verifiedTag}>
              {isHighRes ? '✓ Sub-Meter Confirmed' : '✓ 10m Granule Scanned'}
            </span>
          </div>

          <div className={styles.domainMeterList}>
            {/* Infrastructure / Spectral */}
            <div className={styles.meterItem}>
              <div className={styles.meterHeader}>
                <span className={styles.meterName}>
                  {isHighRes ? '🏗️ Infrastructure & Construction' : '🌈 Multi-Spectral Delta (ΔE)'}
                </span>
                <span className={styles.meterVal}>{infraScore.toFixed(2)}%</span>
              </div>
              <div className={styles.progressBarBg}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${Math.min(100, infraScore * 6)}%`, background: '#2563EB' }}
                />
              </div>
              <span className={styles.meterSub}>
                {isHighRes
                  ? (infraScore > 1.5 ? 'New building foundations & structural grading' : 'No major construction detected')
                  : 'B4/B3/B2 Visible + NIR Reflectance surface variance'}
              </span>
            </div>

            {/* Vegetation Loss */}
            <div className={styles.meterItem}>
              <div className={styles.meterHeader}>
                <span className={styles.meterName}>🌲 Tree Canopy / Biomass Loss</span>
                <span className={styles.meterVal}>{vegLossScore.toFixed(2)}%</span>
              </div>
              <div className={styles.progressBarBg}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${Math.min(100, vegLossScore * 8)}%`, background: '#EF4444' }}
                />
              </div>
              <span className={styles.meterSub}>
                {vegLossScore > 1.0 ? 'Tree cover removal & open plot clearance' : 'Canopy baseline intact'}
              </span>
            </div>

            {/* Vegetation Gain (Only at 0.6m high-res tier) */}
            {isHighRes && (
              <div className={styles.meterItem}>
                <div className={styles.meterHeader}>
                  <span className={styles.meterName}>🌿 Afforestation / Vegetation Gain</span>
                  <span className={styles.meterVal}>{vegGainScore.toFixed(2)}%</span>
                </div>
                <div className={styles.progressBarBg}>
                  <div
                    className={styles.progressBarFill}
                    style={{ width: `${Math.min(100, vegGainScore * 8)}%`, background: '#10B981' }}
                  />
                </div>
                <span className={styles.meterSub}>
                  {vegGainScore > 1.0 ? 'New plantations, green corridors & tree growth' : 'Baseline canopy maintained'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Town Planning Compliance Card & Actions */}
        <div className={styles.card}>
          <div className={styles.cardHeaderRow}>
            <span className={styles.cardTitle}>Municipal Compliance & Actions</span>
            <span className={styles.sanctionBadge}>
              {isStable ? 'SANCTIONED' : 'UNVERIFIED'}
            </span>
          </div>

          <p className={styles.complianceText}>
            {isStable
              ? 'Multi-spectral satellite screening confirms zero unauthorized encroachment across this sector.'
              : 'Potential unauthorized structural emergence detected without active sanction on demonstration record. Field audit recommended.'}
          </p>

          <div className={styles.actionButtonGroup}>
            <button
              type="button"
              className={styles.primaryActionBtn}
              onClick={() => onInspectHotspot && onInspectHotspot(activeHotspot?.hotspot_id || 'MIHAN-043')}
            >
              <span>🔍 Open AI Multi-Level Zoom Inspection</span>
              <span>→</span>
            </button>

            <button
              type="button"
              className={styles.secondaryActionBtn}
              onClick={handleDownloadNotice}
            >
              <span>📄 Export Official NMC Field Notice</span>
              <span>↓</span>
            </button>
          </div>
        </div>

        {/* 4. Flagged Development Parcels (Hotspot Queue) */}
        {!isStable && hotspots.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardHeaderRow}>
              <span className={styles.cardTitle}>Flagged Parcels ({hotspots.length})</span>
              <span className={styles.priorityPill}>High Priority</span>
            </div>

            <div className={styles.hotspotList}>
              {hotspots.map((h, idx) => {
                const isSelected = (h.hotspot_id === selectedHotspotId) || (!selectedHotspotId && idx === 0);
                return (
                  <div
                    key={h.hotspot_id || idx}
                    className={`${styles.hotspotListItem} ${isSelected ? styles.hotspotItemSelected : ''}`}
                    onClick={() => onSelectHotspot && onSelectHotspot(h.hotspot_id)}
                  >
                    <div className={styles.hotspotItemTop}>
                      <span className={styles.hotspotIdTag}>#{h.hotspot_id}</span>
                      <span className={styles.hotspotAreaTag}>{h.area_formatted || '18,450 m²'}</span>
                    </div>
                    <span className={styles.hotspotNameText}>{h.name || 'Industrial Facility'}</span>
                    <div className={styles.hotspotItemFooter}>
                      <span className={styles.hotspotType}>{h.change_type_label || 'New Construction'}</span>
                      <button
                        type="button"
                        className={styles.itemInspectBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectHotspot && onInspectHotspot(h.hotspot_id);
                        }}
                      >
                        Inspect Zoom →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* 5. AI Change Narrative Card */}
        <AIInsightCard
          location={location}
          selectedTier={selectedTier}
          hotspots={hotspots}
          isStable={isStable}
        />
      </div>
    </aside>
  );
}

export default MetricsPanel;
