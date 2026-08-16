import React from 'react';
import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.branding}>
        <h1 className={styles.title}>
          <span className={styles.accentDot} aria-hidden="true" />
          Nagpur EarthWatch
        </h1>
        <span className={styles.subtitle}>
          Urban Change Intelligence — Sentinel-2 (10m resolution)
        </span>
      </div>

      <div className={styles.note}>
        Detects structural alterations <span className={styles.noteHighlight}>≥10m</span>. Sub-10m features require high-res imagery.
      </div>
    </header>
  );
}
