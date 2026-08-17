import React from 'react';
import styles from './Header.module.css';

export function Header({
  viewMode = 'officer',
  onToggleViewMode,
  activeTab = 'dashboard',
  onTabSelect,
  onOpenYoloModal,
  onOpenCaseSummary
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        {/* Left Side: Branding + Catchy Navigation Pills */}
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
                  title="Open Executive Case Overview & Priorities Overlay"
                >
                  📊 Case Overview
                </button>
              </div>
            </div>
          </div>

          {/* Catchy Left-Aligned Navigation Tabs */}
          <nav className={styles.catchyNavPills}>
            <button
              type="button"
              className={`${styles.navPill} ${activeTab === 'dashboard' ? styles.navPillActive : ''}`}
              onClick={() => onTabSelect && onTabSelect('dashboard')}
            >
              <span className={styles.tabIcon}>📊</span>
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              className={`${styles.navPill} ${activeTab === 'areas' ? styles.navPillActive : ''}`}
              onClick={() => onTabSelect && onTabSelect('areas')}
            >
              <span className={styles.tabIcon}>🎯</span>
              <span>Areas to Review</span>
            </button>

            <button
              type="button"
              className={`${styles.navPill} ${activeTab === 'cases' ? styles.navPillActive : ''}`}
              onClick={() => onTabSelect && onTabSelect('cases')}
            >
              <span className={styles.tabIcon}>📂</span>
              <span>Inspection Cases</span>
            </button>

            <button
              type="button"
              className={`${styles.navPill} ${activeTab === 'map' ? styles.navPillActive : ''}`}
              onClick={() => onTabSelect && onTabSelect('map')}
            >
              <span className={styles.tabIcon}>🗺️</span>
              <span>Interactive Map</span>
            </button>
          </nav>
        </div>

        {/* Right Side: Mode Switcher & Action Triggers */}
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
