import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DutInfo, TestRecord } from '../domain/types.js';
import { FileTestRecordRepository } from './TestRecordRepository.js';

function buildRecord(overrides: Partial<TestRecord> = {}): TestRecord {
  return {
    id: 'rec-1',
    sequenceId: 'seq-1',
    executedAt: new Date().toISOString(),
    executedBy: 'benoit',
    results: [],
    overallStatus: 'pass',
    ...overrides,
  };
}

const dut: DutInfo = { serialNumber: 'SN-4471', model: 'Moniteur patient X' };

describe('FileTestRecordRepository', () => {
  let recordsDir: string;
  let auditLogPath: string;
  let repo: FileTestRecordRepository;

  beforeEach(async () => {
    recordsDir = await mkdtemp(path.join(tmpdir(), 'ansur-records-'));
    auditLogPath = path.join(recordsDir, '..', 'audit-log.jsonl');
    repo = new FileTestRecordRepository(recordsDir, auditLogPath);
  });

  afterEach(async () => {
    await rm(recordsDir, { recursive: true, force: true });
    await rm(auditLogPath, { force: true });
  });

  it('range le record dans un dossier nommé d’après le numéro de série du DUT', async () => {
    await repo.save(buildRecord(), dut);
    const entries = await readdir(recordsDir);
    expect(entries).toContain('SN-4471');
  });

  it('relit un record sauvegardé', async () => {
    await repo.save(buildRecord(), dut);
    const found = await repo.findByIdForDut('rec-1', 'SN-4471');
    expect(found?.overallStatus).toBe('pass');
  });

  it('refuse d’écraser un record existant (immutabilité)', async () => {
    await repo.save(buildRecord(), dut);
    await expect(repo.save(buildRecord(), dut)).rejects.toThrow(/existe déjà/);
  });

  it('liste les records d’une machine, du plus récent au plus ancien', async () => {
    await repo.save(buildRecord({ id: 'rec-1', executedAt: '2026-01-01T10:00:00.000Z' }), dut);
    await repo.save(buildRecord({ id: 'rec-2', executedAt: '2026-02-01T10:00:00.000Z' }), dut);
    const records = await repo.listByDut('SN-4471');
    expect(records.map((r) => r.id)).toEqual(['rec-2', 'rec-1']);
  });

  it('journalise chaque création de record dans le journal d’audit', async () => {
    await repo.save(buildRecord(), dut);
    const { readFile } = await import('node:fs/promises');
    const auditContent = await readFile(auditLogPath, 'utf-8');
    expect(auditContent).toContain('test-record-created');
    expect(auditContent).toContain('SN-4471');
  });
});
