import React, { useState } from 'react';
import type { DutInfo, TestTemplate } from '../domain/types.js';
import type { DraftResult } from './runnerTypes.js';
import { DutInfoView } from './views/DutInfoView.js';
import { RunSummaryView } from './views/RunSummaryView.js';
import { TemplateEditorView } from './views/TemplateEditorView.js';
import { TemplateListView } from './views/TemplateListView.js';
import { TestRunnerView } from './views/TestRunnerView.js';

type Screen =
  | { view: 'list' }
  | { view: 'editor'; template: TestTemplate }
  | { view: 'dut-info'; template: TestTemplate }
  | { view: 'runner'; template: TestTemplate; dut: DutInfo; executedBy: string }
  | { view: 'summary'; template: TestTemplate; dut: DutInfo; executedBy: string; draftResults: DraftResult[] };

export function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>({ view: 'list' });

  const goList = () => { setScreen({ view: 'list' }); };
  const goRun = (template: TestTemplate) => { setScreen({ view: 'dut-info', template }); };

  switch (screen.view) {
    case 'list':
      return (
        <div style={{ fontFamily: 'system-ui, sans-serif' }}>
          <AppHeader />
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
  }
}

function AppHeader(): React.ReactElement {
  return (
    <header style={headerStyle}>
      <span style={logoStyle}>ANSUR</span>
      <span style={subStyle}>Remplacement ANSUR</span>
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
