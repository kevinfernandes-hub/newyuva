import React from 'react';
import styles from './Header.module.css';

export function Header({
  viewMode = 'officer',
  onToggleViewMode,
  onOpenCaseSummary
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        {/* Left Side: Branding + Executive Case Overview Button */}
        <div className={styles.headerLeft}>
          <div className={styles.branding}>
            <div className={styles.emblemBadge}>
              <span className={styles.emblemText}>NMC</span>
            </div>
            <div className={styles.titleColumn}>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>NMC EARTHWATCH</h1>
                <span className={styles.portalTag}>TOWN PLANNING</span>
                <button
                  type="button"
                  className={styles.caseSummaryBtn}
                  onClick={onOpenCaseSummary}
                  title="Open Executive Case Overview & Priorities Hub"
                >
                  📊 Case Overview
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Mode Switcher & Portal Active Badge */}
        <div className={styles.headerRight}>
          {viewMode === 'analyst' && (
            <div className={styles.analystBadge}>
              🔬 Analyst Mode
            </div>
          )}

          {/* Mode Switcher: Officer View (Default) vs Analyst View */}
          <div className={styles.viewToggleContainer} title="Toggle User View Mode">
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === 'officer' ? styles.activeOfficer : ''}`}
              onClick={() => onToggleViewMode && onToggleViewMode('officer')}
            >
              🏛 Officer View
            </button>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === 'analyst' ? styles.activeAnalyst : ''}`}
              onClick={() => onToggleViewMode && onToggleViewMode('analyst')}
            >
              🔬 Analyst View
            </button>
          </div>

          <div className={styles.wardStatus}>
            <span className={styles.liveIndicator} />
            <span className={styles.statusText}>PORTAL ACTIVE</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
