import React, { useState } from 'react';
import type { DutInfo, ElementResult, ElementResultStatus, TestTemplate } from '../../domain/types.js';
import type { DraftResult } from '../runnerTypes.js';
import { generateReportHtml } from '../utils/reportHtml.js';

interface Props {
  template: TestTemplate;
  dut: DutInfo;
  executedBy: string;
  draftResults: DraftResult[];
  onReturnToList: () => void;
}

interface SavedMeta {
  recordId: string;
  executedAt: string;
}

function computeOverallStatus(drafts: DraftResult[]): ElementResultStatus {
  const statuses = drafts.map((r) => r.status ?? 'skipped');
  if (statuses.some((s) => s === 'fail')) return 'fail';
  if (statuses.some((s) => s === 'pass')) return 'pass';
  return 'skipped';
}

function buildElementResults(
  elements: readonly { id: string }[],
  drafts: DraftResult[],
): readonly ElementResult[] {
  return elements.map((el, i) => {
    const draft = drafts[i] ?? { status: null, measuredValue: '', note: '' };
    const status: ElementResultStatus = draft.status ?? 'skipped';
    const result: {
      elementId: string;
      status: ElementResultStatus;
      measuredValue?: number | boolean;
      note?: string;
    } = { elementId: el.id, status };
    const numVal = parseFloat(draft.measuredValue);
    if (!isNaN(numVal)) result.measuredValue = numVal;
    if (draft.note.trim() !== '') result.note = draft.note.trim();
    return result;
  });
}

export function RunSummaryView({
  template,
  dut,
  executedBy,
  draftResults,
  onReturnToList,
}: Props): React.ReactElement {
  const [saving, setSaving] = useState(false);
  const [savedMeta, setSavedMeta] = useState<SavedMeta | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const overallStatus = computeOverallStatus(draftResults);
  const passCount = draftResults.filter((r) => r.status === 'pass').length;
  const failCount = draftResults.filter((r) => r.status === 'fail').length;
  const skipCount = draftResults.filter((r) => (r.status ?? 'skipped') === 'skipped').length;

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setSaveError(null);
    try {
      const results = buildElementResults(template.elements, draftResults);
      const response = await window.ansurAPI.records.saveRun({
        dut,
        executedBy,
        templateId: template.id,
        templateVersion: template.version,
        results,
        overallStatus,
      });
      setSavedMeta({ recordId: response.recordId, executedAt: response.executedAt });
    } catch (err) {
      setSaveError(`Erreur lors de l'enregistrement : ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async (): Promise<void> => {
    if (savedMeta === null) return;
    setPdfGenerating(true);
    setPdfMessage(null);
    try {
      const html = generateReportHtml({
        template,
        dut,
        executedBy,
        executedAt: savedMeta.executedAt,
        draftResults,
        overallStatus,
        recordId: savedMeta.recordId,
      });
      const result = await window.ansurAPI.report.savePdfDialog(html);
      if ('canceled' in result) {
        // L'utilisateur a annulé la boîte de dialogue — pas de message
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

  return (
    <div style={styles.container}>
      {/* ── En-tête ────────────────────────────────────────────────────── */}
      <div style={styles.topBar}>
        <span style={styles.title}>Résumé du test</span>
        <span style={styles.meta}>
          {template.name} · DUT {dut.serialNumber} · {executedBy}
        </span>
      </div>

      <div style={styles.body}>
        {/* ── Statut global ───────────────────────────────────────────── */}
        <div
          style={
            overallStatus === 'pass'
              ? styles.overallPass
              : overallStatus === 'fail'
                ? styles.overallFail
                : styles.overallSkip
          }
        >
          {overallStatus === 'pass' && '✓ PASS'}
          {overallStatus === 'fail' && '✗ FAIL'}
          {overallStatus === 'skipped' && '— IGNORÉ'}
        </div>

        {/* ── Compteurs ───────────────────────────────────────────────── */}
        <div style={styles.counters}>
          <Chip label="Conformes" count={passCount} color="#0a3622" bg="#d1e7dd" />
          <Chip label="Non conformes" count={failCount} color="#842029" bg="#f8d7da" />
          <Chip label="Ignorés" count={skipCount} color="#664d03" bg="#fff3cd" />
        </div>

        {/* ── DUT / info ──────────────────────────────────────────────── */}
        <div style={styles.infoGrid}>
          <InfoRow label="Template" value={`${template.name} v${template.version}`} />
          <InfoRow label="Numéro de série" value={dut.serialNumber} />
          <InfoRow label="Modèle" value={dut.model} />
          {dut.location !== undefined && <InfoRow label="Lieu" value={dut.location} />}
          <InfoRow label="Technicien" value={executedBy} />
        </div>

        {/* ── Tableau des résultats ───────────────────────────────────── */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Libellé</th>
                <th style={styles.th}>Statut</th>
                <th style={styles.th}>Valeur</th>
                <th style={styles.th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {template.elements.map((el, i) => {
                const draft = draftResults[i] ?? { status: null, measuredValue: '', note: '' };
                const status = draft.status ?? 'skipped';
                return (
                  <tr key={el.id} style={styles.tr}>
                    <td style={styles.tdId}>{el.id}</td>
                    <td style={styles.td}>{el.label}</td>
                    <td style={styles.td}>
                      <StatusBadge status={status} />
                    </td>
                    <td style={styles.td}>
                      {draft.measuredValue !== '' ? draft.measuredValue : '—'}
                    </td>
                    <td style={styles.td}>{draft.note !== '' ? draft.note : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        {savedMeta !== null ? (
          <div style={styles.savedSection}>
            <div style={styles.savedBanner}>
              <span>
                Record enregistré
                <span style={styles.recordId}> ({savedMeta.recordId.slice(0, 8)}…)</span>
              </span>
              <div style={styles.savedActions}>
                <button
                  type="button"
                  onClick={() => { void handleGeneratePdf(); }}
                  disabled={pdfGenerating}
                  style={pdfGenerating ? styles.btnPdfDisabled : styles.btnPdf}
                >
                  {pdfGenerating ? 'Génération…' : '⬇ Rapport PDF'}
                </button>
                <button type="button" onClick={onReturnToList} style={styles.btnReturn}>
                  Retour à la liste
                </button>
              </div>
            </div>
            {pdfMessage !== null && (
              <div
                role={pdfMessage.isError ? 'alert' : 'status'}
                style={pdfMessage.isError ? styles.msgError : styles.msgSuccess}
              >
                {pdfMessage.text}
              </div>
            )}
          </div>
        ) : (
          <div style={styles.actionBar}>
            {saveError !== null && (
              <span role="alert" style={styles.saveError}>
                {saveError}
              </span>
            )}
            <button type="button" onClick={onReturnToList} style={styles.btnSecondary}>
              Annuler
            </button>
            <button
              type="button"
              onClick={() => { void handleSave(); }}
              disabled={saving}
              style={saving ? styles.btnSaveDisabled : styles.btnSave}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer le record'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function Chip({
  label,
  count,
  color,
  bg,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
}): React.ReactElement {
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: '12px',
        padding: '4px 12px',
        fontSize: '13px',
        fontWeight: 500,
      }}
    >
      {count} {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '13px' }}>
      <span style={{ color: '#6c757d', minWidth: '130px' }}>{label}</span>
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
    <span
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        borderRadius: '10px',
        fontSize: '11px',
        fontWeight: 600,
        background: m.bg,
        color: m.color,
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    fontFamily: 'system-ui, sans-serif',
    background: '#f0f2f5',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    padding: '12px 24px',
    background: '#1a1a2e',
    color: '#fff',
    flexShrink: 0,
  },
  title: { fontSize: '16px', fontWeight: 700 as const, color: '#7eb3f7' },
  meta: { fontSize: '12px', color: '#adb5bd' },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  overallPass: {
    padding: '16px 24px', background: '#198754', color: '#fff',
    borderRadius: '8px', fontSize: '24px', fontWeight: 800 as const,
    textAlign: 'center' as const, letterSpacing: '0.05em',
  },
  overallFail: {
    padding: '16px 24px', background: '#dc3545', color: '#fff',
    borderRadius: '8px', fontSize: '24px', fontWeight: 800 as const,
    textAlign: 'center' as const, letterSpacing: '0.05em',
  },
  overallSkip: {
    padding: '16px 24px', background: '#6c757d', color: '#fff',
    borderRadius: '8px', fontSize: '24px', fontWeight: 800 as const,
    textAlign: 'center' as const, letterSpacing: '0.05em',
  },
  counters: { display: 'flex', gap: '10px', flexWrap: 'wrap' as const },
  infoGrid: {
    display: 'flex', flexDirection: 'column' as const, gap: '4px',
    background: '#fff', border: '1px solid #e9ecef', borderRadius: '6px', padding: '14px 16px',
  },
  tableWrap: {
    background: '#fff', border: '1px solid #e9ecef', borderRadius: '6px',
    overflow: 'auto', maxHeight: '320px',
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
  td: { padding: '6px 10px', color: '#212529', verticalAlign: 'top' as const },
  tdId: {
    padding: '6px 10px', color: '#6c757d', fontFamily: 'monospace',
    fontSize: '11px', verticalAlign: 'top' as const, whiteSpace: 'nowrap' as const,
  },
  savedSection: { display: 'flex', flexDirection: 'column' as const, gap: '8px' },
  savedBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', background: '#d1e7dd', border: '1px solid #a3cfbb',
    borderRadius: '6px', color: '#0a3622', fontSize: '14px',
    flexWrap: 'wrap' as const, gap: '10px',
  },
  savedActions: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const },
  recordId: { fontFamily: 'monospace', fontSize: '12px', color: '#0a5c2e' },
  msgSuccess: {
    padding: '8px 12px', background: '#f0fdf4', border: '1px solid #a3cfbb',
    borderRadius: '4px', fontSize: '13px', color: '#0a3622',
  },
  msgError: {
    padding: '8px 12px', background: '#fff5f5', border: '1px solid #f1aeb5',
    borderRadius: '4px', fontSize: '13px', color: '#842029',
  },
  actionBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: '12px', flexWrap: 'wrap' as const,
  },
  saveError: { fontSize: '13px', color: '#842029', flex: 1 },
  btnSecondary: {
    padding: '8px 18px', background: 'transparent', border: '1px solid #adb5bd',
    borderRadius: '4px', cursor: 'pointer', fontSize: '14px', color: '#495057',
  },
  btnSave: {
    padding: '9px 22px', background: '#0056b3', color: '#fff', border: 'none',
    borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 as const,
  },
  btnSaveDisabled: {
    padding: '9px 22px', background: '#e9ecef', color: '#adb5bd',
    border: '1px solid #dee2e6', borderRadius: '5px', cursor: 'not-allowed',
    fontSize: '14px', fontWeight: 600 as const,
  },
  btnPdf: {
    padding: '7px 16px', background: '#495057', color: '#fff', border: 'none',
    borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 as const,
  },
  btnPdfDisabled: {
    padding: '7px 16px', background: '#e9ecef', color: '#adb5bd',
    border: '1px solid #dee2e6', borderRadius: '4px', cursor: 'not-allowed',
    fontSize: '13px', fontWeight: 500 as const,
  },
  btnReturn: {
    padding: '7px 16px', background: '#198754', color: '#fff', border: 'none',
    borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 as const,
  },
} as const;
