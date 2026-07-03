import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import type { AuditEntry } from '../src/domain/types.js';

let _auditLogPath: string | null = null;

export function registerAuditHandlers(auditLogPath: string): void {
  _auditLogPath = auditLogPath;

  ipcMain.handle('audit:list', async (): Promise<AuditEntry[]> => {
    const filePath = _auditLogPath!;
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch {
      // Le fichier n'existe pas encore (aucun test exécuté)
      return [];
    }

    const entries: AuditEntry[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      try {
        entries.push(JSON.parse(trimmed) as AuditEntry);
      } catch {
        // Ligne corrompue — ignorée silencieusement
      }
    }

    return entries.reverse(); // plus récent en premier
  });
}
