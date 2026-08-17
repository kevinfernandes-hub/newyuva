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
            <h1 className={styles.title}>Nagpur Municipal Corporation</h1>
            <span className={styles.portalTag}>TOWN PLANNING & VIGILANCE</span>
          </div>
          <span className={styles.subtitle}>
            Satellite-Based Urban Development & Land-Use Surveillance System
          </span>
        </div>
      </div>

      <div className={styles.headerRight}>
        <div className={styles.wardStatus}>
          <span className={styles.liveIndicator} />
          <span className={styles.statusText}>PORTAL ACTIVE</span>
        </div>
      </div>
    </header>
  );
}
