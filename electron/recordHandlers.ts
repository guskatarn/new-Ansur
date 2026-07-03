import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import type { DutInfo, ElementResult, ElementResultStatus, TestRecord, TestSequence } from '../src/domain/types.js';
import { FileSequenceRepository } from '../src/persistence/SequenceRepository.js';
import { FileTestRecordRepository } from '../src/persistence/TestRecordRepository.js';

let sequenceRepo: FileSequenceRepository | null = null;
let recordRepo: FileTestRecordRepository | null = null;

interface SaveRunParams {
  dut: DutInfo;
  executedBy: string;
  templateId: string;
  templateVersion: number;
  results: readonly ElementResult[];
  overallStatus: ElementResultStatus;
}

export function registerRecordHandlers(
  sequencesDir: string,
  recordsDir: string,
  auditLogPath: string,
): void {
  sequenceRepo = new FileSequenceRepository(sequencesDir);
  recordRepo = new FileTestRecordRepository(recordsDir, auditLogPath);

  ipcMain.handle(
    'records:save-run',
    async (
      _event,
      params: SaveRunParams,
    ): Promise<{ success: true; recordId: string; executedAt: string }> => {
      const sequenceId = randomUUID();
      const recordId = randomUUID();
      const now = new Date().toISOString();

      const sequence: TestSequence = {
        id: sequenceId,
        templateId: params.templateId,
        templateVersion: params.templateVersion,
        dut: params.dut,
      };

      const record: TestRecord = {
        id: recordId,
        sequenceId,
        executedAt: now,
        executedBy: params.executedBy,
        results: params.results,
        overallStatus: params.overallStatus,
      };

      await sequenceRepo!.save(sequence);
      await recordRepo!.save(record, params.dut);

      return { success: true, recordId, executedAt: now };
    },
  );
}
