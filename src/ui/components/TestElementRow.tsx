import React, { useEffect, useRef, useState } from 'react';
import type { Limit, TestElement, TestElementKind } from '../../domain/types.js';
import { LimitEditor } from './LimitEditor.js';

interface Props {
  element: TestElement;
  onChange: (updated: TestElement) => void;
}

function buildUpdatedElement(
  base: TestElement,
  label: string,
  limit: Limit | undefined,
  instructions: string,
): TestElement {
  const result: {
    id: string;
    label: string;
    kind: TestElementKind;
    instrumentCommandId?: string;
    limit?: Limit;
    instructions?: string;
  } = { id: base.id, label, kind: base.kind };
  if (base.instrumentCommandId !== undefined) result.instrumentCommandId = base.instrumentCommandId;
  if (limit !== undefined) result.limit = limit;
  if (instructions.trim() !== '') result.instructions = instructions.trim();
  return result;
}

export function TestElementRow({ element, onChange }: Props): React.ReactElement {
  const [label, setLabel] = useState(element.label);
  const [limit, setLimit] = useState<Limit | undefined>(element.limit);
  const [instructions, setInstructions] = useState(element.instructions ?? '');

  // Stable refs to avoid stale closures in blur handlers
  const labelRef = useRef(label);
  const limitRef = useRef(limit);
  const instructionsRef = useRef(instructions);

  useEffect(() => {
    setLabel(element.label);
    setLimit(element.limit);
    setInstructions(element.instructions ?? '');
    labelRef.current = element.label;
    limitRef.current = element.limit;
    instructionsRef.current = element.instructions ?? '';
  }, [element.id]);

  const commit = () => {
    onChange(buildUpdatedElement(element, labelRef.current, limitRef.current, instructionsRef.current));
  };

  const handleLabelChange = (v: string) => {
    labelRef.current = v;
    setLabel(v);
  };

  const handleInstructionsChange = (v: string) => {
    instructionsRef.current = v;
    setInstructions(v);
  };

  const handleLimitChange = (newLimit: Limit | undefined) => {
    limitRef.current = newLimit;
    setLimit(newLimit);
    onChange(buildUpdatedElement(element, labelRef.current, newLimit, instructionsRef.current));
  };

  return (
    <tr style={styles.row}>
      <td style={styles.idCell} title={element.id}>
        {element.id}
      </td>
      <td style={styles.labelCell}>
        <input
          value={label}
          onChange={(e) => { handleLabelChange(e.target.value); }}
          onBlur={commit}
          style={styles.labelInput}
          aria-label={`Libellé de ${element.id}`}
        />
      </td>
      <td style={styles.kindCell}>
        <span style={kindBadgeStyle(element.kind)}>{kindLabel(element.kind)}</span>
      </td>
      <td style={styles.limitCell}>
        <LimitEditor limit={limit} onChange={handleLimitChange} />
      </td>
      <td style={styles.instructionsCell}>
        <textarea
          value={instructions}
          onChange={(e) => { handleInstructionsChange(e.target.value); }}
          onBlur={commit}
          rows={2}
          style={styles.textarea}
          aria-label={`Instructions de ${element.id}`}
          placeholder="Instructions…"
        />
      </td>
    </tr>
  );
}

function kindLabel(kind: TestElementKind): string {
  switch (kind) {
    case 'measurement': return 'Mesure';
    case 'manual-step': return 'Étape';
    case 'visual-checklist': return 'Visuel';
  }
}

function kindBadgeStyle(kind: TestElementKind): React.CSSProperties {
  const colors: Record<TestElementKind, { bg: string; color: string }> = {
    measurement: { bg: '#cfe2ff', color: '#084298' },
    'manual-step': { bg: '#d1e7dd', color: '#0a3622' },
    'visual-checklist': { bg: '#fff3cd', color: '#664d03' },
  };
  const c = colors[kind];
  return {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: '10px',
    fontSize: '11px',
    background: c.bg,
    color: c.color,
    whiteSpace: 'nowrap',
  };
}

const styles = {
  row: {
    borderBottom: '1px solid #e9ecef',
  },
  idCell: {
    padding: '6px 8px',
    fontSize: '12px',
    color: '#6c757d',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap' as const,
    verticalAlign: 'top' as const,
    maxWidth: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  labelCell: {
    padding: '6px 8px',
    verticalAlign: 'top' as const,
    minWidth: '180px',
  },
  kindCell: {
    padding: '6px 8px',
    verticalAlign: 'top' as const,
    whiteSpace: 'nowrap' as const,
  },
  limitCell: {
    padding: '6px 8px',
    verticalAlign: 'top' as const,
    minWidth: '260px',
  },
  instructionsCell: {
    padding: '6px 8px',
    verticalAlign: 'top' as const,
    width: '100%',
  },
  labelInput: {
    width: '100%',
    padding: '3px 6px',
    fontSize: '13px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%',
    padding: '3px 6px',
    fontSize: '12px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
} as const;
