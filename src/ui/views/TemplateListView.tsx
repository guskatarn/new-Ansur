import React, { useCallback, useEffect, useState } from 'react';
import type { TestTemplate } from '../../domain/types.js';

interface Props {
  onSelect: (template: TestTemplate) => void;
  onRun?: (template: TestTemplate) => void;
}

export function TemplateListView({ onSelect, onRun }: Props): React.ReactElement {
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await window.ansurAPI.templates.list();
      setTemplates(list);
    } catch (err) {
      setError(`Erreur de chargement : ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleDelete = async (t: TestTemplate): Promise<void> => {
    setDeletingId(t.id);
    setImportMessage(null);
    const result = await window.ansurAPI.templates.delete(t.id);
    setDeletingId(null);
    if ('canceled' in result) return;
    if (result.success) {
      void loadTemplates();
    } else {
      setImportMessage({ text: `Erreur suppression : ${result.error}`, isError: true });
    }
  };

  const handleImport = async (): Promise<void> => {
    setImporting(true);
    setImportMessage(null);
    const result = await window.ansurAPI.templates.importMtt();
    setImporting(false);

    if (result.canceled) return;

    if (result.success) {
      void loadTemplates();
      const warnSuffix =
        result.warnings.length > 0 ? ` (${result.warnings.length} avertissement(s))` : '';
      setImportMessage({
        text: `Import réussi : « ${result.template.name} »${warnSuffix}`,
        isError: false,
      });
    } else {
      setImportMessage({ text: result.error, isError: true });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.heading}>Templates</h2>
        <button
          type="button"
          onClick={() => { void handleImport(); }}
          disabled={importing}
          style={importing ? styles.btnDisabled : styles.btnPrimary}
        >
          {importing ? 'Import en cours…' : 'Importer un fichier .mtt'}
        </button>
      </div>

      {importMessage !== null && (
        <div
          role={importMessage.isError ? 'alert' : 'status'}
          style={importMessage.isError ? styles.msgError : styles.msgSuccess}
        >
          {importMessage.text}
        </div>
      )}

      {loading ? (
        <p style={styles.hint}>Chargement…</p>
      ) : error !== null ? (
        <p role="alert" style={styles.errorText}>
          {error}
        </p>
      ) : templates.length === 0 ? (
        <p style={styles.hint}>
          Aucun template. Cliquez sur <em>Importer un fichier .mtt</em> pour commencer.
        </p>
      ) : (
        <ul style={styles.list}>
          {templates.map((t) => (
            <li key={t.id} style={styles.listItem}>
              <div style={styles.templateRow}>
                <button
                  type="button"
                  onClick={() => { onSelect(t); }}
                  style={styles.templateBtn}
                >
                  <span style={styles.templateName}>{t.name}</span>
                  <span style={styles.templateMeta}>
                    v{t.version} — {t.elements.length} élément(s)
                  </span>
                </button>
                {onRun !== undefined && (
                  <button
                    type="button"
                    onClick={() => { onRun(t); }}
                    style={styles.btnRun}
                    title="Lancer l'exécution du test"
                  >
                    ▶ Exécuter
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { void handleDelete(t); }}
                  disabled={deletingId === t.id}
                  style={deletingId === t.id ? styles.btnDeleteDisabled : styles.btnDelete}
                  title="Supprimer ce template"
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    fontFamily: 'system-ui, sans-serif',
    maxWidth: '800px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  heading: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600 as const,
    color: '#212529',
  },
  hint: {
    color: '#6c757d',
    fontSize: '14px',
  },
  errorText: {
    color: '#dc3545',
    fontSize: '14px',
  },
  msgSuccess: {
    background: '#d1e7dd',
    border: '1px solid #a3cfbb',
    borderRadius: '4px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#0a3622',
    marginBottom: '12px',
  },
  msgError: {
    background: '#f8d7da',
    border: '1px solid #f1aeb5',
    borderRadius: '4px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#842029',
    marginBottom: '12px',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  listItem: {
    margin: 0,
  },
  templateRow: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '8px',
  },
  btnRun: {
    padding: '0 18px',
    background: '#198754',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500 as const,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  templateBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    padding: '12px 16px',
    background: '#fff',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'border-color 0.15s',
  },
  templateName: {
    fontSize: '14px',
    fontWeight: 500 as const,
    color: '#212529',
  },
  templateMeta: {
    fontSize: '12px',
    color: '#6c757d',
  },
  btnDelete: {
    padding: '0 12px',
    background: 'transparent',
    color: '#dc3545',
    border: '1px solid #dc3545',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    flexShrink: 0,
  },
  btnDeleteDisabled: {
    padding: '0 12px',
    background: '#e9ecef',
    color: '#adb5bd',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    cursor: 'not-allowed',
    fontSize: '14px',
    flexShrink: 0,
  },
  btnPrimary: {
    padding: '8px 16px',
    background: '#0056b3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  btnDisabled: {
    padding: '8px 16px',
    background: '#e9ecef',
    color: '#6c757d',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    cursor: 'not-allowed',
    fontSize: '13px',
  },
} as const;
