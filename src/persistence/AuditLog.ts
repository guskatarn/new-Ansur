import fs from 'node:fs/promises';

/**
 * Piste d'audit : un fichier JSONL (une ligne = un événement JSON), en
 * ajout seul (`appendFile`). Jamais de réécriture ni de suppression -
 * c'est ce qui en fait une trace fiable.
 */
export interface AuditEntry {
  readonly occurredAt: string; // ISO 8601
  readonly actor: string;
  readonly action: string;
  readonly details?: unknown;
}

export async function appendAuditEntry(auditLogPath: string, entry: AuditEntry): Promise<void> {
  await fs.appendFile(auditLogPath, `${JSON.stringify(entry)}\n`, 'utf-8');
}
