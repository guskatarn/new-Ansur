import React, { useCallback, useEffect, useState } from 'react';

interface Port {
  path: string;
  manufacturer: string | null;
  serialNumber: string | null;
}

interface InstrumentStatus {
  connected: boolean;
  portPath: string | null;
}

interface Props {
  onBack: () => void;
}

interface InstrumentCardConfig {
  key: string;
  title: string;
  note: string;
  connect: (portPath: string) => Promise<{ success: true } | { success: false; error: string }>;
  disconnect: () => Promise<void>;
  status: () => Promise<InstrumentStatus>;
}

const INSTRUMENTS: readonly InstrumentCardConfig[] = [
  {
    key: 'esa620',
    title: 'ESA620 — Analyseur de sécurité électrique',
    note: "Communique via port série RS-232 ou adaptateur USB-Série (115200 bauds).",
    connect: (p) => window.ansurAPI.instruments.connectEsa620(p),
    disconnect: () => window.ansurAPI.instruments.disconnectEsa620(),
    status: () => window.ansurAPI.instruments.statusEsa620(),
  },
  {
    key: 'qaes',
    title: 'QA-ES III — Analyseur d\'électrochirurgie',
    note: "Communique via port USB virtuel (FTDI) ou Bluetooth (115200 bauds).",
    connect: (p) => window.ansurAPI.instruments.connectQaes(p),
    disconnect: () => window.ansurAPI.instruments.disconnectQaes(),
    status: () => window.ansurAPI.instruments.statusQaes(),
  },
  {
    key: 'impulse',
    title: 'Impulse 6000D/7000DP — Simulateur/analyseur de défibrillateur',
    note: "Communique via port USB virtuel (FTDI) (115200 bauds).",
    connect: (p) => window.ansurAPI.instruments.connectImpulse(p),
    disconnect: () => window.ansurAPI.instruments.disconnectImpulse(),
    status: () => window.ansurAPI.instruments.statusImpulse(),
  },
  {
    key: 'ida4',
    title: 'IDA-4 Plus — Analyseur de pompe à perfusion',
    note: "Communique via port série RS-232 ou adaptateur USB-Série (19200 bauds). " +
      "Driver non confirmé sur matériel réel — à valider avant tout usage en conditions réelles.",
    connect: (p) => window.ansurAPI.instruments.connectIda4(p),
    disconnect: () => window.ansurAPI.instruments.disconnectIda4(),
    status: () => window.ansurAPI.instruments.statusIda4(),
  },
];

export function InstrumentView({ onBack }: Props): React.ReactElement {
  const [ports, setPorts] = useState<Port[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPorts = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      const list = await window.ansurAPI.instruments.listPorts();
      setPorts(list);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchPorts();
  }, [fetchPorts]);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <button type="button" onClick={onBack} style={styles.btnBack}>← Retour</button>
        <span style={styles.title}>Instruments</span>
      </div>

      <div style={styles.body}>
        {INSTRUMENTS.map((instrument) => (
          <InstrumentCard
            key={instrument.key}
            config={instrument}
            ports={ports}
            refreshing={refreshing}
            onRefreshPorts={fetchPorts}
          />
        ))}
      </div>
    </div>
  );
}

function InstrumentCard({
  config,
  ports,
  refreshing,
  onRefreshPorts,
}: {
  config: InstrumentCardConfig;
  ports: Port[];
  refreshing: boolean;
  onRefreshPorts: () => Promise<void>;
}): React.ReactElement {
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [status, setStatus] = useState<InstrumentStatus>({ connected: false, portPath: null });
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchStatus = useCallback(async (): Promise<void> => {
    const s = await config.status();
    setStatus(s);
  }, [config]);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => { void fetchStatus(); }, 2000);
    return () => { clearInterval(interval); };
  }, [fetchStatus]);

  useEffect(() => {
    setSelectedPort((prev) => (prev === '' && ports.length > 0 ? ports[0]!.path : prev));
  }, [ports]);

  const handleConnect = async (): Promise<void> => {
    if (selectedPort === '') return;
    setConnecting(true);
    setMessage(null);
    const result = await config.connect(selectedPort);
    setConnecting(false);
    if (result.success) {
      await fetchStatus();
      setMessage({ text: `Connecté sur ${selectedPort}`, isError: false });
    } else {
      setMessage({ text: result.error, isError: true });
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    setConnecting(true);
    setMessage(null);
    await config.disconnect();
    setConnecting(false);
    await fetchStatus();
    setMessage({ text: 'Déconnecté', isError: false });
  };

  const handleRefresh = async (): Promise<void> => {
    setMessage(null);
    await onRefreshPorts();
  };

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardTitle}>{config.title}</h2>
        <StatusBadge connected={status.connected} />
      </div>

      <div style={styles.cardBody}>
        {status.connected && status.portPath !== null && (
          <div style={styles.connectedInfo}>
            Connecté sur <span style={styles.portHighlight}>{status.portPath}</span>
          </div>
        )}

        {!status.connected && (
          <div style={styles.portRow}>
            <label style={styles.portLabel} htmlFor={`port-select-${config.key}`}>Port COM</label>
            <select
              id={`port-select-${config.key}`}
              value={selectedPort}
              onChange={(e) => { setSelectedPort(e.target.value); }}
              style={styles.portSelect}
              disabled={ports.length === 0 || refreshing}
            >
              {ports.length === 0 && (
                <option value="">Aucun port détecté</option>
              )}
              {ports.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.path}{p.manufacturer !== null ? ` — ${p.manufacturer}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { void handleRefresh(); }}
              disabled={refreshing}
              style={styles.btnRefresh}
              title="Rafraîchir la liste des ports série disponibles"
            >
              {refreshing ? '…' : '↻ Actualiser'}
            </button>
          </div>
        )}

        <div style={styles.actionRow}>
          {!status.connected ? (
            <button
              type="button"
              onClick={() => { void handleConnect(); }}
              disabled={connecting || selectedPort === '' || ports.length === 0}
              style={connecting || selectedPort === '' || ports.length === 0
                ? styles.btnDisabled
                : styles.btnConnect}
            >
              {connecting ? 'Connexion…' : '⚡ Connecter'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { void handleDisconnect(); }}
              disabled={connecting}
              style={connecting ? styles.btnDisabled : styles.btnDisconnect}
            >
              {connecting ? 'Déconnexion…' : '✕ Déconnecter'}
            </button>
          )}
        </div>

        {message !== null && (
          <div role={message.isError ? 'alert' : 'status'} style={message.isError ? styles.msgError : styles.msgSuccess}>
            {message.text}
          </div>
        )}

        <div style={styles.note}>{config.note}</div>
      </div>
    </div>
  );
}

function StatusBadge({ connected }: { connected: boolean }): React.ReactElement {
  return (
    <div style={connected ? styles.badgeOn : styles.badgeOff}>
      <span style={styles.badgeDot} />
      {connected ? 'Connecté' : 'Déconnecté'}
    </div>
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
  title: { fontSize: '15px', fontWeight: 700 as const, color: '#7eb3f7' },
  body: {
    flex: 1, overflow: 'auto', padding: '28px',
    display: 'flex', flexDirection: 'column' as const, gap: '20px', maxWidth: '680px',
  },
  card: {
    background: '#fff', border: '1px solid #e9ecef', borderRadius: '8px', overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 18px', background: '#f0f5ff', borderBottom: '1px solid #e9ecef',
  },
  cardTitle: {
    margin: 0, fontSize: '12px', fontWeight: 700 as const,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#0056b3',
  },
  cardBody: {
    padding: '16px 18px', display: 'flex', flexDirection: 'column' as const, gap: '14px',
  },
  connectedInfo: { fontSize: '13px', color: '#212529' },
  portHighlight: { fontFamily: 'monospace', fontWeight: 600 as const, color: '#0056b3' },
  portRow: {
    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const,
  },
  portLabel: { fontSize: '13px', color: '#495057', flexShrink: 0 },
  portSelect: {
    flex: 1, minWidth: '180px', padding: '6px 10px', fontSize: '13px',
    border: '1px solid #ced4da', borderRadius: '4px', background: '#fff',
  },
  btnRefresh: {
    padding: '6px 12px', background: 'transparent', border: '1px solid #6c757d',
    borderRadius: '4px', color: '#495057', cursor: 'pointer', fontSize: '13px', flexShrink: 0,
  },
  actionRow: { display: 'flex', gap: '10px' },
  btnConnect: {
    padding: '8px 20px', background: '#198754', color: '#fff', border: 'none',
    borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 as const,
  },
  btnDisconnect: {
    padding: '8px 20px', background: 'transparent', color: '#dc3545',
    border: '1px solid #dc3545', borderRadius: '4px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500 as const,
  },
  btnDisabled: {
    padding: '8px 20px', background: '#e9ecef', color: '#adb5bd',
    border: '1px solid #dee2e6', borderRadius: '4px', cursor: 'not-allowed',
    fontSize: '13px', fontWeight: 500 as const,
  },
  msgError: {
    padding: '8px 12px', background: '#fff5f5', border: '1px solid #f1aeb5',
    borderRadius: '4px', fontSize: '13px', color: '#842029',
  },
  msgSuccess: {
    padding: '8px 12px', background: '#f0fdf4', border: '1px solid #a3cfbb',
    borderRadius: '4px', fontSize: '13px', color: '#0a3622',
  },
  badgeOn: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px',
    background: '#d1e7dd', border: '1px solid #a3cfbb', borderRadius: '12px',
    fontSize: '12px', fontWeight: 600 as const, color: '#0a3622',
  },
  badgeOff: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px',
    background: '#f8d7da', border: '1px solid #f1aeb5', borderRadius: '12px',
    fontSize: '12px', fontWeight: 600 as const, color: '#842029',
  },
  badgeDot: {
    width: '7px', height: '7px', borderRadius: '50%',
    background: 'currentColor', display: 'inline-block',
  },
  note: {
    fontSize: '12px', color: '#6c757d', lineHeight: 1.6,
  },
} as const;
