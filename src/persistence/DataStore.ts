import path from 'node:path';
import { ensureDir } from './FileStore.js';

/**
 * Résout et crée l'arborescence de dossiers utilisée pour toute la
 * persistance de l'application - aucune base de données, uniquement
 * des fichiers JSON organisés par type d'entité.
 *
 *   <rootDir>/
 *     templates/<templateId>/v<version>.json
 *     sequences/<sequenceId>.json
 *     records/<numeroSerieDUT>/<recordId>.json   <- "un dossier spécifique par machine"
 *     audit-log.jsonl
 *
 * `rootDir` est fourni par l'appelant (le process principal Electron,
 * typiquement via app.getPath('documents') + un sous-dossier dédié) pour
 * que les repositories restent testables indépendamment d'Electron.
 */
export interface DataStorePaths {
  readonly root: string;
  readonly templatesDir: string;
  readonly sequencesDir: string;
  readonly recordsDir: string;
  readonly auditLogPath: string;
}

export async function initDataStore(rootDir: string): Promise<DataStorePaths> {
  const paths: DataStorePaths = {
    root: rootDir,
    templatesDir: path.join(rootDir, 'templates'),
    sequencesDir: path.join(rootDir, 'sequences'),
    recordsDir: path.join(rootDir, 'records'),
    auditLogPath: path.join(rootDir, 'audit-log.jsonl'),
  };

  await ensureDir(paths.templatesDir);
  await ensureDir(paths.sequencesDir);
  await ensureDir(paths.recordsDir);

  return paths;
}
