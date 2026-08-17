import React from 'react';
import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.branding}>
        <div className={styles.emblemBadge}>
          <span className={styles.emblemText}>NMC</span>
        </div>
        <div className={styles.titleColumn}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>NAGPUR EARTHWATCH</h1>
            <span className={styles.portalTag}>AGENTIC URBAN INTELLIGENCE</span>
          </div>
          <span className={styles.subtitle}>
            Autonomous Multi-Resolution Surveillance: Sentinel-2 (10m) ⇄ Wayback (~0.6m) ⇄ AI Vision Inspection
          </span>
        </div>
      </div>

      <div className={styles.headerRight}>
        <div className={styles.workflowPill}>
          <span className={styles.workflowText}>SEARCH → SCAN → REASON → ZOOM → VERIFY → REPORT</span>
        </div>
        <div className={styles.wardStatus}>
          <span className={styles.liveIndicator} />
          <span className={styles.statusText}>AGENT READY</span>
        </div>
      </div>
    </header>
  );
}

export default Header;
