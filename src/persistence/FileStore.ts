import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Stockage fichier bas niveau, sans base de données.
 * Toute la persistance de l'application (templates, séquences, records)
 * repose sur ces primitives : un fichier JSON = une entité.
 */

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Écriture atomique : on écrit dans un fichier temporaire puis on renomme.
 * Sur un même volume, `rename` est atomique côté OS - ça évite un fichier
 * à moitié écrit en cas de crash pendant l'écriture (important pour
 * l'intégrité des test records).
 */
export async function writeJsonFileAtomic(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listJsonFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}

export async function listDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Neutralise les caractères invalides ou dangereux (séparateurs de chemin,
 * "..") dans un identifiant destiné à devenir un nom de fichier/dossier -
 * notamment les numéros de série DUT, saisis librement par l'utilisateur.
 */
export function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9-_.]/g, '_') || '_';
}
