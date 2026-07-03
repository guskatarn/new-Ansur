import React, { useEffect, useState } from 'react';
import type { ElementResult, ElementResultStatus, HistoryEntry, TestTemplate } from '../../domain/types.js';
import type { DraftResult } from '../runnerTypes.js';
import { generateReportHtml } from '../utils/reportHtml.js';

interface Props {
  entry: HistoryEntry;
  onBack: () => void;
}

function toDraft(r: ElementResult): DraftResult {
  return {
    status: r.status,
    measuredValue: r.measuredValue !== undefined ? String(r.measuredValue) : '',
    note: r.note ?? '',
  };
}

export function HistoryDetailView({ entry, onBack }: Props): React.ReactElement {
  const [template, setTemplate] = useState<TestTemplate | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.ansurAPI.templates.get(entry.templateId, entry.templateVersion)
      .then((t) => { if (!cancelled) setTemplate(t ?? null); })
      .catch(() => { /* template supprimé — on affiche sans labels */ });
    return () => { cancelled = true; };
  }, [entry.templateId, entry.templateVersion]);

  const handleGeneratePdf = async (): Promise<void> => {
    if (template === null) return;
    setPdfGenerating(true);
    setPdfMessage(null);
    try {
      const html = generateReportHtml({
        template,
        dut: entry.dut,
        executedBy: entry.executedBy,
        executedAt: entry.executedAt,
        draftResults: entry.results.map(toDraft),
        overallStatus: entry.overallStatus,
        recordId: entry.recordId,
      });
      const result = await window.ansurAPI.report.savePdfDialog(html);
      if ('canceled' in result) {
        // annulé — pas de message
      } else if (result.success) {
        setPdfMessage({ text: `PDF enregistré : ${result.path}`, isError: false });
      } else {
        setPdfMessage({ text: result.error, isError: true });
      }
    } catch (err) {
      setPdfMessage({ text: `Erreur PDF : ${String(err)}`, isError: true });
    } finally {
      setPdfGenerating(false);
    }
  };

  const overall = entry.overallStatus;

  return (
    <div style={styles.container}>
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <div style={styles.topBar}>
        <button type="button" onClick={onBack} style={styles.btnBack}>← Historique</button>
        <span style={styles.title}>Détail du record</span>
        <button
          type="button"
          onClick={() => { void handleGeneratePdf(); }}
          disabled={pdfGenerating || template === null}
          style={pdfGenerating || template === null ? styles.btnPdfDisabled : styles.btnPdf}
          title={template === null ? 'Template introuvable — PDF indisponible' : 'Exporter en PDF'}
        >
          {pdfGenerating ? 'Génération…' : '⬇ Rapport PDF'}
        </button>
      </div>

      <div style={styles.body}>
        {/* ── Statut global ───────────────────────────────────────────── */}
        <div style={overall === 'pass' ? styles.overallPass : overall === 'fail' ? styles.overallFail : styles.overallSkip}>
          {overall === 'pass' && '✓ PASS'}
          {overall === 'fail' && '✗ FAIL'}
          {overall === 'skipped' && '— IGNORÉ'}
        </div>

        {/* ── Message PDF ─────────────────────────────────────────────── */}
        {pdfMessage !== null && (
          <div role={pdfMessage.isError ? 'alert' : 'status'}
            style={pdfMessage.isError ? styles.msgError : styles.msgSuccess}>
            {pdfMessage.text}
          </div>
        )}

        {/* ── Infos ───────────────────────────────────────────────────── */}
        <div style={styles.infoGrid}>
          <InfoRow label="N° de série" value={entry.dut.serialNumber} />
          <InfoRow label="Modèle" value={entry.dut.model} />
          {entry.dut.location !== undefined && <InfoRow label="Lieu" value={entry.dut.location} />}
          <InfoRow label="Technicien" value={entry.executedBy} />
          <InfoRow label="Date" value={formatDate(entry.executedAt)} />
          <InfoRow label="Template ID" value={`${entry.templateId.slice(0, 8)}… v${entry.templateVersion}`} />
          <InfoRow label="Record ID" value={entry.recordId.slice(0, 8) + '…'} />
        </div>

        {/* ── Résultats ───────────────────────────────────────────────── */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>#</th>
                <th style={styles.th}>ID</th>
                {template !== null && <th style={styles.th}>Libellé</th>}
                <th style={styles.th}>Statut</th>
                <th style={styles.th}>Valeur</th>
                <th style={styles.th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {entry.results.map((r, i) => {
                const el = template?.elements[i];
                return (
                  <tr key={r.elementId} style={r.status === 'fail' ? styles.trFail : styles.tr}>
                    <td style={styles.tdNum}>{i + 1}</td>
                    <td style={styles.tdId}>{r.elementId}</td>
                    {template !== null && (
                      <td style={styles.td}>{el?.label ?? '—'}</td>
                    )}
                    <td style={styles.td}><StatusBadge status={r.status} /></td>
                    <td style={styles.td}>
                      {r.measuredValue !== undefined ? String(r.measuredValue) : '—'}
                    </td>
                    <td style={styles.td}>{r.note ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '13px' }}>
      <span style={{ color: '#6c757d', minWidth: '110px' }}>{label}</span>
      <span style={{ color: '#212529' }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: ElementResultStatus }): React.ReactElement {
  const map: Record<ElementResultStatus, { label: string; color: string; bg: string }> = {
    pass: { label: '✓ Conforme', color: '#0a3622', bg: '#d1e7dd' },
    fail: { label: '✗ Non conforme', color: '#842029', bg: '#f8d7da' },
    skipped: { label: 'Ignoré', color: '#664d03', bg: '#fff3cd' },
    'not-applicable': { label: 'N/A', color: '#383d41', bg: '#e2e3e5' },
  };
  const m = map[status];
  return (
    <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: '10px',
      fontSize: '11px', fontWeight: 600, background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  } catch { return iso; }
}

const styles = {
  container: {
    display: 'flex', flexDirection: 'column' as const, height: '100vh',
    fontFamily: 'system-ui, sans-serif', background: '#f0f2f5', overflow: 'hidden',
  },
  topBar: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 20px', background: '#1a1a2e', color: '#fff', flexShrink: 0,
  },
  btnBack: {
    padding: '5px 12px', background: 'transparent', border: '1px solid #495057',
    borderRadius: '4px', color: '#adb5bd', cursor: 'pointer', fontSize: '13px',
  },
  title: { fontSize: '15px', fontWeight: 700 as const, color: '#7eb3f7', flex: 1 },
  btnPdf: {
    padding: '6px 14px', background: '#495057', color: '#fff', border: 'none',
    borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 as const,
  },
  btnPdfDisabled: {
    padding: '6px 14px', background: '#343a40', color: '#6c757d', border: 'none',
    borderRadius: '4px', cursor: 'not-allowed', fontSize: '13px', fontWeight: 500 as const,
  },
  body: { flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' as const, gap: '16px' },
  overallPass: {
    padding: '12px 20px', background: '#198754', color: '#fff', borderRadius: '6px',
    fontSize: '20px', fontWeight: 800 as const, textAlign: 'center' as const,
  },
  overallFail: {
    padding: '12px 20px', background: '#dc3545', color: '#fff', borderRadius: '6px',
    fontSize: '20px', fontWeight: 800 as const, textAlign: 'center' as const,
  },
  overallSkip: {
    padding: '12px 20px', background: '#6c757d', color: '#fff', borderRadius: '6px',
    fontSize: '20px', fontWeight: 800 as const, textAlign: 'center' as const,
  },
  msgSuccess: {
    padding: '8px 12px', background: '#f0fdf4', border: '1px solid #a3cfbb',
    borderRadius: '4px', fontSize: '13px', color: '#0a3622',
  },
  msgError: {
    padding: '8px 12px', background: '#fff5f5', border: '1px solid #f1aeb5',
    borderRadius: '4px', fontSize: '13px', color: '#842029',
  },
  infoGrid: {
    background: '#fff', border: '1px solid #e9ecef', borderRadius: '6px',
    padding: '14px 16px', display: 'flex', flexDirection: 'column' as const, gap: '4px',
  },
  tableWrap: {
    background: '#fff', border: '1px solid #e9ecef', borderRadius: '6px', overflow: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  thead: { position: 'sticky' as const, top: 0, background: '#f8f9fa', zIndex: 1 },
  th: {
    padding: '7px 10px', textAlign: 'left' as const, fontSize: '11px',
    fontWeight: 600 as const, textTransform: 'uppercase' as const,
    letterSpacing: '0.04em', color: '#6c757d', borderBottom: '2px solid #dee2e6',
    whiteSpace: 'nowrap' as const,
  },
  tr: { borderBottom: '1px solid #f0f2f5' },
  trFail: { borderBottom: '1px solid #f0f2f5', background: '#fff5f5' },
  td: { padding: '6px 10px', color: '#212529', verticalAlign: 'top' as const },
  tdNum: { padding: '6px 10px', color: '#adb5bd', fontSize: '11px', textAlign: 'center' as const },
  tdId: {
    padding: '6px 10px', color: '#6c757d', fontFamily: 'monospace',
    fontSize: '11px', verticalAlign: 'top' as const, whiteSpace: 'nowrap' as const,
  },
} as const;
