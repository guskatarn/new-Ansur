import fs from 'node:fs/promises';
import type { AuditEntry } from '../domain/types.js';

export type { AuditEntry };

/**
 * Piste d'audit : un fichier JSONL (une ligne = un événement JSON), en
 * ajout seul (`appendFile`). Jamais de réécriture ni de suppression -
 * c'est ce qui en fait une trace fiable.
 */

export async function appendAuditEntry(auditLogPath: string, entry: AuditEntry): Promise<void> {
  await fs.appendFile(auditLogPath, `${JSON.stringify(entry)}\n`, 'utf-8');
}
