import React, { useEffect, useState } from 'react';
import type { TestElement, TestTemplate } from '../../domain/types.js';
import { TestElementRow } from '../components/TestElementRow.js';

interface Props {
  template: TestTemplate;
  onBack: () => void;
  onSaved: (updated: TestTemplate) => void;
  onRun?: (template: TestTemplate) => void;
  onDuplicated?: (copy: TestTemplate) => void;
  onDeleted?: () => void;
}

export function TemplateEditorView({ template, onBack, onSaved, onRun, onDuplicated, onDeleted }: Props): React.ReactElement {
  const [draft, setDraft] = useState<TestTemplate>(template);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setDraft(template);
    setDirty(false);
    setSaveMessage(null);
  }, [template.id]);

  const handleNameChange = (name: string): void => {
    setDraft((prev) => ({ ...prev, name }));
    setDirty(true);
    setSaveMessage(null);
  };

  const handleElementChange = (index: number, changedElement: TestElement): void => {
    setDraft((prev) => ({
      ...prev,
      elements: prev.elements.map((el, i) => (i === index ? changedElement : el)),
    }));
    setDirty(true);
    setSaveMessage(null);
  };

  const handleDuplicate = async (): Promise<void> => {
    setDuplicating(true);
    const result = await window.ansurAPI.templates.duplicate(draft.id);
    setDuplicating(false);
    if (result.success) {
      onDuplicated?.(result.template);
    } else {
      setSaveMessage({ text: `Erreur duplication : ${result.error}`, isError: true });
    }
  };

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    const result = await window.ansurAPI.templates.delete(draft.id);
    setDeleting(false);
    if ('canceled' in result) return;
    if (result.success) {
      onDeleted?.();
    } else {
      setSaveMessage({ text: `Erreur suppression : ${result.error}`, isError: true });
    }
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setSaveMessage(null);
    const toSave: TestTemplate = { ...draft, version: draft.version + 1 };
    try {
      await window.ansurAPI.templates.save(toSave);
      setDraft(toSave);
      setDirty(false);
      setSaveMessage({ text: `Sauvegardé — version ${toSave.version}`, isError: false });
      onSaved(toSave);
    } catch (err) {
      setSaveMessage({ text: `Erreur lors de la sauvegarde : ${String(err)}`, isError: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* ── Barre d'en-tête ─────────────────────────────────────────────── */}
      <div style={styles.topBar}>
        <button type="button" onClick={onBack} style={styles.backBtn}>
          ← Retour
        </button>

        <div style={styles.titleArea}>
          <input
            value={draft.name}
            onChange={(e) => { handleNameChange(e.target.value); }}
            style={styles.nameInput}
            aria-label="Nom du template"
          />
          <span style={styles.versionBadge}>v{draft.version}</span>
          {dirty && <span style={styles.dirtyDot} title="Modifications non sauvegardées" />}
        </div>

        <div style={styles.actions}>
          {saveMessage !== null && (
            <span
              role={saveMessage.isError ? 'alert' : 'status'}
              style={saveMessage.isError ? styles.msgError : styles.msgSuccess}
            >
              {saveMessage.text}
            </span>
          )}
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={!dirty || saving}
            style={!dirty || saving ? styles.btnDisabled : styles.btnPrimary}
          >
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
          {onRun !== undefined && (
            <button
              type="button"
              onClick={() => { onRun(draft); }}
              disabled={dirty}
              title={dirty ? 'Sauvegardez d\'abord avant d\'exécuter' : 'Lancer l\'exécution du test'}
              style={dirty ? styles.btnDisabled : styles.btnRun}
            >
              ▶ Exécuter
            </button>
          )}
          {onDuplicated !== undefined && (
            <button
              type="button"
              onClick={() => { void handleDuplicate(); }}
              disabled={duplicating || dirty}
              title={dirty ? 'Sauvegardez avant de dupliquer' : 'Créer une copie de ce template'}
              style={duplicating || dirty ? styles.btnDisabled : styles.btnDuplicate}
            >
              {duplicating ? 'Duplication…' : '⧉ Dupliquer'}
            </button>
          )}
          {onDeleted !== undefined && (
            <button
              type="button"
              onClick={() => { void handleDelete(); }}
              disabled={deleting}
              title="Supprimer définitivement ce template"
              style={deleting ? styles.btnDisabled : styles.btnDelete}
            >
              {deleting ? 'Suppression…' : '🗑 Supprimer'}
            </button>
          )}
        </div>
      </div>

      {/* ── Tableau des éléments ─────────────────────────────────────────── */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <colgroup>
            <col style={{ width: '140px' }} />
            <col style={{ width: '220px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '280px' }} />
            <col />
          </colgroup>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>ID commande</th>
              <th style={styles.th}>Libellé</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Limite (Min / Max / Unité)</th>
              <th style={styles.th}>Instructions</th>
            </tr>
          </thead>
          <tbody>
            {draft.elements.map((element, index) => (
              <TestElementRow
                key={element.id}
                element={element}
                onChange={(updated) => { handleElementChange(index, updated); }}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p style={styles.footer}>
        {draft.elements.length} élément(s) — Les modifications sont sauvegardées dans un nouveau
        fichier de version.
      </p>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    fontFamily: 'system-ui, sans-serif',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    borderBottom: '1px solid #dee2e6',
    background: '#f8f9fa',
    flexShrink: 0,
  },
  backBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid #adb5bd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#495057',
    whiteSpace: 'nowrap' as const,
  },
  titleArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
  },
  nameInput: {
    fontSize: '16px',
    fontWeight: 600 as const,
    border: '1px solid transparent',
    borderRadius: '4px',
    padding: '2px 6px',
    background: 'transparent',
    color: '#212529',
    minWidth: 0,
    flex: 1,
    outline: 'none',
  },
  versionBadge: {
    fontSize: '12px',
    color: '#6c757d',
    background: '#e9ecef',
    borderRadius: '10px',
    padding: '1px 8px',
    flexShrink: 0,
  },
  dirtyDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#fd7e14',
    flexShrink: 0,
    display: 'inline-block',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  msgSuccess: {
    fontSize: '12px',
    color: '#0a3622',
  },
  msgError: {
    fontSize: '12px',
    color: '#842029',
  },
  tableWrapper: {
    flex: 1,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  thead: {
    position: 'sticky' as const,
    top: 0,
    background: '#f8f9fa',
    zIndex: 1,
  },
  th: {
    padding: '8px 8px',
    textAlign: 'left' as const,
    fontSize: '11px',
    fontWeight: 600 as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: '#6c757d',
    borderBottom: '2px solid #dee2e6',
    whiteSpace: 'nowrap' as const,
  },
  footer: {
    fontSize: '12px',
    color: '#adb5bd',
    padding: '6px 16px',
    borderTop: '1px solid #e9ecef',
    margin: 0,
    flexShrink: 0,
  },
  btnPrimary: {
    padding: '7px 16px',
    background: '#0056b3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500 as const,
  },
  btnDisabled: {
    padding: '7px 16px',
    background: '#e9ecef',
    color: '#adb5bd',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    cursor: 'not-allowed',
    fontSize: '13px',
    fontWeight: 500 as const,
  },
  btnRun: {
    padding: '7px 16px',
    background: '#198754',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500 as const,
  },
  btnDuplicate: {
    padding: '7px 14px',
    background: '#6f42c1',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500 as const,
  },
  btnDelete: {
    padding: '7px 14px',
    background: 'transparent',
    color: '#dc3545',
    border: '1px solid #dc3545',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500 as const,
  },
} as const;
