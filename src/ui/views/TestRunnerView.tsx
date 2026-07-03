import React, { useState } from 'react';
import type { DutInfo, TestTemplate } from '../../domain/types.js';
import { ElementRunnerCard } from '../components/ElementRunnerCard.js';
import type { DraftResult } from '../runnerTypes.js';

interface Props {
  template: TestTemplate;
  dut: DutInfo;
  executedBy: string;
  onComplete: (results: DraftResult[]) => void;
  onCancel: () => void;
}

export function TestRunnerView({
  template,
  dut,
  executedBy,
  onComplete,
  onCancel,
}: Props): React.ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftResults, setDraftResults] = useState<DraftResult[]>(
    () => template.elements.map(() => ({ status: null, measuredValue: '', note: '' })),
  );

  const total = template.elements.length;
  const currentElement = template.elements[currentIndex];
  const currentResult = draftResults[currentIndex] ?? { status: null, measuredValue: '', note: '' };
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;
  const canAdvance = currentResult.status !== null;

  const handleChange = (updated: DraftResult): void => {
    setDraftResults((prev) => {
      const next = [...prev];
      next[currentIndex] = updated;
      return next;
    });
  };

  const handlePrev = (): void => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  const advance = (results: DraftResult[]): void => {
    if (isLast) {
      onComplete(results);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleSkip = (): void => {
    const updated = [...draftResults];
    updated[currentIndex] = { ...currentResult, status: 'skipped' };
    setDraftResults(updated);
    advance(updated);
  };

  const handleNext = (): void => {
    advance(draftResults);
  };

  const handleCancel = (): void => {
    const hasAnyInput = draftResults.some(
      (r) => r.status !== null || r.measuredValue !== '' || r.note !== '',
    );
    if (
      !hasAnyInput ||
      window.confirm('Êtes-vous sûr de vouloir annuler ? Les données saisies seront perdues.')
    ) {
      onCancel();
    }
  };

  if (currentElement === undefined) {
    return (
      <div style={styles.empty}>
        <p>Ce template ne contient aucun élément.</p>
        <button type="button" onClick={onCancel} style={styles.btnSecondary}>
          Retour
        </button>
      </div>
    );
  }

  const progressPct = ((currentIndex + 1) / total) * 100;

  return (
    <div style={styles.container}>
      {/* ── Barre de progression ────────────────────────────────────────── */}
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <span style={styles.templateName}>{template.name}</span>
          <span style={styles.dutInfo}>
            DUT : <strong>{dut.serialNumber}</strong>
            {dut.model !== '' && ` — ${dut.model}`}
          </span>
        </div>
        <div style={styles.topBarRight}>
          <span style={styles.techName}>Technicien : {executedBy}</span>
          <button type="button" onClick={handleCancel} style={styles.btnCancel}>
            Annuler
          </button>
        </div>
      </div>

      <div style={styles.progressBarWrap}>
        <div style={{ ...styles.progressBarFill, width: `${progressPct}%` }} />
      </div>
      <div style={styles.progressLabel}>
        Étape <strong>{currentIndex + 1}</strong> / {total}
      </div>

      {/* ── Carte de l'élément courant ──────────────────────────────────── */}
      <div style={styles.cardArea}>
        <ElementRunnerCard
          key={currentElement.id}
          element={currentElement}
          result={currentResult}
          onChange={handleChange}
        />
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <div style={styles.navBar}>
        <button
          type="button"
          onClick={handlePrev}
          disabled={isFirst}
          style={isFirst ? styles.btnNavDisabled : styles.btnNav}
        >
          ← Précédent
        </button>

        <button type="button" onClick={handleSkip} style={styles.btnSkip}>
          Ignorer
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!canAdvance}
          style={canAdvance ? styles.btnNavPrimary : styles.btnNavDisabled}
        >
          {isLast ? 'Terminer ✓' : 'Suivant →'}
        </button>
      </div>
    </div>
  );
}

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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    background: '#1a1a2e',
    color: '#fff',
    flexShrink: 0,
    gap: '12px',
  },
  topBarLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexShrink: 0,
  },
  templateName: {
    fontSize: '14px',
    fontWeight: 600 as const,
    color: '#7eb3f7',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dutInfo: {
    fontSize: '12px',
    color: '#adb5bd',
  },
  techName: {
    fontSize: '12px',
    color: '#adb5bd',
  },
  btnCancel: {
    padding: '5px 12px',
    background: 'transparent',
    border: '1px solid #6c757d',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#adb5bd',
  },
  progressBarWrap: {
    height: '4px',
    background: '#dee2e6',
    flexShrink: 0,
  },
  progressBarFill: {
    height: '100%',
    background: '#0056b3',
    transition: 'width 0.25s ease',
  },
  progressLabel: {
    textAlign: 'center' as const,
    fontSize: '12px',
    color: '#6c757d',
    padding: '4px 0',
    background: '#f8f9fa',
    borderBottom: '1px solid #e9ecef',
    flexShrink: 0,
  },
  cardArea: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '32px 20px',
  },
  navBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '16px 20px',
    background: '#fff',
    borderTop: '1px solid #dee2e6',
    flexShrink: 0,
  },
  btnNav: {
    padding: '9px 22px',
    background: '#f8f9fa',
    color: '#212529',
    border: '1px solid #ced4da',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  btnNavDisabled: {
    padding: '9px 22px',
    background: '#e9ecef',
    color: '#adb5bd',
    border: '1px solid #e9ecef',
    borderRadius: '5px',
    cursor: 'not-allowed',
    fontSize: '14px',
  },
  btnNavPrimary: {
    padding: '9px 26px',
    background: '#0056b3',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600 as const,
  },
  btnSkip: {
    padding: '9px 18px',
    background: 'transparent',
    color: '#6c757d',
    border: '1px dashed #adb5bd',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '16px',
    fontFamily: 'system-ui, sans-serif',
  },
  btnSecondary: {
    padding: '8px 18px',
    background: '#f8f9fa',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
} as const;
