import React, { useState } from 'react';
import type { NumericLimit, TestElement } from '../../domain/types.js';
import type { DraftResult } from '../runnerTypes.js';

interface Props {
  element: TestElement;
  result: DraftResult;
  onChange: (updated: DraftResult) => void;
}

export function ElementRunnerCard({ element, result, onChange }: Props): React.ReactElement {
  const [measuring, setMeasuring] = useState(false);
  const [measureMessage, setMeasureMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleAutoMeasure = async (): Promise<void> => {
    const commandId = element.instrumentCommandId;
    if (commandId === undefined) return;
    setMeasuring(true);
    setMeasureMessage(null);
    const outcome = await window.ansurAPI.instruments.runMeasurement(commandId);
    setMeasuring(false);

    if (!outcome.success) {
      setMeasureMessage({ text: outcome.error, isError: true });
      return;
    }

    if (typeof outcome.value === 'number') {
      const limit = element.limit;
      const hasRange = limit?.kind === 'numeric' && (limit.min !== undefined || limit.max !== undefined);
      const newStatus = hasRange ? evaluateAgainstLimit(outcome.value, limit as NumericLimit) : result.status;
      onChange({ ...result, measuredValue: String(outcome.value), status: newStatus });
      setMeasureMessage({
        text: `Mesure automatique : ${outcome.value}${outcome.unit !== null ? ` ${outcome.unit}` : ''}`,
        isError: false,
      });
    } else {
      // Valeur composite (ex. CSV multi-champs) : pas d'auto-remplissage
      // numérique possible, décision manuelle requise par l'opérateur.
      setMeasureMessage({
        text: `Réponse de l'instrument (décision manuelle requise) : ${String(outcome.value)}`,
        isError: false,
      });
    }
  };

  return (
    <div style={styles.card}>
      {/* ── En-tête élément ─────────────────────────────────────────────── */}
      <div style={styles.cardHeader}>
        <div style={styles.labelRow}>
          <span style={styles.elementLabel}>{element.label}</span>
          <span style={kindBadgeStyle(element.kind)}>{kindLabel(element.kind)}</span>
        </div>
        <span style={styles.elementId}>{element.id}</span>
      </div>

      {/* ── Info limite ─────────────────────────────────────────────────── */}
      {element.limit !== undefined && (
        <div style={styles.limitInfo}>
          {formatLimitInfo(element.limit)}
        </div>
      )}

      {/* ── Instructions ────────────────────────────────────────────────── */}
      {element.instructions !== undefined && (
        <div style={styles.instructions}>
          <strong style={styles.instrLabel}>Instructions :</strong>
          <p style={styles.instrText}>{element.instructions}</p>
        </div>
      )}

      {/* ── Mesure automatique ───────────────────────────────────────────── */}
      {element.instrumentCommandId !== undefined && (
        <div style={styles.autoMeasureRow}>
          <button
            type="button"
            onClick={() => { void handleAutoMeasure(); }}
            disabled={measuring}
            style={measuring ? styles.btnAutoMeasureDisabled : styles.btnAutoMeasure}
          >
            {measuring ? 'Mesure en cours…' : '⚡ Mesurer automatiquement'}
          </button>
          {measureMessage !== null && (
            <span
              role={measureMessage.isError ? 'alert' : 'status'}
              style={measureMessage.isError ? styles.autoMeasureError : styles.autoMeasureInfo}
            >
              {measureMessage.text}
            </span>
          )}
        </div>
      )}

      {/* ── Zone de saisie ──────────────────────────────────────────────── */}
      <div style={styles.inputZone}>
        {renderInputZone(element, result, onChange)}
      </div>

      {/* ── Note ────────────────────────────────────────────────────────── */}
      <div style={styles.noteArea}>
        <label style={styles.noteLabel} htmlFor={`note-${element.id}`}>
          Note (optionnel)
        </label>
        <textarea
          id={`note-${element.id}`}
          value={result.note}
          onChange={(e) => { onChange({ ...result, note: e.target.value }); }}
          rows={2}
          style={styles.noteTextarea}
          placeholder="Remarques, observations…"
        />
      </div>
    </div>
  );
}

// ─── Logique de saisie ────────────────────────────────────────────────────────

function evaluateAgainstLimit(value: number, limit: NumericLimit): 'pass' | 'fail' {
  if (limit.min !== undefined && value < limit.min) return 'fail';
  if (limit.max !== undefined && value > limit.max) return 'fail';
  return 'pass';
}

function renderInputZone(
  element: TestElement,
  result: DraftResult,
  onChange: (r: DraftResult) => void,
): React.ReactElement {
  const limit = element.limit;

  // ── Mesure numérique avec plage de tolérance → saisie + calcul auto ──
  if (element.kind === 'measurement' && limit?.kind === 'numeric') {
    const numLimit = limit;
    const hasRange = numLimit.min !== undefined || numLimit.max !== undefined;
    const numVal = parseFloat(result.measuredValue);
    const autoStatus: 'pass' | 'fail' | null =
      hasRange && !isNaN(numVal)
        ? evaluateAgainstLimit(numVal, numLimit)
        : null;

    const handleValueChange = (v: string): void => {
      const parsed = parseFloat(v);
      const newStatus =
        hasRange && !isNaN(parsed)
          ? evaluateAgainstLimit(parsed, numLimit)
          : result.status;
      onChange({ ...result, measuredValue: v, status: hasRange ? newStatus : result.status });
    };

    return (
      <div>
        <div style={inputStyles.valueRow}>
          <label style={inputStyles.valueLabel}>Valeur mesurée</label>
          <div style={inputStyles.inputGroup}>
            <input
              type="number"
              step="any"
              value={result.measuredValue}
              onChange={(e) => { handleValueChange(e.target.value); }}
              style={inputStyles.numericInput}
              autoFocus
              aria-label="Valeur mesurée"
            />
            {numLimit.unit !== '' && (
              <span style={inputStyles.unit}>{numLimit.unit}</span>
            )}
          </div>
        </div>

        {hasRange ? (
          <div style={inputStyles.autoResult}>
            {result.measuredValue === '' ? (
              <span style={inputStyles.hint}>Entrez une valeur pour calculer le résultat.</span>
            ) : autoStatus === 'pass' ? (
              <div style={inputStyles.statusRow}>
                <span style={inputStyles.passChip}>✓ CONFORME</span>
                <button
                  type="button"
                  onClick={() => { onChange({ ...result, status: 'fail' }); }}
                  style={result.status === 'fail' ? inputStyles.overrideActive : inputStyles.overrideBtn}
                >
                  Forcer FAIL
                </button>
              </div>
            ) : (
              <div style={inputStyles.statusRow}>
                <span style={inputStyles.failChip}>✗ NON CONFORME</span>
                <button
                  type="button"
                  onClick={() => { onChange({ ...result, status: 'pass' }); }}
                  style={result.status === 'pass' ? inputStyles.overrideActive : inputStyles.overrideBtn}
                >
                  Forcer PASS
                </button>
              </div>
            )}
          </div>
        ) : (
          // Unité seule, pas de plage → boutons manuels + champ valeur
          <div style={inputStyles.btnGroup}>
            <span style={inputStyles.hint}>Pas de limite définie — décision manuelle :</span>
            {renderPassFailButtons(result, onChange, 'Conforme', 'Non conforme')}
          </div>
        )}
      </div>
    );
  }

  // ── Étape manuelle ────────────────────────────────────────────────────
  if (element.kind === 'manual-step') {
    return renderPassFailButtons(result, onChange, 'Étape effectuée', 'Étape non effectuée');
  }

  // ── Contrôle visuel ou mesure sans limite numérique ───────────────────
  return renderPassFailButtons(result, onChange, 'Conforme', 'Non conforme');
}

function renderPassFailButtons(
  result: DraftResult,
  onChange: (r: DraftResult) => void,
  passLabel: string,
  failLabel: string,
): React.ReactElement {
  const toggle = (s: 'pass' | 'fail') => {
    onChange({ ...result, status: result.status === s ? null : s });
  };

  return (
    <div style={inputStyles.btnGroup}>
      <button
        type="button"
        onClick={() => { toggle('pass'); }}
        style={result.status === 'pass' ? inputStyles.btnPassActive : inputStyles.btnPass}
      >
        ✓ {passLabel}
      </button>
      <button
        type="button"
        onClick={() => { toggle('fail'); }}
        style={result.status === 'fail' ? inputStyles.btnFailActive : inputStyles.btnFail}
      >
        ✗ {failLabel}
      </button>
    </div>
  );
}

// ─── Helpers d'affichage ──────────────────────────────────────────────────────

function kindLabel(kind: TestElement['kind']): string {
  switch (kind) {
    case 'measurement': return 'Mesure';
    case 'manual-step': return 'Étape';
    case 'visual-checklist': return 'Visuel';
  }
}

function kindBadgeStyle(kind: TestElement['kind']): React.CSSProperties {
  const map = {
    measurement: { background: '#cfe2ff', color: '#084298' },
    'manual-step': { background: '#d1e7dd', color: '#0a3622' },
    'visual-checklist': { background: '#fff3cd', color: '#664d03' },
  } as const;
  return {
    ...map[kind],
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 500,
    flexShrink: 0,
  };
}

function formatLimitInfo(limit: NonNullable<TestElement['limit']>): string {
  if (limit.kind === 'boolean') return `Attendu : ${limit.expected ? 'Vrai' : 'Faux'}`;
  const parts: string[] = [];
  if (limit.min !== undefined) parts.push(`min ${limit.min}`);
  if (limit.max !== undefined) parts.push(`max ${limit.max}`);
  const range = parts.length > 0 ? parts.join(' / ') : 'sans plage';
  return `Limite : ${range} ${limit.unit}`.trim();
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  card: {
    background: '#fff',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    padding: '28px 32px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '18px',
    maxWidth: '640px',
    margin: '0 auto',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  labelRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    flexWrap: 'wrap' as const,
  },
  elementLabel: {
    fontSize: '18px',
    fontWeight: 600 as const,
    color: '#212529',
    flex: 1,
    lineHeight: '1.3',
  },
  elementId: {
    fontSize: '12px',
    color: '#adb5bd',
    fontFamily: 'monospace',
  },
  limitInfo: {
    fontSize: '13px',
    color: '#495057',
    background: '#f8f9fa',
    border: '1px solid #e9ecef',
    borderRadius: '4px',
    padding: '6px 10px',
    fontFamily: 'monospace',
  },
  instructions: {
    borderLeft: '3px solid #0056b3',
    paddingLeft: '12px',
  },
  instrLabel: {
    fontSize: '12px',
    color: '#6c757d',
    display: 'block',
    marginBottom: '4px',
  },
  instrText: {
    margin: 0,
    fontSize: '14px',
    color: '#212529',
    whiteSpace: 'pre-wrap' as const,
    lineHeight: '1.5',
  },
  autoMeasureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  btnAutoMeasure: {
    padding: '7px 16px',
    background: '#0056b3',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600 as const,
  },
  btnAutoMeasureDisabled: {
    padding: '7px 16px',
    background: '#e9ecef',
    color: '#adb5bd',
    border: 'none',
    borderRadius: '5px',
    cursor: 'not-allowed',
    fontSize: '13px',
    fontWeight: 600 as const,
  },
  autoMeasureInfo: {
    fontSize: '12px',
    color: '#0a3622',
  },
  autoMeasureError: {
    fontSize: '12px',
    color: '#842029',
  },
  inputZone: {
    borderTop: '1px solid #e9ecef',
    paddingTop: '18px',
  },
  noteArea: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  noteLabel: {
    fontSize: '12px',
    color: '#6c757d',
  },
  noteTextarea: {
    padding: '6px 8px',
    fontSize: '13px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    color: '#212529',
  },
} as const;

const inputStyles = {
  valueRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    marginBottom: '12px',
  },
  valueLabel: {
    fontSize: '13px',
    color: '#495057',
    fontWeight: 500 as const,
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  numericInput: {
    padding: '10px 12px',
    fontSize: '22px',
    fontWeight: 600 as const,
    border: '2px solid #0056b3',
    borderRadius: '6px',
    width: '180px',
    textAlign: 'right' as const,
    color: '#212529',
  },
  unit: {
    fontSize: '18px',
    color: '#495057',
    fontWeight: 500 as const,
  },
  autoResult: {
    minHeight: '36px',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  passChip: {
    display: 'inline-block',
    padding: '5px 14px',
    background: '#d1e7dd',
    color: '#0a3622',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 700 as const,
  },
  failChip: {
    display: 'inline-block',
    padding: '5px 14px',
    background: '#f8d7da',
    color: '#842029',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 700 as const,
  },
  overrideBtn: {
    padding: '4px 10px',
    fontSize: '11px',
    background: 'transparent',
    border: '1px solid #adb5bd',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#6c757d',
  },
  overrideActive: {
    padding: '4px 10px',
    fontSize: '11px',
    background: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#000',
    fontWeight: 600 as const,
  },
  hint: {
    fontSize: '13px',
    color: '#6c757d',
  },
  btnGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  btnPass: {
    padding: '10px 24px',
    fontSize: '15px',
    background: '#f8f9fa',
    color: '#212529',
    border: '2px solid #198754',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500 as const,
  },
  btnPassActive: {
    padding: '10px 24px',
    fontSize: '15px',
    background: '#198754',
    color: '#fff',
    border: '2px solid #198754',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 700 as const,
  },
  btnFail: {
    padding: '10px 24px',
    fontSize: '15px',
    background: '#f8f9fa',
    color: '#212529',
    border: '2px solid #dc3545',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500 as const,
  },
  btnFailActive: {
    padding: '10px 24px',
    fontSize: '15px',
    background: '#dc3545',
    color: '#fff',
    border: '2px solid #dc3545',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 700 as const,
  },
} as const;
