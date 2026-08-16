import React from 'react';
import styles from './MetricsPanel.module.css';

export function PermitTable({ permits = [] }) {
  return (
    <table className={styles.permitTable} aria-label="Municipal Building Permit Audit Records">
      <thead>
        <tr>
          <th>Permit Ref</th>
          <th>Sector / Plot</th>
          <th style={{ textAlign: 'right' }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {permits.map((p) => (
          <tr key={p.id}>
            <td className={styles.permitId}>{p.id}</td>
            <td className={styles.permitPlot}>{p.plot}</td>
            <td style={{ textAlign: 'right' }}>
              <span className={`${styles.permitStatus} ${styles[p.status]}`}>
                {p.status === 'matched' ? 'Matched' : 'No Record'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
