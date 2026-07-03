import path from 'node:path';
import type { TestSequence } from '../domain/types.js';
import { listJsonFiles, readJsonFile, sanitizeSegment, writeJsonFileAtomic } from './FileStore.js';

export interface SequenceRepository {
  save(sequence: TestSequence): Promise<void>;
  findById(id: string): Promise<TestSequence | undefined>;
  listAll(): Promise<TestSequence[]>;
}

/** Une séquence = un fichier `sequences/<id>.json`. */
export class FileSequenceRepository implements SequenceRepository {
  constructor(private readonly sequencesDir: string) {}

  async save(sequence: TestSequence): Promise<void> {
    await writeJsonFileAtomic(this.filePath(sequence.id), sequence);
  }

  async findById(id: string): Promise<TestSequence | undefined> {
    try {
      return await readJsonFile<TestSequence>(this.filePath(id));
    } catch {
      return undefined;
    }
  }

  async listAll(): Promise<TestSequence[]> {
    const files = await listJsonFiles(this.sequencesDir);
    const sequences = await Promise.all(
      files.map((f) => readJsonFile<TestSequence>(path.join(this.sequencesDir, f))),
    );
    return sequences;
  }

  private filePath(id: string): string {
    return path.join(this.sequencesDir, `${sanitizeSegment(id)}.json`);
  }
}
