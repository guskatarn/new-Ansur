import path from 'node:path';
import type { DutInfo, TestRecord } from '../domain/types.js';
import { appendAuditEntry } from './AuditLog.js';
import { fileExists, listDirectories, listJsonFiles, readJsonFile, sanitizeSegment, writeJsonFileAtomic } from './FileStore.js';

/**
 * Records immuables : uniquement save() et lecture, jamais d'update.
 * `save` échoue explicitement si un enregistrement du même id existe déjà.
 */
export interface TestRecordRepository {
  /** `dut` sert uniquement à déterminer le dossier de rangement (numéro de série). */
  save(record: TestRecord, dut: DutInfo): Promise<void>;
  findByIdForDut(recordId: string, dutSerialNumber: string): Promise<TestRecord | undefined>;
  /** Comptes-rendus de test d'une machine donnée, la plus récente en premier. */
  listByDut(dutSerialNumber: string): Promise<TestRecord[]>;
  listBySequence(sequenceId: string): Promise<TestRecord[]>;
}

/**
 * Organisation sur disque, telle que demandée : un dossier par machine
 * testée, identifiée par son numéro de série DUT.
 *
 *   records/<numeroSerieDUT>/<recordId>.json
 */
export class FileTestRecordRepository implements TestRecordRepository {
  constructor(
    private readonly recordsDir: string,
    private readonly auditLogPath: string,
  ) {}

  async save(record: TestRecord, dut: DutInfo): Promise<void> {
    const filePath = this.filePath(dut.serialNumber, record.id);
    if (await fileExists(filePath)) {
      // Un record est immuable : on ne réécrit jamais un fichier existant.
      throw new Error(`Le test record ${record.id} existe déjà et ne peut pas être modifié.`);
    }
    await writeJsonFileAtomic(filePath, record);
    await appendAuditEntry(this.auditLogPath, {
      occurredAt: new Date().toISOString(),
      actor: record.executedBy,
      action: 'test-record-created',
      details: { recordId: record.id, dutSerialNumber: dut.serialNumber, overallStatus: record.overallStatus },
    });
  }

  async findByIdForDut(recordId: string, dutSerialNumber: string): Promise<TestRecord | undefined> {
    try {
      return await readJsonFile<TestRecord>(this.filePath(dutSerialNumber, recordId));
    } catch {
      return undefined;
    }
  }

  async listByDut(dutSerialNumber: string): Promise<TestRecord[]> {
    const dir = this.dutDirPath(dutSerialNumber);
    const files = await listJsonFiles(dir);
    const records = await Promise.all(files.map((f) => readJsonFile<TestRecord>(path.join(dir, f))));
    return records.sort((a, b) => b.executedAt.localeCompare(a.executedAt));
  }

  async listBySequence(sequenceId: string): Promise<TestRecord[]> {
    // Pas d'index par séquence : on parcourt les dossiers machine. Pour un
    // usage mono-poste avec un volume de records modeste, c'est largement
    // suffisant ; à revoir avec un index si le volume grossit beaucoup.
    const dutDirs = await listDirectories(this.recordsDir);
    const matches: TestRecord[] = [];
    for (const dutDir of dutDirs) {
      const dirPath = path.join(this.recordsDir, dutDir);
      const files = await listJsonFiles(dirPath);
      for (const file of files) {
        const record = await readJsonFile<TestRecord>(path.join(dirPath, file));
        if (record.sequenceId === sequenceId) matches.push(record);
      }
    }
    return matches.sort((a, b) => b.executedAt.localeCompare(a.executedAt));
  }

  private dutDirPath(dutSerialNumber: string): string {
    return path.join(this.recordsDir, sanitizeSegment(dutSerialNumber));
  }

  private filePath(dutSerialNumber: string, recordId: string): string {
    return path.join(this.dutDirPath(dutSerialNumber), `${sanitizeSegment(recordId)}.json`);
  }
}
