import { describe, expect, it } from 'vitest';
import { MockInstrumentDriver } from '../instruments/MockInstrumentDriver.js';
import { TestEngine } from './TestEngine.js';
import type { TestSequence, TestTemplate } from './types.js';

function buildTemplate(): TestTemplate {
  return {
    id: 'tpl-1',
    name: 'Test sécurité électrique basique',
    version: 1,
    createdAt: new Date().toISOString(),
    elements: [
      {
        id: 'el-1',
        label: 'Tension secteur',
        kind: 'measurement',
        instrumentCommandId: 'MOCK_VOLTAGE',
        limit: { kind: 'numeric', min: 0, max: 1000, unit: 'V' },
      },
      {
        id: 'el-2',
        label: 'Inspection visuelle du boîtier',
        kind: 'visual-checklist',
      },
    ],
  };
}

function buildSequence(template: TestTemplate): TestSequence {
  return {
    id: 'seq-1',
    templateId: template.id,
    templateVersion: template.version,
    dut: { serialNumber: 'SN-0001', model: 'Moniteur patient X' },
  };
}

describe('TestEngine', () => {
  it("rejette un template dont une commande n'est pas supportée par le driver", () => {
    const driver = new MockInstrumentDriver(['AUTRE_COMMANDE']);
    const engine = new TestEngine(driver);
    const errors = engine.validateTemplateCompatibility(buildTemplate());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('MOCK_VOLTAGE');
  });

  it('exécute un template compatible et produit un TestRecord', async () => {
    const driver = new MockInstrumentDriver();
    const engine = new TestEngine(driver);
    const template = buildTemplate();
    const sequence = buildSequence(template);

    const record = await engine.execute(template, sequence, 'benoit');

    expect(record.sequenceId).toBe(sequence.id);
    expect(record.results).toHaveLength(2);
    expect(record.results[1]!.status).toBe('skipped'); // étape manuelle, non automatisée
  });

  it('calcule un statut global "fail" si au moins un élément échoue', () => {
    const status = TestEngine.computeOverallStatus([
      { elementId: 'a', status: 'pass' },
      { elementId: 'b', status: 'fail' },
    ]);
    expect(status).toBe('fail');
  });

  it('évalue correctement une limite numérique hors bornes', () => {
    const status = TestEngine.evaluateLimit({ kind: 'numeric', min: 0, max: 10, unit: 'V' }, 15);
    expect(status).toBe('fail');
  });
});
