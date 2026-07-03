import path from 'node:path';
import type { TestTemplate } from '../domain/types.js';
import { listDirectories, listJsonFiles, readJsonFile, sanitizeSegment, writeJsonFileAtomic } from './FileStore.js';

/** Abstraction de la persistance des templates - le moteur ne dépend que de cette interface. */
export interface TemplateRepository {
  save(template: TestTemplate): Promise<void>;
  findLatestVersion(id: string): Promise<TestTemplate | undefined>;
  findByIdAndVersion(id: string, version: number): Promise<TestTemplate | undefined>;
  listAll(): Promise<TestTemplate[]>;
}

/**
 * Un template = un dossier `templates/<id>/`, une version = un fichier
 * `v<version>.json` dans ce dossier. Aucune version n'est jamais réécrite :
 * une nouvelle version de template = un nouveau fichier.
 */
export class FileTemplateRepository implements TemplateRepository {
  constructor(private readonly templatesDir: string) {}

  async save(template: TestTemplate): Promise<void> {
    await writeJsonFileAtomic(this.versionFilePath(template.id, template.version), template);
  }

  async findByIdAndVersion(id: string, version: number): Promise<TestTemplate | undefined> {
    try {
      return await readJsonFile<TestTemplate>(this.versionFilePath(id, version));
    } catch {
      return undefined;
    }
  }

  async findLatestVersion(id: string): Promise<TestTemplate | undefined> {
    const versions = await this.listVersions(id);
    if (versions.length === 0) return undefined;
    return this.findByIdAndVersion(id, Math.max(...versions));
  }

  async listAll(): Promise<TestTemplate[]> {
    const ids = await listDirectories(this.templatesDir);
    const templates: TestTemplate[] = [];
    for (const id of ids) {
      const latest = await this.findLatestVersion(id);
      if (latest) templates.push(latest);
    }
    return templates.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async listVersions(id: string): Promise<number[]> {
    const files = await listJsonFiles(this.templateDirPath(id));
    return files
      .map((f) => /^v(\d+)\.json$/.exec(f)?.[1])
      .filter((v): v is string => v !== undefined)
      .map(Number);
  }

  private templateDirPath(id: string): string {
    return path.join(this.templatesDir, sanitizeSegment(id));
  }

  private versionFilePath(id: string, version: number): string {
    return path.join(this.templateDirPath(id), `v${version}.json`);
  }
}
