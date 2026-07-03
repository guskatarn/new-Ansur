import React, { useEffect, useState } from 'react';
import type { ElementResultStatus, HistoryEntry } from '../../domain/types.js';

interface Props {
  onSelect: (entry: HistoryEntry) => void;
  onBack: () => void;
}

export function HistoryListView({ onSelect, onBack }: Props): React.ReactElement {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.ansurAPI.records.list().then((list) => {
      if (!cancelled) { setEntries(list); setLoading(false); }
    }).catch((err: unknown) => {
      if (!cancelled) { setError(String(err)); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <button type="button" onClick={onBack} style={styles.btnBack}>← Retour</button>
        <span style={styles.title}>Historique des tests</span>
        <span style={styles.count}>
          {loading ? '' : `${entries.length} record(s)`}
        </span>
      </div>

      <div style={styles.body}>
        {loading ? (
          <p style={styles.hint}>Chargement…</p>
        ) : error !== null ? (
          <p role="alert" style={styles.errorText}>{error}</p>
        ) : entries.length === 0 ? (
          <p style={styles.hint}>Aucun test enregistré.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Date d'exécution</th>
                  <th style={styles.th}>N° de série</th>
                  <th style={styles.th}>Modèle</th>
                  <th style={styles.th}>Template</th>
                  <th style={styles.th}>Technicien</th>
                  <th style={styles.th}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.recordId}
                    style={styles.tr}
                    onClick={() => { onSelect(e); }}
                    title="Voir le détail"
                  >
                    <td style={styles.td}>{formatDate(e.executedAt)}</td>
                    <td style={styles.tdMono}>{e.dut.serialNumber}</td>
                    <td style={styles.td}>{e.dut.model}</td>
                    <td style={styles.td}>
                      {e.templateId.slice(0, 8)}… <span style={styles.ver}>v{e.templateVersion}</span>
                    </td>
                    <td style={styles.td}>{e.executedBy}</td>
                    <td style={styles.td}><StatusBadge status={e.overallStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ElementResultStatus }): React.ReactElement {
  const map: Record<ElementResultStatus, { label: string; color: string; bg: string }> = {
    pass: { label: '✓ PASS', color: '#0a3622', bg: '#d1e7dd' },
    fail: { label: '✗ FAIL', color: '#842029', bg: '#f8d7da' },
    skipped: { label: 'Ignoré', color: '#664d03', bg: '#fff3cd' },
    'not-applicable': { label: 'N/A', color: '#383d41', bg: '#e2e3e5' },
  };
  const m = map[status];
  return (
    <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: '10px',
      fontSize: '11px', fontWeight: 600, background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

const styles = {
  container: {
    display: 'flex', flexDirection: 'column' as const, height: '100vh',
    fontFamily: 'system-ui, sans-serif', background: '#f0f2f5', overflow: 'hidden',
  },
  topBar: {
    display: 'flex', alignItems: 'center', gap: '16px',
    padding: '10px 20px', background: '#1a1a2e', color: '#fff', flexShrink: 0,
  },
  btnBack: {
    padding: '5px 12px', background: 'transparent', border: '1px solid #495057',
    borderRadius: '4px', color: '#adb5bd', cursor: 'pointer', fontSize: '13px',
  },
  title: { fontSize: '15px', fontWeight: 700 as const, color: '#7eb3f7', flex: 1 },
  count: { fontSize: '12px', color: '#6c757d' },
  body: { flex: 1, overflow: 'auto', padding: '24px' },
  hint: { color: '#6c757d', fontSize: '14px' },
  errorText: { color: '#dc3545', fontSize: '14px' },
  tableWrap: {
    background: '#fff', border: '1px solid #e9ecef', borderRadius: '6px', overflow: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  thead: { position: 'sticky' as const, top: 0, background: '#f8f9fa', zIndex: 1 },
  th: {
    padding: '8px 12px', textAlign: 'left' as const, fontSize: '11px',
    fontWeight: 600 as const, textTransform: 'uppercase' as const,
    letterSpacing: '0.04em', color: '#6c757d', borderBottom: '2px solid #dee2e6',
    whiteSpace: 'nowrap' as const,
  },
  tr: {
    borderBottom: '1px solid #f0f2f5', cursor: 'pointer' as const,
  },
  td: { padding: '9px 12px', color: '#212529', verticalAlign: 'middle' as const },
  tdMono: {
    padding: '9px 12px', color: '#495057', fontFamily: 'monospace',
    fontSize: '12px', verticalAlign: 'middle' as const,
  },
  ver: { color: '#6c757d', fontSize: '11px' },
} as const;
