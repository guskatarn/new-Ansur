import React, { useEffect, useState } from 'react';
import type { AuditEntry } from '../../domain/types.js';

interface Props {
  onBack: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  'test-record-created': 'Record de test créé',
  'template-imported': 'Template importé',
  'template-created': 'Template créé',
  'template-deleted': 'Template supprimé',
  'template-duplicated': 'Template dupliqué',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

function formatDetails(details: unknown): string {
  if (details === undefined || details === null) return '—';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

export function AuditLogView({ onBack }: Props): React.ReactElement {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.ansurAPI.audit.list()
      .then((list) => { if (!cancelled) { setEntries(list); setLoading(false); } })
      .catch((err: unknown) => { if (!cancelled) { setError(String(err)); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <button type="button" onClick={onBack} style={styles.btnBack}>← Retour</button>
        <span style={styles.title}>Journal d'audit</span>
        <span style={styles.count}>
          {!loading && error === null ? `${entries.length} entrée(s)` : ''}
        </span>
      </div>

      <div style={styles.body}>
        {loading ? (
          <p style={styles.hint}>Chargement…</p>
        ) : error !== null ? (
          <p role="alert" style={styles.errorText}>{error}</p>
        ) : entries.length === 0 ? (
          <p style={styles.hint}>
            Aucune entrée. Le journal se remplit après les premières exécutions de tests.
          </p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Date / Heure</th>
                  <th style={styles.th}>Action</th>
                  <th style={styles.th}>Acteur</th>
                  <th style={styles.thDetails}>Détails</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={styles.tdMono}>{formatDate(e.occurredAt)}</td>
                    <td style={styles.td}>
                      <ActionBadge action={e.action} />
                    </td>
                    <td style={styles.td}>{e.actor}</td>
                    <td style={styles.tdDetails}>{formatDetails(e.details)}</td>
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

function ActionBadge({ action }: { action: string }): React.ReactElement {
  const label = actionLabel(action);
  const isKnown = action in ACTION_LABELS;
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 600,
      background: isKnown ? '#dbeafe' : '#f3f4f6',
      color: isKnown ? '#1d4ed8' : '#374151',
      whiteSpace: 'nowrap' as const,
    }}>
      {label}
    </span>
  );
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
  thDetails: {
    padding: '8px 12px', textAlign: 'left' as const, fontSize: '11px',
    fontWeight: 600 as const, textTransform: 'uppercase' as const,
    letterSpacing: '0.04em', color: '#6c757d', borderBottom: '2px solid #dee2e6',
    width: '40%',
  },
  tr: { borderBottom: '1px solid #f0f2f5' },
  td: { padding: '8px 12px', color: '#212529', verticalAlign: 'top' as const },
  tdMono: {
    padding: '8px 12px', color: '#495057', fontFamily: 'monospace',
    fontSize: '12px', verticalAlign: 'top' as const, whiteSpace: 'nowrap' as const,
  },
  tdDetails: {
    padding: '8px 12px', color: '#6c757d', fontFamily: 'monospace',
    fontSize: '11px', verticalAlign: 'top' as const, wordBreak: 'break-all' as const,
  },
} as const;
