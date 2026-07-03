import React, { useCallback, useEffect, useState } from 'react';

interface PortInfo {
  path: string;
  manufacturer: string | null;
  serialNumber: string | null;
}

interface Props {
  /** Nom du plugin tel qu'il apparaît dans le template (ex. "ESA620"). */
  instrumentId: string;
  /** URL de téléchargement du driver USB (à renseigner quand disponible). */
  downloadUrl?: string;
  /** Appelé après une connexion réussie, pour que le parent relance le test. */
  onConnected?: () => void;
}

/**
 * Bannière non-modale affichée quand un instrument requis par le template
 * n'est pas connecté. Permet à l'utilisateur de sélectionner le port COM
 * et de tenter la connexion sans quitter l'écran courant.
 */
export function InstrumentAlert({
  instrumentId,
  downloadUrl,
  onConnected,
}: Props): React.ReactElement {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const loadPorts = useCallback(async () => {
    try {
      const available = await window.ansurAPI.instruments.listPorts();
      setPorts(available);
      // Pré-sélectionne le premier port disponible si rien n'est encore choisi
      setSelectedPort((prev) => {
        if (prev) return prev;
        const first = available[0];
        return first !== undefined ? first.path : '';
      });
    } catch {
      // Erreur IPC non critique : l'utilisateur peut réessayer via Actualiser
    }
  }, []);

  useEffect(() => {
    void loadPorts();
  }, [loadPorts]);

  const handleConnect = async (): Promise<void> => {
    if (!selectedPort) return;
    setConnecting(true);
    setConnectError(null);

    const result = await window.ansurAPI.instruments.connectEsa620(selectedPort);

    setConnecting(false);
    if (result.success) {
      onConnected?.();
    } else {
      setConnectError(result.error);
    }
  };

  return (
    <div role="alert" style={styles.banner}>
      <span style={styles.icon}>⚠</span>

      <div style={styles.body}>
        <strong style={styles.title}>
          {instrumentId} requis mais non détecté
        </strong>
        <span style={styles.hint}>
          Sélectionnez le port COM auquel l&apos;appareil est connecté, puis cliquez sur{' '}
          <em>Connecter</em>.
        </span>

        {ports.length === 0 ? (
          <span style={styles.warning}>
            Aucun port série détecté. Vérifiez que le driver USB est installé et que
            l&apos;appareil est branché.
          </span>
        ) : (
          <select
            value={selectedPort}
            onChange={(e) => { setSelectedPort(e.target.value); }}
            style={styles.select}
            aria-label="Port COM"
          >
            {ports.map((p) => (
              <option key={p.path} value={p.path}>
                {p.path}
                {p.manufacturer !== null ? ` — ${p.manufacturer}` : ''}
              </option>
            ))}
          </select>
        )}

        {connectError !== null && (
          <span role="alert" style={styles.error}>
            {connectError}
          </span>
        )}
      </div>

      <div style={styles.actions}>
        {downloadUrl !== undefined && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            Télécharger le driver
          </a>
        )}
        <button
          type="button"
          onClick={() => { void loadPorts(); }}
          style={styles.btnSecondary}
        >
          Actualiser
        </button>
        <button
          type="button"
          onClick={() => { void handleConnect(); }}
          disabled={connecting || selectedPort === ''}
          style={connecting || selectedPort === '' ? styles.btnDisabled : styles.btnPrimary}
        >
          {connecting ? 'Connexion…' : 'Connecter'}
        </button>
      </div>
    </div>
  );
}

// ─── Styles inline (pas de dépendance CSS externe) ────────────────────────────

const styles = {
  banner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 16px',
    background: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    margin: '8px 0',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
  },
  icon: {
    fontSize: '20px',
    flexShrink: 0,
    lineHeight: '1.4',
  },
  body: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: '14px',
    color: '#333',
  },
  hint: {
    color: '#555',
  },
  warning: {
    color: '#856404',
  },
  error: {
    color: '#dc3545',
  },
  select: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    maxWidth: '260px',
    fontSize: '13px',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  },
  link: {
    color: '#0056b3',
    fontSize: '13px',
    whiteSpace: 'nowrap' as const,
  },
  btnPrimary: {
    padding: '6px 14px',
    background: '#0056b3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  btnSecondary: {
    padding: '6px 14px',
    background: '#f8f9fa',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  btnDisabled: {
    padding: '6px 14px',
    background: '#e9ecef',
    color: '#6c757d',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    cursor: 'not-allowed',
    fontSize: '13px',
  },
} as const;
