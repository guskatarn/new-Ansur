import React, { useState } from 'react';
import type { DutInfo, HistoryEntry, TestTemplate } from '../domain/types.js';
import type { DraftResult } from './runnerTypes.js';
import { AuditLogView } from './views/AuditLogView.js';
import { DutInfoView } from './views/DutInfoView.js';
import { HistoryDetailView } from './views/HistoryDetailView.js';
import { HistoryListView } from './views/HistoryListView.js';
import { RunSummaryView } from './views/RunSummaryView.js';
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
  | { view: 'audit-log' };

export function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>({ view: 'list' });

  const goList = () => { setScreen({ view: 'list' }); };
  const goRun = (template: TestTemplate) => { setScreen({ view: 'dut-info', template }); };

  switch (screen.view) {
    case 'list':
      return (
        <div style={{ fontFamily: 'system-ui, sans-serif' }}>
          <AppHeader
            onHistory={() => { setScreen({ view: 'history-list' }); }}
            onAudit={() => { setScreen({ view: 'audit-log' }); }}
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
  }
}

function AppHeader({
  onHistory,
  onAudit,
}: {
  onHistory: () => void;
  onAudit: () => void;
}): React.ReactElement {
  return (
    <header style={headerStyle}>
      <span style={logoStyle}>ANSUR</span>
      <span style={subStyle}>Remplacement ANSUR</span>
      <div style={{ flex: 1 }} />
      <button type="button" onClick={onHistory} style={btnHistoryStyle}>
        Historique
      </button>
      <button type="button" onClick={onAudit} style={btnHistoryStyle}>
        Journal d'audit
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

const btnHistoryStyle: React.CSSProperties = {
  padding: '5px 14px',
  background: 'transparent',
  border: '1px solid #495057',
  borderRadius: '4px',
  color: '#adb5bd',
  cursor: 'pointer',
  fontSize: '13px',
};
