import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import type {
  DutInfo,
  ElementResult,
  ElementResultStatus,
  HistoryEntry,
  TestRecord,
  TestSequence,
} from '../src/domain/types.js';
import { listDirectories, listJsonFiles, readJsonFile } from '../src/persistence/FileStore.js';
import { FileSequenceRepository } from '../src/persistence/SequenceRepository.js';
import { FileTestRecordRepository } from '../src/persistence/TestRecordRepository.js';
import path from 'node:path';

let sequenceRepo: FileSequenceRepository | null = null;
let recordRepo: FileTestRecordRepository | null = null;
let _recordsDir: string | null = null;

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
  _recordsDir = recordsDir;

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

  ipcMain.handle('records:list', async (): Promise<HistoryEntry[]> => {
    const dir = _recordsDir!;
    const dutDirs = await listDirectories(dir);
    const entries: HistoryEntry[] = [];

    for (const dutDir of dutDirs) {
      const dutDirPath = path.join(dir, dutDir);
      const files = await listJsonFiles(dutDirPath);
      for (const file of files) {
        const record = await readJsonFile<TestRecord>(path.join(dutDirPath, file));
        const sequence = await sequenceRepo!.findById(record.sequenceId);
        if (sequence === undefined) continue;
        entries.push({
          recordId: record.id,
          executedAt: record.executedAt,
          executedBy: record.executedBy,
          overallStatus: record.overallStatus,
          dut: sequence.dut,
          templateId: sequence.templateId,
          templateVersion: sequence.templateVersion,
          results: record.results,
        });
      }
    }

    return entries.sort((a, b) => b.executedAt.localeCompare(a.executedAt));
  });
}
