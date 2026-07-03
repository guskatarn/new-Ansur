import React, { useEffect, useState } from 'react';
import type { DutInfo, HistoryEntry, TestTemplate } from '../domain/types.js';
import type { DraftResult } from './runnerTypes.js';
import { AuditLogView } from './views/AuditLogView.js';
import { DutInfoView } from './views/DutInfoView.js';
import { HistoryDetailView } from './views/HistoryDetailView.js';
import { HistoryListView } from './views/HistoryListView.js';
import { InstrumentView } from './views/InstrumentView.js';
import { RunSummaryView } from './views/RunSummaryView.js';
import { SettingsView } from './views/SettingsView.js';
import { TemplateEditorView } from './views/TemplateEditorView.js';
import { TemplateListView } from './views/TemplateListView.js';
import { TestRunnerView } from './views/TestRunnerView.js';

type Screen =
  | { view: 'list' }
  | { view: 'editor'; template: TestTemplate }
  | { view: 'dut-info'; template: TestTemplate }
  | { view: 'runner'; template: TestTemplate; dut: DutInfo; executedBy: string }
  | { view: 'summary'; template: TestTemplate; dut: DutInfo; executedBy: string; draftResults: DraftResult[] }
  | { view: 'history-list' }
  | { view: 'history-detail'; entry: HistoryEntry }
  | { view: 'audit-log' }
  | { view: 'settings' }
  | { view: 'instrument' };

export function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>({ view: 'list' });
  const [instrumentConnected, setInstrumentConnected] = useState(false);

  // Polling du statut ESA620 toutes les 3 s — alimente le badge dans le header.
  useEffect(() => {
    const poll = (): void => {
      window.ansurAPI.instruments.statusEsa620()
        .then((s) => { setInstrumentConnected(s.connected); })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { clearInterval(id); };
  }, []);

  const goList = () => { setScreen({ view: 'list' }); };
  const goRun = (template: TestTemplate) => { setScreen({ view: 'dut-info', template }); };

  switch (screen.view) {
    case 'list':
      return (
        <div style={{ fontFamily: 'system-ui, sans-serif' }}>
          <AppHeader
            instrumentConnected={instrumentConnected}
            onInstrument={() => { setScreen({ view: 'instrument' }); }}
            onHistory={() => { setScreen({ view: 'history-list' }); }}
            onAudit={() => { setScreen({ view: 'audit-log' }); }}
            onSettings={() => { setScreen({ view: 'settings' }); }}
          />
          <TemplateListView
            onSelect={(t) => { setScreen({ view: 'editor', template: t }); }}
            onRun={goRun}
          />
        </div>
      );

    case 'editor':
      return (
        <TemplateEditorView
          template={screen.template}
          onBack={goList}
          onSaved={(updated) => { setScreen({ view: 'editor', template: updated }); }}
          onRun={goRun}
          onDuplicated={(copy) => { setScreen({ view: 'editor', template: copy }); }}
          onDeleted={goList}
        />
      );

    case 'dut-info':
      return (
        <DutInfoView
          templateName={screen.template.name}
          onStart={(dut, executedBy) => {
            setScreen({ view: 'runner', template: screen.template, dut, executedBy });
          }}
          onCancel={goList}
        />
      );

    case 'runner':
      return (
        <TestRunnerView
          template={screen.template}
          dut={screen.dut}
          executedBy={screen.executedBy}
          onComplete={(draftResults) => {
            setScreen({
              view: 'summary',
              template: screen.template,
              dut: screen.dut,
              executedBy: screen.executedBy,
              draftResults,
            });
          }}
          onCancel={goList}
        />
      );

    case 'summary':
      return (
        <RunSummaryView
          template={screen.template}
          dut={screen.dut}
          executedBy={screen.executedBy}
          draftResults={screen.draftResults}
          onReturnToList={goList}
        />
      );

    case 'history-list':
      return (
        <HistoryListView
          onSelect={(entry) => { setScreen({ view: 'history-detail', entry }); }}
          onBack={goList}
        />
      );

    case 'history-detail':
      return (
        <HistoryDetailView
          entry={screen.entry}
          onBack={() => { setScreen({ view: 'history-list' }); }}
        />
      );

    case 'audit-log':
      return <AuditLogView onBack={goList} />;

    case 'settings':
      return <SettingsView onBack={goList} />;

    case 'instrument':
      return <InstrumentView onBack={goList} />;
  }
}

function AppHeader({
  instrumentConnected,
  onInstrument,
  onHistory,
  onAudit,
  onSettings,
}: {
  instrumentConnected: boolean;
  onInstrument: () => void;
  onHistory: () => void;
  onAudit: () => void;
  onSettings: () => void;
}): React.ReactElement {
  return (
    <header style={headerStyle}>
      <span style={logoStyle}>ANSUR</span>
      <span style={subStyle}>Remplacement ANSUR</span>
      <div style={{ flex: 1 }} />
      <button type="button" onClick={onInstrument} style={btnHeaderStyle}>
        <span style={{
          display: 'inline-block',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: instrumentConnected ? '#28a745' : '#dc3545',
          marginRight: '6px',
          verticalAlign: 'middle',
          flexShrink: 0,
        }} />
        ESA620
      </button>
      <button type="button" onClick={onHistory} style={btnHeaderStyle}>
        Historique
      </button>
      <button type="button" onClick={onAudit} style={btnHeaderStyle}>
        Journal d'audit
      </button>
      <button type="button" onClick={onSettings} style={btnHeaderStyle}>
        ⚙ Paramètres
      </button>
    </header>
  );
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 24px',
  background: '#1a1a2e',
  color: '#fff',
  borderBottom: '2px solid #0056b3',
};

const logoStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  color: '#7eb3f7',
};

const subStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#adb5bd',
};

const btnHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '5px 14px',
  background: 'transparent',
  border: '1px solid #495057',
  borderRadius: '4px',
  color: '#adb5bd',
  cursor: 'pointer',
  fontSize: '13px',
};
