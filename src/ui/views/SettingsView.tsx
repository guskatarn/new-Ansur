import React, { useEffect, useState } from 'react';

interface Props {
  onBack: () => void;
}

interface AppInfo {
  appVersion: string;
  electronVersion: string;
  nodeVersion: string;
  dataRoot: string;
  templatesDir: string;
  sequencesDir: string;
  recordsDir: string;
  auditLogPath: string;
}

export function SettingsView({ onBack }: Props): React.ReactElement {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [openMsg, setOpenMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    window.ansurAPI.app.getInfo()
      .then((i) => { setInfo(i); })
      .catch(() => { /* rare */ });
  }, []);

  const handleOpenFolder = async (): Promise<void> => {
    setOpenMsg(null);
    const result = await window.ansurAPI.app.openDataFolder();
    if (!result.success) {
      setOpenMsg({ text: result.error, isError: true });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <button type="button" onClick={onBack} style={styles.btnBack}>← Retour</button>
        <span style={styles.title}>Paramètres / À propos</span>
      </div>

      <div style={styles.body}>
        {/* ── Versions ────────────────────────────────────────────────── */}
        <Section title="Application">
          <Row label="Version ANSUR Replacement" value={info?.appVersion ?? '…'} />
          <Row label="Electron" value={info?.electronVersion ?? '…'} mono />
          <Row label="Node.js" value={info?.nodeVersion ?? '…'} mono />
        </Section>

        {/* ── Dossier de données ──────────────────────────────────────── */}
        <Section title="Dossier de données">
          <div style={styles.dataRootRow}>
            <span style={styles.pathValue}>{info?.dataRoot ?? '…'}</span>
            <button
              type="button"
              onClick={() => { void handleOpenFolder(); }}
              style={styles.btnOpen}
            >
              Ouvrir dans l'Explorateur
            </button>
          </div>
          {openMsg !== null && (
            <div
              role="alert"
              style={openMsg.isError ? styles.msgError : styles.msgSuccess}
            >
              {openMsg.text}
            </div>
          )}
        </Section>

        {/* ── Chemins détaillés ───────────────────────────────────────── */}
        <Section title="Chemins détaillés">
          <Row label="Templates" value={info?.templatesDir ?? '…'} mono />
          <Row label="Séquences" value={info?.sequencesDir ?? '…'} mono />
          <Row label="Records" value={info?.recordsDir ?? '…'} mono />
          <Row label="Journal d'audit" value={info?.auditLogPath ?? '…'} mono />
        </Section>

        {/* ── Note ────────────────────────────────────────────────────── */}
        <div style={styles.note}>
          Pour sauvegarder ou archiver les données, copiez l'intégralité du dossier racine
          indiqué ci-dessus. Aucune base de données n'est utilisée — tous les fichiers sont
          en JSON lisible.
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.ReactElement {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={mono ? styles.rowValueMono : styles.rowValue}>{value}</span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  title: { fontSize: '15px', fontWeight: 700 as const, color: '#7eb3f7' },
  body: {
    flex: 1, overflow: 'auto', padding: '28px',
    display: 'flex', flexDirection: 'column' as const, gap: '20px', maxWidth: '760px',
  },
  section: {
    background: '#fff', border: '1px solid #e9ecef', borderRadius: '8px', overflow: 'hidden',
  },
  sectionTitle: {
    margin: 0, padding: '10px 18px', fontSize: '12px', fontWeight: 700 as const,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    color: '#0056b3', background: '#f0f5ff', borderBottom: '1px solid #e9ecef',
  },
  sectionBody: {
    padding: '12px 18px', display: 'flex', flexDirection: 'column' as const, gap: '8px',
  },
  row: { display: 'flex', alignItems: 'baseline', gap: '12px', fontSize: '13px' },
  rowLabel: { color: '#6c757d', minWidth: '170px', flexShrink: 0 },
  rowValue: { color: '#212529' },
  rowValueMono: { color: '#212529', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' as const },
  dataRootRow: {
    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' as const,
  },
  pathValue: {
    fontFamily: 'monospace', fontSize: '12px', color: '#212529',
    wordBreak: 'break-all' as const, flex: 1,
  },
  btnOpen: {
    padding: '6px 14px', background: '#0056b3', color: '#fff', border: 'none',
    borderRadius: '4px', cursor: 'pointer', fontSize: '13px', flexShrink: 0,
  },
  msgError: {
    padding: '6px 10px', background: '#fff5f5', border: '1px solid #f1aeb5',
    borderRadius: '4px', fontSize: '12px', color: '#842029',
  },
  msgSuccess: {
    padding: '6px 10px', background: '#f0fdf4', border: '1px solid #a3cfbb',
    borderRadius: '4px', fontSize: '12px', color: '#0a3622',
  },
  note: {
    fontSize: '12px', color: '#6c757d', lineHeight: 1.6,
    background: '#fff', border: '1px solid #e9ecef', borderRadius: '8px',
    padding: '12px 18px',
  },
} as const;
