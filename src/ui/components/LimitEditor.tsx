import React, { useEffect, useState } from 'react';
import type { Limit, NumericLimit } from '../../domain/types.js';

interface Props {
  limit: Limit | undefined;
  onChange: (limit: Limit | undefined) => void;
}

export function LimitEditor({ limit, onChange }: Props): React.ReactElement {
  const numeric = limit?.kind === 'numeric' ? limit : undefined;

  const [unit, setUnit] = useState(numeric?.unit ?? '');
  const [minStr, setMinStr] = useState(numeric?.min !== undefined ? String(numeric.min) : '');
  const [maxStr, setMaxStr] = useState(numeric?.max !== undefined ? String(numeric.max) : '');

  useEffect(() => {
    const n = limit?.kind === 'numeric' ? limit : undefined;
    setUnit(n?.unit ?? '');
    setMinStr(n?.min !== undefined ? String(n.min) : '');
    setMaxStr(n?.max !== undefined ? String(n.max) : '');
  }, [limit]);

  if (limit?.kind === 'boolean') {
    return (
      <span style={{ color: '#6c757d', fontSize: '12px' }}>
        Booléen ({limit.expected ? 'vrai' : 'faux'})
      </span>
    );
  }

  const commit = (u: string, mn: string, mx: string): void => {
    if (u.trim() === '' && mn.trim() === '' && mx.trim() === '') {
      onChange(undefined);
      return;
    }
    const result: { kind: 'numeric'; unit: string; min?: number; max?: number } = {
      kind: 'numeric',
      unit: u.trim(),
    };
    const minVal = parseFloat(mn);
    if (!isNaN(minVal)) result.min = minVal;
    const maxVal = parseFloat(mx);
    if (!isNaN(maxVal)) result.max = maxVal;
    onChange(result as NumericLimit);
  };

  return (
    <div style={styles.row}>
      <label style={styles.label}>Min</label>
      <input
        type="number"
        step="any"
        value={minStr}
        onChange={(e) => { setMinStr(e.target.value); }}
        onBlur={(e) => { commit(unit, e.target.value, maxStr); }}
        style={styles.numInput}
        aria-label="Minimum"
      />
      <label style={styles.label}>Max</label>
      <input
        type="number"
        step="any"
        value={maxStr}
        onChange={(e) => { setMaxStr(e.target.value); }}
        onBlur={(e) => { commit(unit, minStr, e.target.value); }}
        style={styles.numInput}
        aria-label="Maximum"
      />
      <label style={styles.label}>Unité</label>
      <input
        type="text"
        value={unit}
        onChange={(e) => { setUnit(e.target.value); }}
        onBlur={(e) => { commit(e.target.value, minStr, maxStr); }}
        style={styles.unitInput}
        aria-label="Unité"
      />
    </div>
  );
}

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap' as const,
  },
  label: {
    fontSize: '11px',
    color: '#6c757d',
    whiteSpace: 'nowrap' as const,
  },
  numInput: {
    width: '72px',
    padding: '2px 4px',
    fontSize: '13px',
    border: '1px solid #ccc',
    borderRadius: '3px',
  },
  unitInput: {
    width: '56px',
    padding: '2px 4px',
    fontSize: '13px',
    border: '1px solid #ccc',
    borderRadius: '3px',
  },
} as const;
